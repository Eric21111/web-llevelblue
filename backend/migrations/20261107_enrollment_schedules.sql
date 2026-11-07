-- Apply after 20261106_cohort_promotion.sql. Additive: no student, history or learning rows change.
-- Scheduled transitions reuse levelblue_transition_enrollment, so history, audit events and the
-- mobile enrollment guard behave exactly as in the manual checklist.
-- This file does not enable a scheduler; see the pg_cron note at the end.
begin;
do $$
declare transition regprocedure:=to_regprocedure('public.levelblue_transition_enrollment(text,uuid,jsonb)');
begin
 if transition is null or (select prorettype from pg_proc where oid=transition) is distinct from 'jsonb'::regtype then
  raise exception 'Apply 20261106_cohort_promotion.sql first: public.levelblue_transition_enrollment(text,uuid,jsonb) returning jsonb is required.';
 end if;
end $$;
create table if not exists public.enrollment_schedules (
 id uuid primary key default gen_random_uuid(),
 created_by text not null,
 action text not null check(action in ('promote','graduate')),
 source_section text not null references public.sections(scope_id),
 -- Kept for audit without a foreign key: execution revalidates the destination, and a cancelled or
 -- failed schedule must not block deleting an otherwise unused section.
 target_section text,
 from_year text not null,
 to_year text,
 run_on date not null,
 students jsonb not null check(jsonb_typeof(students)='array'),
 status text not null default 'pending' check(status in ('pending','completed','failed','cancelled')),
 created_at timestamptz not null default now(),
 cancelled_by text,
 cancelled_at timestamptz,
 executed_at timestamptz,
 result jsonb,
 check((action='promote')=(target_section is not null and to_year is not null))
);
-- One pending schedule per section keeps two plans from competing for the same learners.
create unique index if not exists enrollment_schedules_one_pending on public.enrollment_schedules(source_section) where status='pending';
create index if not exists enrollment_schedules_due on public.enrollment_schedules(run_on) where status='pending';
alter table public.enrollment_schedules enable row level security;
revoke all on public.enrollment_schedules from public,anon,authenticated;
grant select,insert,update on public.enrollment_schedules to service_role;

-- Locks the learner and returns why they cannot move, or null when the checklist still applies.
-- Mirrors the per-learner checks in levelblue_transition_enrollment.
create or replace function public.levelblue_schedule_skip_reason(p_student text,p_version integer,p_source text,p_grade text,p_from_year text)
returns text language plpgsql set search_path=public as $$
declare learner students;
begin
 select * into learner from students where id::text=p_student for update;
 if not found then return 'not-found'; end if;
 if learner.enrollment_status<>'active' then return 'already-'||learner.enrollment_status; end if;
 if learner.section_id is distinct from p_source then return 'moved'; end if;
 if learner.enrollment_version is distinct from p_version then return 'enrollment-changed'; end if;
 if coalesce(nullif(trim(learner.grade_level),''),p_grade)<>p_grade then return 'grade-mismatch'; end if;
 if learner.academic_year is not null and learner.academic_year<>p_from_year then return 'year-mismatch'; end if;
 if exists(select 1 from support_bounties where (mentee_id::text=learner.id::text or mentor_id::text=learner.id::text) and cancelled_at is null and status in ('PENDING','AWAITING_LINK','ACCEPTED')) then return 'active-mentor-bounty'; end if;
 return null;
end $$;

create or replace function public.levelblue_create_enrollment_schedule(p_actor text,p_request jsonb,p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare source sections; target sections; item jsonb; amount integer; schedule enrollment_schedules;
 v_action text; v_run_on date; v_to_year text; from_year text:=p_request->>'fromYear';
 today date:=(p_now at time zone 'Asia/Manila')::date;
begin
 perform 1 from users where id::text=p_actor and role='super' and status='Active' for share;
 if not found then raise exception 'Only an active Principal can schedule enrollment changes' using errcode='42501'; end if;
 if jsonb_typeof(p_request->'students') is distinct from 'array' then raise exception 'Invalid checklist'; end if;
 amount:=jsonb_array_length(p_request->'students');
 if amount<1 or amount>500 or (select count(distinct x->>'id') from jsonb_array_elements(p_request->'students') x)<>amount
  or exists(select 1 from jsonb_array_elements(p_request->'students') x where jsonb_typeof(x->'id') is distinct from 'string' or jsonb_typeof(x->'version') is distinct from 'number')
  then raise exception 'Choose 1 to 500 distinct learners'; end if;
 if coalesce(p_request->>'runOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Choose a valid date'; end if;
 begin v_run_on:=(p_request->>'runOn')::date; exception when others then raise exception 'Choose a valid date'; end;
 if v_run_on<=today then raise exception 'Choose a future date (Asia/Manila)'; end if;
 if v_run_on>today+400 then raise exception 'Choose a date within the next 400 days'; end if;
 if from_year is null or from_year !~ '^20[0-9]{2}-20[0-9]{2}$' or right(from_year,4)::int<>left(from_year,4)::int+1 then raise exception 'Use an academic year such as 2026-2027'; end if;
 select * into source from sections where scope_id=p_request->>'sourceId' for share;
 if not found or source.grade_level is null or source.grade_level not in ('Grade 11','Grade 12') then raise exception 'Choose a section with a confirmed grade'; end if;
 -- The confirmed section grade decides the action; Grade 12 never promotes.
 v_action:=case source.grade_level when 'Grade 11' then 'promote' else 'graduate' end;
 if p_request ? 'action' and p_request->>'action' is distinct from v_action then raise exception 'The section grade determines this action; reload and review'; end if;
 if v_action='promote' then
  select * into target from sections where scope_id=p_request->>'targetId' for share;
  if not found or target.grade_level is distinct from 'Grade 12' or target.scope_id=source.scope_id then raise exception 'Choose an existing Grade 12 destination section'; end if;
  v_to_year:=(left(from_year,4)::int+1)::text||'-'||(right(from_year,4)::int+1)::text;
 elsif p_request->>'targetId' is not null then raise exception 'Graduation has no destination';
 end if;
 if exists(select 1 from enrollment_schedules where source_section=source.scope_id and status='pending') then raise exception 'This section already has a pending schedule. Cancel it before creating another.'; end if;
 for item in select value from jsonb_array_elements(p_request->'students') order by value->>'id' loop
  if levelblue_schedule_skip_reason(item->>'id',(item->>'version')::integer,source.scope_id,source.grade_level,from_year) is not null then
   raise exception 'Enrollment changed or does not match this checklist; reload and review';
  end if;
 end loop;
 insert into enrollment_schedules(created_by,action,source_section,target_section,from_year,to_year,run_on,students,created_at)
  values(p_actor,v_action,source.scope_id,case when v_action='promote' then target.scope_id end,from_year,v_to_year,v_run_on,
   (select jsonb_agg(jsonb_build_object('id',x->>'id','version',(x->>'version')::integer) order by x->>'id') from jsonb_array_elements(p_request->'students') x),p_now)
  returning * into schedule;
 insert into staff_events(actor_id,event_type,entity_id,details)
  values(p_actor,'enrollment-schedule-created',schedule.id::text,jsonb_build_object('action',v_action,'sourceId',source.scope_id,'targetId',schedule.target_section,'runOn',v_run_on,'count',amount));
 return to_jsonb(schedule);
end $$;

create or replace function public.levelblue_cancel_enrollment_schedule(p_actor text,p_schedule uuid,p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare schedule enrollment_schedules;
begin
 perform 1 from users where id::text=p_actor and role='super' and status='Active' for share;
 if not found then raise exception 'Only an active Principal can cancel enrollment schedules' using errcode='42501'; end if;
 select * into schedule from enrollment_schedules where id=p_schedule for update;
 if not found then raise exception 'Schedule not found' using errcode='P0002'; end if;
 if schedule.status<>'pending' then raise exception 'Only pending schedules can be cancelled. This one is %.',schedule.status; end if;
 update enrollment_schedules set status='cancelled',cancelled_by=p_actor,cancelled_at=p_now where id=p_schedule returning * into schedule;
 insert into staff_events(actor_id,event_type,entity_id,details) values(p_actor,'enrollment-schedule-cancelled',schedule.id::text,jsonb_build_object('runOn',schedule.run_on));
 return to_jsonb(schedule);
end $$;

-- Revalidates one due schedule and moves only learners whose enrollment still matches it.
create or replace function public.levelblue_execute_enrollment_schedule(s public.enrollment_schedules)
returns jsonb language plpgsql set search_path=public as $$
declare source sections; target sections; item jsonb; reason text; eligible jsonb:='[]'; skipped jsonb:='[]'; moved jsonb;
begin
 perform 1 from users where id::text=s.created_by and role='super' and status='Active';
 if not found then return jsonb_build_object('status','failed','error','The Principal who created this schedule is no longer active.'); end if;
 perform 1 from sections where scope_id in (s.source_section,s.target_section) order by scope_id for update;
 select * into source from sections where scope_id=s.source_section;
 if not found or source.grade_level is distinct from (case s.action when 'promote' then 'Grade 11' else 'Grade 12' end) then
  return jsonb_build_object('status','failed','error','The current section grade no longer matches this schedule.');
 end if;
 if s.action='promote' then
  select * into target from sections where scope_id=s.target_section;
  if not found or target.grade_level is distinct from 'Grade 12' then return jsonb_build_object('status','failed','error','The Grade 12 destination section is no longer available.'); end if;
 end if;
 for item in select value from jsonb_array_elements(s.students) order by value->>'id' loop
  reason:=levelblue_schedule_skip_reason(item->>'id',(item->>'version')::integer,s.source_section,source.grade_level,s.from_year);
  if reason is null then eligible:=eligible||jsonb_build_array(item);
  else skipped:=skipped||jsonb_build_array(jsonb_build_object('id',item->>'id','reason',reason)); end if;
 end loop;
 if jsonb_array_length(eligible)=0 then return jsonb_build_object('status','completed','processed',0,'skipped',skipped); end if;
 -- The schedule ID is the batch ID, so the transition's batch replay guard also prevents a second move.
 moved:=levelblue_transition_enrollment(s.created_by,s.id,jsonb_build_object('action',s.action,'sourceId',s.source_section,'targetId',s.target_section,'fromYear',s.from_year,'toYear',s.to_year,'students',eligible));
 return jsonb_build_object('status','completed','processed',(moved->>'count')::integer,'replayed',moved->'replayed','skipped',skipped,'batchId',s.id);
end $$;

-- Called by the scheduler. Each due schedule leaves 'pending' in the same transaction that moves its
-- learners; SKIP LOCKED lets overlapping runs pass over a schedule another run is processing.
create or replace function public.levelblue_run_due_enrollment_schedules(p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare s enrollment_schedules; outcome jsonb; outcomes jsonb:='[]'; today date:=(p_now at time zone 'Asia/Manila')::date;
begin
 for s in select * from enrollment_schedules where status='pending' and run_on<=today order by run_on,created_at for update skip locked loop
  begin
   outcome:=levelblue_execute_enrollment_schedule(s);
  exception when others then
   outcome:=jsonb_build_object('status','failed','error',left(sqlerrm,300));
  end;
  update enrollment_schedules set status=outcome->>'status',executed_at=p_now,result=outcome where id=s.id;
  insert into staff_events(actor_id,event_type,entity_id,details) values(s.created_by,'enrollment-schedule-'||(outcome->>'status'),s.id::text,outcome);
  outcomes:=outcomes||jsonb_build_array(jsonb_build_object('id',s.id,'status',outcome->>'status'));
 end loop;
 return jsonb_build_object('processed',jsonb_array_length(outcomes),'schedules',outcomes);
end $$;

-- Supabase grants new functions to anon, authenticated and service_role directly, so revoke from each.
revoke all on function public.levelblue_schedule_skip_reason(text,integer,text,text,text),
 public.levelblue_create_enrollment_schedule(text,jsonb,timestamptz),
 public.levelblue_cancel_enrollment_schedule(text,uuid,timestamptz),
 public.levelblue_execute_enrollment_schedule(public.enrollment_schedules),
 public.levelblue_run_due_enrollment_schedules(timestamptz) from public,anon,authenticated,service_role;
-- The web backend creates and cancels. These functions run with the caller's privileges, so creating a
-- schedule also needs the read-only eligibility check. The executor and runner stay with the owner,
-- which is the role pg_cron runs the job as.
grant execute on function public.levelblue_schedule_skip_reason(text,integer,text,text,text),
 public.levelblue_create_enrollment_schedule(text,jsonb,timestamptz),
 public.levelblue_cancel_enrollment_schedule(text,uuid,timestamptz) to service_role;
commit;
notify pgrst,'reload schema';

-- Scheduler activation (manual, after review; not run by this file):
--   1. Supabase dashboard → Database → Extensions → enable pg_cron.
--   2. As the role that applied this migration (postgres in the Supabase SQL editor), run:
--        select cron.schedule('levelblue-enrollment-schedules','5 * * * *',
--          $$select public.levelblue_run_due_enrollment_schedules()$$);
--      pg_cron runs a job as the role that scheduled it; service_role, anon and authenticated cannot run it.
-- Hourly at :05 UTC. A schedule runs at the first tick on or after 00:00 Asia/Manila of its date
-- (normally 00:05), and a missed tick is caught up by the next one.
-- Disable with: select cron.unschedule('levelblue-enrollment-schedules');

-- Rollback (manual; requires explicit approval; never run automatically):
--   1. Disable the scheduler first so no run starts during rollback:
--        select cron.unschedule('levelblue-enrollment-schedules');
--   2. If necessary, revert the web backend/frontend to a version without the Schedules routes/tab.
--      Until then the Schedules tab reports that this migration is missing; manual enrollment keeps working.
--   3. Drop the functions, callers before callees (the executor takes the table's row type):
--        drop function if exists public.levelblue_run_due_enrollment_schedules(timestamptz);
--        drop function if exists public.levelblue_execute_enrollment_schedule(public.enrollment_schedules);
--        drop function if exists public.levelblue_create_enrollment_schedule(text,jsonb,timestamptz);
--        drop function if exists public.levelblue_cancel_enrollment_schedule(text,uuid,timestamptz);
--        drop function if exists public.levelblue_schedule_skip_reason(text,integer,text,text,text);
--   4. Only after confirming the schedule records are no longer needed (export them first if in doubt):
--        drop table if exists public.enrollment_schedules;
--   5. enrollment_history, enrollment_batches and staff_events rows written by executed schedules remain intact.
--   6. Schema rollback does not reverse students already promoted or graduated by a schedule.
--   7. Execute these statements manually only after the rollback has been approved.
