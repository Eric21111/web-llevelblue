-- Requires web foundations. Service-role only; never expose these RPCs to clients.
alter table public.students add column if not exists session_version bigint not null default 0;
create table if not exists public.student_recovery (
  id uuid primary key default gen_random_uuid(), student_id text not null,
  requested_email text not null, requested_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  status text not null default 'pending' check(status in ('pending','issuing','approved','delivery_failed','declined','completed','expired')),
  token_hash text unique, token_expires_at timestamptz, actor_id text,
  updated_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists student_recovery_student_time on public.student_recovery(student_id,requested_at desc);
alter table public.student_recovery enable row level security;
revoke all on public.student_recovery from anon,authenticated;
grant all on public.student_recovery to service_role;

create or replace function public.levelblue_request_recovery(p_email text) returns void
language plpgsql set search_path=public as $$
declare s students%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_email)),0));
  select * into s from students where lower(trim(email))=lower(trim(p_email)) limit 1;
  if not found then return; end if;
  update student_recovery set status='expired',token_hash=null,updated_at=now()
    where student_id=s.id::text and status in ('pending','issuing','approved','delivery_failed')
    and (expires_at<=now() or (status='approved' and token_expires_at<=now()));
  if exists(select 1 from student_recovery where student_id=s.id::text and status in ('pending','issuing','approved','delivery_failed')) then return; end if;
  if (select count(*) from student_recovery where student_id=s.id::text and requested_at>now()-interval '24 hours')>=3 then return; end if;
  insert into student_recovery(student_id,requested_email) values(s.id::text,s.email);
end $$;

create or replace function public.levelblue_recovery_queue(p_actor text) returns table(
  id uuid,student_name text,email text,section text,status text,requested_at timestamptz,expires_at timestamptz,updated_at timestamptz
) language plpgsql set search_path=public as $$
declare staff users%rowtype;
begin
  select * into staff from users where users.id::text=p_actor and users.status='Active' and role in ('admin','super');
  if not found then raise exception 'Active staff access required'; end if;
  return query select r.id,coalesce(s.name,s.email),r.requested_email,s.section,
    case when r.status in ('pending','issuing','approved','delivery_failed') and (r.expires_at<=now() or (r.status='approved' and r.token_expires_at<=now())) then 'expired'
      when r.status='issuing' and r.updated_at<now()-interval '2 minutes' then 'delivery_failed' else r.status end,
    r.requested_at,coalesce(r.token_expires_at,r.expires_at),r.updated_at
    from student_recovery r join students s on s.id::text=r.student_id
    where r.requested_at>now()-interval '30 days' and (staff.role='super' or exists(
      select 1 from teacher_sections t where t.teacher_id=p_actor and t.section_id=s.section_id))
    order by r.requested_at desc limit 200;
end $$;

create or replace function public.levelblue_decide_recovery(p_actor text,p_id uuid,p_action text,p_hash text default null)
returns text language plpgsql set search_path=public as $$
declare r student_recovery%rowtype; s students%rowtype; staff users%rowtype;
begin
  select * into staff from users where id::text=p_actor and status='Active' and role in ('admin','super');
  if not found then raise exception 'Active staff access required'; end if;
  select * into r from student_recovery where id=p_id for update;
  if not found then raise exception 'Request unavailable'; end if;
  select * into s from students where id::text=r.student_id for update;
  if not found then raise exception 'Request unavailable'; end if;
  if staff.role<>'super' and not exists(select 1 from teacher_sections where teacher_id=p_actor and section_id=s.section_id) then raise exception 'Request unavailable in your sections'; end if;
  if r.expires_at<=now() or s.email is distinct from r.requested_email then raise exception 'Request expired or student email changed'; end if;
  if r.status not in ('pending','delivery_failed') and not (r.status='issuing' and r.updated_at<now()-interval '2 minutes') then raise exception 'Request already processed'; end if;
  if p_action not in ('approve','decline') then raise exception 'Invalid action'; end if;
  if p_action='approve' and (p_hash is null or p_hash !~ '^[a-f0-9]{64}$') then raise exception 'Invalid token hash'; end if;
  update student_recovery set status=case when p_action='approve' then 'issuing' else 'declined' end,
    token_hash=case when p_action='approve' then p_hash else null end,
    token_expires_at=case when p_action='approve' then least(now()+interval '15 minutes',r.expires_at) else null end,
    actor_id=p_actor,updated_at=now() where id=p_id;
  insert into staff_events(actor_id,event_type,entity_id,details) values(p_actor,'student_recovery_'||p_action,p_id::text,'{}');
  return s.email;
end $$;

create or replace function public.levelblue_recovery_delivery(p_id uuid,p_hash text,p_sent boolean) returns boolean
language plpgsql set search_path=public as $$
begin
  update student_recovery set status=case when p_sent then 'approved' else 'delivery_failed' end,
    token_hash=case when p_sent then token_hash else null end,updated_at=now()
    where id=p_id and token_hash=p_hash and status='issuing';
  if not found then return false; end if;
  insert into staff_events(actor_id,event_type,entity_id,details)
    select actor_id,case when p_sent then 'student_recovery_email_accepted' else 'student_recovery_email_failed' end,id::text,'{}' from student_recovery where id=p_id;
  return true;
end $$;

create or replace function public.levelblue_consume_recovery(p_hash text,p_password text) returns boolean
language plpgsql set search_path=public as $$
declare r student_recovery%rowtype; s students%rowtype;
begin
  select * into r from student_recovery where token_hash=p_hash for update;
  if not found or r.status<>'approved' or r.token_expires_at<=now() or r.expires_at<=now() then return false; end if;
  select * into s from students where id::text=r.student_id for update;
  if not found or s.email is distinct from r.requested_email then return false; end if;
  if p_password is null or p_password !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$' then raise exception 'Invalid password hash'; end if;
  update students set password=p_password,requires_password_change=false,session_version=session_version+1 where id=s.id;
  update student_recovery set status='completed',token_hash=null,completed_at=now(),updated_at=now() where id=r.id;
  insert into staff_events(actor_id,event_type,entity_id,details) values('student:'||s.id::text,'student_recovery_completed',r.id::text,'{}');
  return true;
end $$;

revoke all on function public.levelblue_request_recovery(text),public.levelblue_recovery_queue(text),public.levelblue_decide_recovery(text,uuid,text,text),public.levelblue_recovery_delivery(uuid,text,boolean),public.levelblue_consume_recovery(text,text) from public,anon,authenticated;
grant execute on function public.levelblue_request_recovery(text),public.levelblue_recovery_queue(text),public.levelblue_decide_recovery(text,uuid,text,text),public.levelblue_recovery_delivery(uuid,text,boolean),public.levelblue_consume_recovery(text,text) to service_role;
