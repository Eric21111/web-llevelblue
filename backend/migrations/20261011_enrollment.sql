-- Apply after web foundations. Enrollment archival does not disable mobile accounts.
begin;
alter table public.students add column if not exists enrollment_status text not null default 'active' check(enrollment_status in ('active','graduated'));
alter table public.students add column if not exists academic_year text;
alter table public.students add column if not exists enrollment_version integer not null default 0;
create table if not exists public.enrollment_batches (
 id uuid primary key, actor_id text not null, request jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.enrollment_history (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.enrollment_batches(id),
 student_id text not null, actor_id text not null, action text not null check(action in ('promote','graduate')),
 from_section text not null references public.sections(scope_id), to_section text references public.sections(scope_id),
 from_grade text not null, to_grade text, from_year text not null, to_year text,
 created_at timestamptz not null default now(), unique(batch_id,student_id)
);
create index if not exists enrollment_history_student on public.enrollment_history(student_id,created_at);
alter table public.enrollment_batches enable row level security;
alter table public.enrollment_history enable row level security;
revoke all on public.enrollment_batches,public.enrollment_history from public,anon,authenticated;
grant select,insert on public.enrollment_batches,public.enrollment_history to service_role;

-- Old mobile saves cannot restore enrollment after it has been changed by staff.
create or replace function public.levelblue_guard_enrollment() returns trigger language plpgsql set search_path=public as $$
begin
 if (new.section,new.section_id,new.grade_level,new.academic_year,new.enrollment_status,new.enrollment_version)
    is distinct from (old.section,old.section_id,old.grade_level,old.academic_year,old.enrollment_status,old.enrollment_version)
    and current_setting('levelblue.enrollment_write',true) is distinct from 'allowed' then
  raise exception 'Enrollment changes require the section checklist';
 end if;
 return new;
end $$;
drop trigger if exists levelblue_guard_enrollment on public.students;
create trigger levelblue_guard_enrollment before update of section,section_id,grade_level,academic_year,enrollment_status,enrollment_version on public.students for each row execute function public.levelblue_guard_enrollment();

create or replace function public.levelblue_transition_enrollment(p_actor text,p_batch uuid,p_request jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare actor_role text; source sections; target sections; learner students; item jsonb; old_batch enrollment_batches;
 action text:=p_request->>'action'; source_id text:=p_request->>'sourceId'; target_id text:=p_request->>'targetId';
 from_year text:=p_request->>'fromYear'; to_year text:=p_request->>'toYear'; amount integer;
begin
 -- Serialize against faculty deactivation/reassignment, then lock sections and learners.
 select role into actor_role from users where id::text=p_actor and status='Active' for update;
 if actor_role is null or actor_role not in ('admin','super') then raise exception 'Active staff required'; end if;
 perform pg_advisory_xact_lock(hashtext(p_batch::text));
 select * into old_batch from enrollment_batches where id=p_batch;
 if found then
  if old_batch.actor_id<>p_actor or old_batch.request<>p_request then raise exception 'Request ID was already used for a different checklist'; end if;
  return jsonb_build_object('count',jsonb_array_length(p_request->'students'),'replayed',true);
 end if;
 if action is null or action not in ('promote','graduate') or jsonb_typeof(p_request->'students') is distinct from 'array' then raise exception 'Invalid checklist'; end if;
 amount:=jsonb_array_length(p_request->'students');
 if amount<1 or amount>500 or (select count(distinct x->>'id') from jsonb_array_elements(p_request->'students') x)<>amount then raise exception 'Choose 1 to 500 distinct learners'; end if;
 if from_year is null or from_year !~ '^20[0-9]{2}-20[0-9]{2}$' or right(from_year,4)::int<>left(from_year,4)::int+1 then raise exception 'Use an academic year such as 2026-2027'; end if;
 perform 1 from sections where scope_id in (source_id,target_id) order by scope_id for update;
 select * into source from sections where scope_id=source_id;
 if not found or source.grade_level is distinct from (case when action='promote' then 'Grade 11' else 'Grade 12' end) then raise exception 'Source section grade does not match this action'; end if;
 if actor_role='admin' and not exists(select 1 from teacher_sections where teacher_id=p_actor and section_id=source_id) then raise exception 'Source section is not assigned to you'; end if;
 if action='promote' then
  select * into target from sections where scope_id=target_id;
  if not found or target.grade_level is distinct from 'Grade 12' then raise exception 'Choose a Grade 12 destination'; end if;
  if actor_role='admin' and not exists(select 1 from teacher_sections where teacher_id=p_actor and section_id=target_id) then raise exception 'Destination section is not assigned to you'; end if;
  if to_year is null or to_year !~ '^20[0-9]{2}-20[0-9]{2}$' or left(to_year,4)::int<>left(from_year,4)::int+1 or right(to_year,4)::int<>right(from_year,4)::int+1 then raise exception 'Promotion must use the next academic year'; end if;
 elsif target_id is not null or to_year is not null then raise exception 'Graduation has no destination';
 end if;
 insert into enrollment_batches(id,actor_id,request) values(p_batch,p_actor,p_request);
 perform set_config('levelblue.enrollment_write','allowed',true);
 for item in select value from jsonb_array_elements(p_request->'students') order by value->>'id' loop
  select * into learner from students where id::text=item->>'id' for update;
  if not found or learner.section_id is distinct from source_id or learner.enrollment_status<>'active'
   or learner.enrollment_version is distinct from (item->>'version')::integer
   or coalesce(nullif(trim(learner.grade_level),''),source.grade_level)<>source.grade_level
   or (learner.academic_year is not null and learner.academic_year<>from_year) then raise exception 'Enrollment changed or does not match this checklist; reload and review'; end if;
  if exists(select 1 from support_bounties where (mentee_id::text=learner.id::text or mentor_id::text=learner.id::text) and cancelled_at is null and status in ('PENDING','AWAITING_LINK','ACCEPTED')) then raise exception 'Resolve or cancel active mentor bounties before moving this learner'; end if;
  insert into enrollment_history(batch_id,student_id,actor_id,action,from_section,to_section,from_grade,to_grade,from_year,to_year)
   values(p_batch,learner.id::text,p_actor,action,source_id,case when action='promote' then target_id end,source.grade_level,case when action='promote' then 'Grade 12' end,from_year,to_year);
  update students set section=case when action='promote' then target.name else section end,
   section_id=case when action='promote' then target_id else section_id end,
   grade_level=case when action='promote' then 'Grade 12' else grade_level end,
   academic_year=case when action='promote' then to_year else from_year end,
   enrollment_status=case when action='promote' then 'active' else 'graduated' end,
   enrollment_version=enrollment_version+1 where id=learner.id;
 end loop;
 perform set_config('levelblue.enrollment_write','',true);
 insert into staff_events(actor_id,event_type,entity_id,details) values(p_actor,'enrollment-'||action,p_batch::text,p_request);
 return jsonb_build_object('count',amount,'replayed',false);
end $$;
revoke all on function public.levelblue_transition_enrollment(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.levelblue_transition_enrollment(text,uuid,jsonb) to service_role;
-- A bounty created from a stale roster must not bridge two sections after promotion.
create or replace function public.levelblue_bounty_enrollment_guard() returns trigger language plpgsql set search_path=public as $$
declare mentor students; mentee students;
begin
 perform 1 from students where id::text in (new.mentor_id::text,new.mentee_id::text) order by id for update;
 select * into mentor from students where id::text=new.mentor_id::text;
 select * into mentee from students where id::text=new.mentee_id::text;
 if mentor.id is null or mentee.id is null or mentor.id=mentee.id or mentor.enrollment_status<>'active' or mentee.enrollment_status<>'active' or mentor.section_id is null or mentor.section_id is distinct from mentee.section_id then raise exception 'Bounty participants must be active in the same section'; end if;
 if not exists(select 1 from users u where u.id::text=new.created_by and u.status='Active' and (u.role='super' or (u.role='admin' and exists(select 1 from teacher_sections ts where ts.teacher_id=u.id::text and ts.section_id=mentor.section_id)))) then raise exception 'Bounty creator no longer has access to this section'; end if;
 return new;
end $$;
drop trigger if exists levelblue_bounty_enrollment_guard on public.support_bounties;
create trigger levelblue_bounty_enrollment_guard before insert on public.support_bounties for each row execute function public.levelblue_bounty_enrollment_guard();
commit;
notify pgrst,'reload schema';
