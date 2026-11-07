-- Apply after 20261107_enrollment_schedules.sql. Forward-only and additive: earlier migration files are
-- unchanged, and applying this file changes no student, history or learning rows.
-- A school-wide advancement plan owns one enrollment_schedules row per section, so execution reuses
-- levelblue_execute_enrollment_schedule and levelblue_transition_enrollment unchanged, and the existing
-- pg_cron job keeps calling levelblue_run_due_enrollment_schedules(). This file does not enable a scheduler.
begin;
do $$
begin
 if to_regclass('public.enrollment_schedules') is null then
  raise exception 'Apply 20261107_enrollment_schedules.sql first: public.enrollment_schedules is required.';
 end if;
 if to_regprocedure('public.levelblue_execute_enrollment_schedule(public.enrollment_schedules)') is null
  or to_regprocedure('public.levelblue_schedule_skip_reason(text,integer,text,text,text)') is null
  or to_regprocedure('public.levelblue_transition_enrollment(text,uuid,jsonb)') is null then
  raise exception 'Apply 20261106_cohort_promotion.sql and 20261107_enrollment_schedules.sql first.';
 end if;
end $$;

create table if not exists public.enrollment_advancement_plans (
 id uuid primary key default gen_random_uuid(),
 created_by text not null,
 from_year text not null,
 to_year text not null,
 run_on date not null,
 -- partial: some sections failed; failed: every section failed. Student skips alone do not fail a plan.
 status text not null default 'pending' check(status in ('pending','completed','partial','failed','cancelled')),
 summary jsonb not null default '{}',
 exclusions jsonb not null default '[]' check(jsonb_typeof(exclusions)='array'),
 created_at timestamptz not null default now(),
 cancelled_by text,
 cancelled_at timestamptz,
 executed_at timestamptz,
 result jsonb
);
-- One active school-wide plan at a time.
create unique index if not exists enrollment_advancement_one_pending on public.enrollment_advancement_plans(status) where status='pending';
alter table public.enrollment_advancement_plans enable row level security;
revoke all on public.enrollment_advancement_plans from public,anon,authenticated;
grant select,insert,update on public.enrollment_advancement_plans to service_role;

alter table public.enrollment_schedules add column if not exists plan_id uuid references public.enrollment_advancement_plans(id);
create index if not exists enrollment_schedules_plan on public.enrollment_schedules(plan_id) where plan_id is not null;

-- Read-only. Every active learner, grouped by authoritative section grade, with the reason the plan would
-- leave them out (null when included). Learners without a confirmed section grade are listed, not hidden.
create or replace function public.levelblue_advancement_candidates(p_from_year text)
returns jsonb language sql stable set search_path=public as $$
 with learners as (
  select st.id::text id,st.name,st.enrollment_version version,st.section_id,sec.name section_name,
   case
    when sec.scope_id is null then 'no-section'
    when sec.grade_level is null then 'unconfirmed-grade'
    when coalesce(nullif(trim(st.grade_level),''),sec.grade_level)<>sec.grade_level then 'grade-mismatch'
    when st.academic_year is not null and st.academic_year<>p_from_year then 'year-mismatch'
    when exists(select 1 from support_bounties b where (b.mentee_id::text=st.id::text or b.mentor_id::text=st.id::text) and b.cancelled_at is null and b.status in ('PENDING','AWAITING_LINK','ACCEPTED')) then 'active-mentor-bounty'
   end reason
  from students st left join sections sec on sec.scope_id=st.section_id
  where st.enrollment_status='active'
 )
 select jsonb_build_object(
  'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.scope_id,'name',s.name,'grade',s.grade_level,
    'action',case s.grade_level when 'Grade 11' then 'promote' else 'graduate' end,
    'students',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'version',l.version) order by l.name,l.id) from learners l where l.section_id=s.scope_id and l.reason is null),'[]'::jsonb),
    'excluded',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'reason',l.reason) order by l.name,l.id) from learners l where l.section_id=s.scope_id and l.reason is not null),'[]'::jsonb))
   order by s.grade_level,s.name,s.scope_id) from sections s where s.grade_level in ('Grade 11','Grade 12')),'[]'::jsonb),
  'unconfirmed',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'sectionId',l.section_id,'sectionName',l.section_name,'reason',l.reason) order by l.section_name nulls last,l.name,l.id) from learners l where l.reason in ('no-section','unconfirmed-grade')),'[]'::jsonb),
  'destinations',coalesce((select jsonb_agg(jsonb_build_object('id',s.scope_id,'name',s.name) order by s.name,s.scope_id) from sections s where s.grade_level='Grade 12'),'[]'::jsonb))
$$;

-- Without a year, suggests the school year most active Grade 11/12 learners are recorded in.
create or replace function public.levelblue_preview_school_advancement(p_actor text,p_from_year text default null)
returns jsonb language plpgsql stable set search_path=public as $$
declare v_year text:=nullif(trim(coalesce(p_from_year,'')),'');
begin
 perform 1 from users where id::text=p_actor and role='super' and status='Active';
 if not found then raise exception 'Only an active Principal can plan automatic advancement' using errcode='42501'; end if;
 if v_year is null then
  select st.academic_year into v_year from students st join sections s on s.scope_id=st.section_id
   where st.enrollment_status='active' and s.grade_level in ('Grade 11','Grade 12') and st.academic_year ~ '^20[0-9]{2}-20[0-9]{2}$'
   group by st.academic_year order by count(*) desc,st.academic_year desc limit 1;
  if v_year is null then return jsonb_build_object('fromYear',null,'toYear',null); end if;
 end if;
 if v_year !~ '^20[0-9]{2}-20[0-9]{2}$' or right(v_year,4)::int<>left(v_year,4)::int+1 then raise exception 'Use an academic year such as 2026-2027'; end if;
 return levelblue_advancement_candidates(v_year)||jsonb_build_object('fromYear',v_year,'toYear',(left(v_year,4)::int+1)::text||'-'||(right(v_year,4)::int+1)::text);
end $$;

-- Confirms the whole plan in one transaction. The reviewed student list must match the school's current
-- eligible learners exactly, so the plan targets what the Principal saw and never only one section.
create or replace function public.levelblue_create_school_advancement(p_actor text,p_request jsonb,p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare v_from text:=p_request->>'fromYear'; v_to text; v_run_on date; today date:=(p_now at time zone 'Asia/Manila')::date;
 destinations jsonb:=coalesce(p_request->'destinations','{}'::jsonb); candidates jsonb; included jsonb; reviewed jsonb; exclusions jsonb;
 sec jsonb; item jsonb; promote_count integer:=0; graduate_count integer:=0; section_count integer:=0; plan enrollment_advancement_plans;
begin
 perform 1 from users where id::text=p_actor and role='super' and status='Active' for share;
 if not found then raise exception 'Only an active Principal can schedule automatic advancement' using errcode='42501'; end if;
 if coalesce(p_request->>'runOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Choose a valid date'; end if;
 begin v_run_on:=(p_request->>'runOn')::date; exception when others then raise exception 'Choose a valid date'; end;
 if v_run_on<=today then raise exception 'Choose a future date (Asia/Manila)'; end if;
 if v_run_on>today+400 then raise exception 'Choose a date within the next 400 days'; end if;
 if v_from is null or v_from !~ '^20[0-9]{2}-20[0-9]{2}$' or right(v_from,4)::int<>left(v_from,4)::int+1 then raise exception 'Use an academic year such as 2026-2027'; end if;
 v_to:=(left(v_from,4)::int+1)::text||'-'||(right(v_from,4)::int+1)::text;
 if jsonb_typeof(destinations)<>'object' or jsonb_typeof(p_request->'students') is distinct from 'array'
  or exists(select 1 from jsonb_array_elements(p_request->'students') x where jsonb_typeof(x->'id') is distinct from 'string' or jsonb_typeof(x->'version') is distinct from 'number')
  then raise exception 'Invalid advancement plan'; end if;
 perform pg_advisory_xact_lock(hashtext('levelblue-school-advancement'));
 if exists(select 1 from enrollment_advancement_plans where status='pending') then raise exception 'An automatic advancement plan is already pending. Cancel it before creating another.'; end if;
 if exists(select 1 from enrollment_schedules where plan_id is null and status='pending') then raise exception 'Cancel the remaining individual section schedules before enabling school-wide advancement.'; end if;
 if exists(select 1 from enrollment_advancement_plans where status='completed' and from_year>=v_from) then raise exception 'School year % has already been advanced. Plan a later school year.',v_from; end if;
 perform 1 from sections where grade_level in ('Grade 11','Grade 12') order by scope_id for share;
 candidates:=levelblue_advancement_candidates(v_from);
 included:=coalesce((select jsonb_agg(jsonb_build_object('id',x->>'id','version',(x->>'version')::integer) order by x->>'id') from jsonb_array_elements(candidates->'sections') s,jsonb_array_elements(s->'students') x),'[]'::jsonb);
 reviewed:=coalesce((select jsonb_agg(jsonb_build_object('id',x->>'id','version',(x->>'version')::integer) order by x->>'id') from jsonb_array_elements(p_request->'students') x),'[]'::jsonb);
 if jsonb_array_length(included)=0 then raise exception 'No eligible Grade 11 or Grade 12 students for school year %',v_from; end if;
 if included<>reviewed then raise exception 'Enrollment changed since your review. Refresh the preview and review again.'; end if;
 if exists(select 1 from jsonb_each(destinations) d where jsonb_typeof(d.value)<>'string'
  or not exists(select 1 from jsonb_array_elements(candidates->'sections') s where s->>'id'=d.key and s->>'action'='promote' and jsonb_array_length(s->'students')>0))
  then raise exception 'Destinations are only for Grade 11 sections with students to promote'; end if;
 for sec in select value from jsonb_array_elements(candidates->'sections') where jsonb_array_length(value->'students')>0 loop
  if jsonb_array_length(sec->'students')>500 then raise exception '% has more than 500 students to advance. Split the section before scheduling.',sec->>'name'; end if;
  if sec->>'action'='promote' then
   perform 1 from sections where scope_id=destinations->>(sec->>'id') and grade_level='Grade 12' for share;
   if not found then raise exception 'Choose a Grade 12 destination for %',sec->>'name'; end if;
   promote_count:=promote_count+jsonb_array_length(sec->'students');
  else
   graduate_count:=graduate_count+jsonb_array_length(sec->'students');
  end if;
  section_count:=section_count+1;
  -- Locks each learner, as the per-section create does, so the captured versions hold at commit.
  for item in select value from jsonb_array_elements(sec->'students') order by value->>'id' loop
   if levelblue_schedule_skip_reason(item->>'id',(item->>'version')::integer,sec->>'id',sec->>'grade',v_from) is not null then
    raise exception 'Enrollment changed since your review. Refresh the preview and review again.';
   end if;
  end loop;
 end loop;
 exclusions:=coalesce((select jsonb_agg(jsonb_build_object('id',x->>'id','sectionId',s->>'id','reason',x->>'reason')) from jsonb_array_elements(candidates->'sections') s,jsonb_array_elements(s->'excluded') x),'[]'::jsonb)
  ||coalesce((select jsonb_agg(jsonb_build_object('id',x->>'id','sectionId',x->>'sectionId','reason',x->>'reason')) from jsonb_array_elements(candidates->'unconfirmed') x),'[]'::jsonb);
 insert into enrollment_advancement_plans(created_by,from_year,to_year,run_on,summary,exclusions,created_at)
  values(p_actor,v_from,v_to,v_run_on,jsonb_build_object('promote',promote_count,'graduate',graduate_count,'sections',section_count,'excluded',jsonb_array_length(exclusions)),exclusions,p_now)
  returning * into plan;
 insert into enrollment_schedules(plan_id,created_by,action,source_section,target_section,from_year,to_year,run_on,students,created_at)
  select plan.id,p_actor,s->>'action',s->>'id',case when s->>'action'='promote' then destinations->>(s->>'id') end,v_from,case when s->>'action'='promote' then v_to end,v_run_on,
   (select jsonb_agg(jsonb_build_object('id',x->>'id','version',(x->>'version')::integer) order by x->>'id') from jsonb_array_elements(s->'students') x),p_now
  from jsonb_array_elements(candidates->'sections') s where jsonb_array_length(s->'students')>0;
 insert into staff_events(actor_id,event_type,entity_id,details)
  values(p_actor,'enrollment-advancement-created',plan.id::text,plan.summary||jsonb_build_object('runOn',v_run_on,'fromYear',v_from,'toYear',v_to));
 return to_jsonb(plan);
end $$;

-- Cancels the plan and all of its pending section rows together. Locking the plan first matches the
-- runner's order, so cancellation waits for an in-progress run instead of deadlocking with it.
create or replace function public.levelblue_cancel_school_advancement(p_actor text,p_plan uuid,p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare plan enrollment_advancement_plans;
begin
 perform 1 from users where id::text=p_actor and role='super' and status='Active' for share;
 if not found then raise exception 'Only an active Principal can cancel automatic advancement' using errcode='42501'; end if;
 select * into plan from enrollment_advancement_plans where id=p_plan for update;
 if not found then raise exception 'Advancement plan not found' using errcode='P0002'; end if;
 if plan.status<>'pending' then raise exception 'Only a pending plan can be cancelled. This one is %.',plan.status; end if;
 update enrollment_schedules set status='cancelled',cancelled_by=p_actor,cancelled_at=p_now where plan_id=p_plan and status='pending';
 update enrollment_advancement_plans set status='cancelled',cancelled_by=p_actor,cancelled_at=p_now where id=p_plan returning * into plan;
 insert into staff_events(actor_id,event_type,entity_id,details) values(p_actor,'enrollment-advancement-cancelled',plan.id::text,jsonb_build_object('runOn',plan.run_on,'fromYear',plan.from_year));
 return to_jsonb(plan);
end $$;

-- Runs one section row in its own subtransaction, so an unexpected failure is recorded on that row only.
create or replace function public.levelblue_process_enrollment_schedule(s public.enrollment_schedules,p_now timestamptz)
returns jsonb language plpgsql set search_path=public as $$
declare outcome jsonb;
begin
 begin
  outcome:=levelblue_execute_enrollment_schedule(s);
 exception when others then
  outcome:=jsonb_build_object('status','failed','error',left(sqlerrm,300));
 end;
 update enrollment_schedules set status=outcome->>'status',executed_at=p_now,result=outcome where id=s.id;
 insert into staff_events(actor_id,event_type,entity_id,details)
  values(s.created_by,'enrollment-schedule-'||(outcome->>'status'),s.id::text,outcome||case when s.plan_id is null then '{}'::jsonb else jsonb_build_object('planId',s.plan_id) end);
 return outcome;
end $$;

-- Called by the scheduler. Due plans run first: each plan is locked before its section rows, and SKIP LOCKED
-- lets an overlapping run pass over a plan another run is processing. Every row leaves 'pending' in the same
-- transaction that moves its learners, and its ID is the transition batch ID, so nobody moves twice.
-- Individual section schedules created before this migration still run as before.
create or replace function public.levelblue_run_due_enrollment_schedules(p_now timestamptz default now())
returns jsonb language plpgsql set search_path=public as $$
declare p enrollment_advancement_plans; s enrollment_schedules; outcome jsonb; outcomes jsonb:='[]'; plans jsonb:='[]';
 tally record; v_status text; v_result jsonb; today date:=(p_now at time zone 'Asia/Manila')::date;
begin
 for p in select * from enrollment_advancement_plans where status='pending' and run_on<=today order by run_on,created_at for update skip locked loop
  for s in select * from enrollment_schedules where plan_id=p.id and status='pending' order by case action when 'graduate' then 0 else 1 end,source_section for update loop
   outcome:=levelblue_process_enrollment_schedule(s,p_now);
   outcomes:=outcomes||jsonb_build_array(jsonb_build_object('id',s.id,'planId',p.id,'status',outcome->>'status'));
  end loop;
  select count(*) filter(where status='completed') done,count(*) filter(where status='failed') failed,
   coalesce(sum((result->>'processed')::integer) filter(where status='completed'),0) processed,
   coalesce(sum(jsonb_array_length(coalesce(result->'skipped','[]'::jsonb))),0) skipped
   into tally from enrollment_schedules where plan_id=p.id;
  v_status:=case when tally.failed=0 then 'completed' when tally.done=0 then 'failed' else 'partial' end;
  v_result:=jsonb_build_object('sections',tally.done+tally.failed,'completed',tally.done,'failed',tally.failed,'processed',tally.processed,'skipped',tally.skipped);
  update enrollment_advancement_plans set status=v_status,executed_at=p_now,result=v_result where id=p.id;
  insert into staff_events(actor_id,event_type,entity_id,details) values(p.created_by,'enrollment-advancement-'||v_status,p.id::text,v_result);
  plans:=plans||jsonb_build_array(jsonb_build_object('id',p.id,'status',v_status));
 end loop;
 for s in select * from enrollment_schedules where plan_id is null and status='pending' and run_on<=today order by run_on,created_at for update skip locked loop
  outcome:=levelblue_process_enrollment_schedule(s,p_now);
  outcomes:=outcomes||jsonb_build_array(jsonb_build_object('id',s.id,'status',outcome->>'status'));
 end loop;
 return jsonb_build_object('processed',jsonb_array_length(outcomes),'schedules',outcomes,'plans',plans);
end $$;

-- Supabase grants new functions to anon, authenticated and service_role directly, so revoke from each.
revoke all on function public.levelblue_advancement_candidates(text),
 public.levelblue_preview_school_advancement(text,text),
 public.levelblue_create_school_advancement(text,jsonb,timestamptz),
 public.levelblue_cancel_school_advancement(text,uuid,timestamptz),
 public.levelblue_process_enrollment_schedule(public.enrollment_schedules,timestamptz),
 public.levelblue_run_due_enrollment_schedules(timestamptz) from public,anon,authenticated,service_role;
-- The web backend previews, creates and cancels plans; these run with the caller's privileges, so it also
-- needs the read-only candidate list. The processor and runner stay with the owner, which pg_cron runs as.
grant execute on function public.levelblue_advancement_candidates(text),
 public.levelblue_preview_school_advancement(text,text),
 public.levelblue_create_school_advancement(text,jsonb,timestamptz),
 public.levelblue_cancel_school_advancement(text,uuid,timestamptz) to service_role;
-- New individual section schedules would compete with the school-wide plan. Pending ones can still be cancelled.
revoke execute on function public.levelblue_create_enrollment_schedule(text,jsonb,timestamptz) from service_role;
commit;
notify pgrst,'reload schema';

-- Scheduler: unchanged. The job registered for 20261107_enrollment_schedules.sql
-- ('levelblue-enrollment-schedules', hourly at :05 UTC, run as postgres) calls the replaced runner above.
-- If it is not registered yet, follow the activation note at the end of that file. A plan runs at the first
-- tick on or after 00:00 Asia/Manila of its date, and a missed tick is caught up by the next one.

-- Rollback (manual; requires explicit approval; never run automatically):
--   1. Disable the scheduler first so no run starts during rollback:
--        select cron.unschedule('levelblue-enrollment-schedules');
--   2. Cancel any pending plan in the Automatic Advancement tab. A pending plan's section rows would otherwise
--      run as individual schedules under the previous runner.
--   3. If necessary, revert the web backend/frontend to a version without the Automatic Advancement routes/tab.
--   4. Restore the previous runner by re-running only the levelblue_run_due_enrollment_schedules definition from
--      20261107_enrollment_schedules.sql, then restore its grant for the web backend if that version is used:
--        grant execute on function public.levelblue_create_enrollment_schedule(text,jsonb,timestamptz) to service_role;
--   5. Drop the plan functions, callers before callees:
--        drop function if exists public.levelblue_create_school_advancement(text,jsonb,timestamptz);
--        drop function if exists public.levelblue_cancel_school_advancement(text,uuid,timestamptz);
--        drop function if exists public.levelblue_preview_school_advancement(text,text);
--        drop function if exists public.levelblue_advancement_candidates(text);
--        drop function if exists public.levelblue_process_enrollment_schedule(public.enrollment_schedules,timestamptz);
--   6. Only after confirming the plan records are no longer needed (export them first if in doubt):
--        alter table public.enrollment_schedules drop column if exists plan_id;
--        drop table if exists public.enrollment_advancement_plans;
--   7. enrollment_history, enrollment_batches, enrollment_schedules and staff_events rows remain intact, and
--      schema rollback does not reverse students already promoted or graduated by a plan.
--   8. Execute these statements manually only after the rollback has been approved.
