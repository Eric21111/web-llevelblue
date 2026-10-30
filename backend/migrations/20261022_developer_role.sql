-- Developer role, invitation access, and sanitized operational monitoring.
-- Additive: existing teacher, student, and learning rows are not rewritten.
begin;

create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  category text not null check (category in ('api-error','sync-failure','invalid-event','duplicate-event')),
  status integer,
  code text,
  route text,
  message text
);
alter table public.operational_events enable row level security;
revoke all on public.operational_events from public, anon, authenticated;
grant select, insert on public.operational_events to service_role;
create index if not exists operational_events_occurred_at on public.operational_events(occurred_at desc);

create or replace function public.levelblue_log_operational_event(
  p_category text, p_message text, p_code text, p_route text, p_status integer
) returns void language plpgsql security definer set search_path=public as $$
declare clean_message text;
begin
  if p_category not in ('api-error','sync-failure','invalid-event','duplicate-event') then
    raise exception 'Invalid operational category';
  end if;
  clean_message := left(coalesce(p_message, ''), 300);
  clean_message := regexp_replace(clean_message, '[Bb]earer[[:space:]]+[^[:space:]]+', 'bearer [redacted]', 'g');
  clean_message := regexp_replace(clean_message, '[Pp]assword[=:][^[:space:]]+', 'password [redacted]', 'g');
  clean_message := regexp_replace(clean_message, '[Aa]pi[_-]?[Kk]ey[=:][^[:space:]]+', 'key [redacted]', 'g');
  clean_message := regexp_replace(clean_message, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[redacted-email]', 'g');
  insert into operational_events(category, status, code, route, message)
  values (
    p_category,
    p_status,
    left(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9_.:-]', '', 'g'), 40),
    left(regexp_replace(coalesce(p_route, ''), '[^A-Za-z0-9_./:-]', '', 'g'), 120),
    clean_message
  );
end $$;

create or replace function public.levelblue_developer_access(p_actor text, p_developer text, p_status text)
returns void language plpgsql set search_path=public as $$
declare old_status text;
begin
  if not exists(select 1 from users where id::text=p_actor and role='super' and status='Active') then
    raise exception 'School-head access required';
  end if;
  select status into old_status from users where id::text=p_developer and role='developer' for update;
  if not found then raise exception 'Developer not found'; end if;
  if p_status not in ('Active','Inactive','Invited') or (old_status='Invited' and p_status='Active') then
    raise exception 'Invalid status transition';
  end if;
  if p_status='Invited' and old_status<>'Invited' then raise exception 'Cannot re-invite an existing account'; end if;
  if p_status='Inactive' and old_status<>'Inactive' then
    update users set inactive_previous_status=old_status where id::text=p_developer;
  elsif old_status='Inactive' and p_status='Active' and exists(select 1 from users where id::text=p_developer and inactive_previous_status='Invited') then
    p_status := 'Invited';
  end if;
  update users set status=p_status where id::text=p_developer;
  insert into staff_events(actor_id, event_type, entity_id, details)
  values (p_actor, 'developer-updated', p_developer, jsonb_build_object('previousStatus', old_status, 'status', p_status));
end $$;

-- Invitations stay on the existing teacher_invites flow. Developers can use it;
-- teachers are unchanged aside from the role check accepting both roles.
create or replace function public.levelblue_invite_send(p_user text,p_email text,p_password text,p_hash text)
returns jsonb language plpgsql set search_path=public as $$
declare u users; i teacher_invites;
begin
 select * into u from users where id::text=p_user for update;
 if not found or u.role not in ('admin','developer') or u.status<>'Invited' or u.email<>p_email or u.password<>p_password then
  return jsonb_build_object('error','session');
 end if;
 insert into teacher_invites(user_id,email) values(p_user,p_email) on conflict do nothing;
 select * into i from teacher_invites where user_id=p_user for update;
 if i.locked_until>now() then return jsonb_build_object('error','locked'); end if;
 if i.sent_at>now()-interval '60 seconds' then return jsonb_build_object('error','cooldown'); end if;
 if i.window_start>now()-interval '1 hour' and i.send_count>=5 then return jsonb_build_object('error','limit'); end if;
 update teacher_invites set email=p_email,code_hash=p_hash,expires_at=now()+interval '10 minutes',
  verified_grant_hash=null,verified_until=null,
  attempts=case when i.locked_until<=now() then 0 else i.attempts end,locked_until=null,sent_at=now(),
  window_start=case when i.window_start<=now()-interval '1 hour' then now() else i.window_start end,
  send_count=case when i.window_start<=now()-interval '1 hour' then 1 else i.send_count+1 end
 where user_id=p_user;
 return jsonb_build_object('sent',true);
end $$;

create or replace function public.levelblue_invite_verify(p_user text,p_email text,p_password text,p_hash text,p_grant_hash text)
returns jsonb language plpgsql set search_path=public as $$
declare u users; i teacher_invites;
begin
 select * into u from users where id::text=p_user for update;
 if not found or u.role not in ('admin','developer') or u.status<>'Invited' or u.email<>p_email or u.password<>p_password then
  return jsonb_build_object('error','session');
 end if;
 select * into i from teacher_invites where user_id=p_user for update;
 if not found or i.email<>p_email or i.code_hash is null then return jsonb_build_object('error','invalid'); end if;
 if i.locked_until>now() then return jsonb_build_object('error','locked'); end if;
 if i.expires_at<=now() then return jsonb_build_object('error','expired'); end if;
 if i.code_hash<>p_hash then
  update teacher_invites set attempts=attempts+1,
   locked_until=case when attempts+1>=5 then now()+interval '15 minutes' else null end,
   expires_at=case when attempts+1>=5 then now() else expires_at end
  where user_id=p_user;
  return jsonb_build_object('error',case when i.attempts+1>=5 then 'locked' else 'invalid' end);
 end if;
 update teacher_invites set code_hash=null,expires_at=null,attempts=0,
  verified_grant_hash=p_grant_hash,verified_until=now()+interval '10 minutes' where user_id=p_user;
 return jsonb_build_object('verified',true);
end $$;

create or replace function public.levelblue_invite_activate(p_user text,p_email text,p_password text,p_grant_hash text,p_new_password text)
returns jsonb language plpgsql set search_path=public as $$
declare u users; i teacher_invites;
begin
 select * into u from users where id::text=p_user for update;
 if not found or u.role not in ('admin','developer') or u.status<>'Invited' or u.email<>p_email or u.password<>p_password then
  return jsonb_build_object('error','session');
 end if;
 select * into i from teacher_invites where user_id=p_user for update;
 if not found or i.email<>p_email or i.verified_grant_hash is null or i.verified_until<=now() or i.verified_grant_hash<>p_grant_hash then
  return jsonb_build_object('error','setup');
 end if;
 update users set password=p_new_password,status='Active',inactive_previous_status=null where id=u.id;
 delete from teacher_invites where user_id=p_user;
 insert into staff_events(actor_id,event_type,entity_id,details)
  values(p_user, case when u.role='developer' then 'developer-invite-verified' else 'teacher-invite-verified' end, p_user, jsonb_build_object('method','email-otp'));
 return jsonb_build_object('activated',true);
end $$;

create or replace function public.levelblue_store_teacher_password(p_user text,p_password text,p_ciphertext text)
returns boolean language plpgsql set search_path=public as $$
begin
 perform 1 from users where id::text=p_user and role in ('admin','developer') and status='Invited' and password=p_password for update;
 if not found then return false; end if;
 if exists(select 1 from teacher_invites where user_id=p_user and verified_grant_hash is not null) then return false; end if;
 insert into teacher_temporary_credentials(user_id,ciphertext) values(p_user,p_ciphertext) on conflict do nothing;
 return found;
end $$;

create or replace function public.levelblue_preview_teacher_password(p_actor text,p_user text)
returns jsonb language plpgsql set search_path=public as $$
declare u users; encrypted text;
begin
 perform 1 from users where id::text=p_actor and role='super' and status='Active' for share;
 if not found then raise exception 'School-head access required'; end if;
 select * into u from users where id::text=p_user and role in ('admin','developer') for share;
 if not found or u.status<>'Invited' then return null; end if;
 select ciphertext into encrypted from teacher_temporary_credentials where user_id=p_user and cleared_at is null;
 if encrypted is null then return null; end if;
 return jsonb_build_object('ciphertext',encrypted,'passwordHash',u.password);
end $$;

revoke all on function public.levelblue_log_operational_event(text,text,text,text,integer), public.levelblue_developer_access(text,text,text) from public, anon, authenticated;
grant execute on function public.levelblue_log_operational_event(text,text,text,text,integer), public.levelblue_developer_access(text,text,text) to service_role;
commit;
notify pgrst, 'reload schema';
