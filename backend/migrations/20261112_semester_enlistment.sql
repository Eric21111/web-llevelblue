-- Apply after 20261011_enrollment.sql. Additive: no student, section, history or learning rows change.
-- Semester enlistment records which students belong to a section in a given academic year and semester, so a
-- past period's roster stays intact after later enlistment, promotion or graduation. It never updates students:
-- grade, current section, academic year and enrollment_version stay owned by levelblue_transition_enrollment,
-- so a new semester never promotes anyone and the mobile app sees no change.
-- Membership is explicit: existing students are not backfilled into any period. Staff may record a past
-- membership for a current or former member of a section; such rows are flagged and carry the staff note.
-- A mistaken enlistment is withdrawn with a reason and kept, never deleted.
begin;
do $$
begin
 if to_regclass('public.enrollment_batches') is null or to_regclass('public.sections') is null then
  raise exception 'Apply 20261011_enrollment.sql first: public.enrollment_batches and public.sections are required.';
 end if;
end $$;

create table if not exists public.academic_periods (
 id text primary key,
 academic_year text not null check(academic_year ~ '^20[0-9]{2}-20[0-9]{2}$' and right(academic_year,4)::int=left(academic_year,4)::int+1),
 semester smallint not null check(semester in (1,2)),
 created_by text not null,
 created_at timestamptz not null default now(),
 unique(academic_year,semester),
 check(id=academic_year||'-S'||semester)
);
create table if not exists public.section_enlistments (
 id uuid primary key default gen_random_uuid(),
 -- Shares the enrollment request ledger, so one request ID can never mean two different changes.
 batch_id uuid not null references public.enrollment_batches(id),
 period_id text not null references public.academic_periods(id),
 section_id text not null references public.sections(scope_id),
 student_id text not null,
 -- The section grade at enlistment, so a past roster still reads correctly after promotion.
 grade_level text not null check(grade_level in ('Grade 11','Grade 12')),
 enlisted_by text not null,
 enlisted_at timestamptz not null default now(),
 -- True when staff recorded the membership afterwards, for a student who may have moved since.
 recorded_retroactively boolean not null default false,
 note text,
 withdrawn_by text,
 withdrawn_at timestamptz,
 withdrawal_reason text,
 check((withdrawn_at is null)=(withdrawn_by is null) and (withdrawn_at is null)=(withdrawal_reason is null)),
 check(recorded_retroactively=(note is not null) and (note is null or length(trim(note)) between 3 and 300))
);
-- One active section per student per period. Withdrawn rows remain as history.
create unique index if not exists section_enlistments_one_active on public.section_enlistments(period_id,student_id) where withdrawn_at is null;
create index if not exists section_enlistments_roster on public.section_enlistments(period_id,section_id);
create index if not exists section_enlistments_student on public.section_enlistments(student_id);
alter table public.academic_periods enable row level security;
alter table public.section_enlistments enable row level security;
revoke all on public.academic_periods,public.section_enlistments from public,anon,authenticated,service_role;
-- The web backend reads directly; every write goes through the functions below.
grant select on public.academic_periods,public.section_enlistments to service_role;

create or replace function public.levelblue_create_academic_period(p_actor text,p_year text,p_semester integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare period academic_periods;
begin
 perform 1 from users where id::text=p_actor and role='super' and status='Active' for share;
 if not found then raise exception 'Only an active Principal can add an enlistment period' using errcode='42501'; end if;
 if p_year is null or p_year !~ '^20[0-9]{2}-20[0-9]{2}$' or right(p_year,4)::int<>left(p_year,4)::int+1 then raise exception 'Use an academic year such as 2026-2027'; end if;
 if p_semester is null or p_semester not in (1,2) then raise exception 'Choose Semester 1 or Semester 2'; end if;
 insert into academic_periods(id,academic_year,semester,created_by) values(p_year||'-S'||p_semester,p_year,p_semester,p_actor)
  on conflict do nothing returning * into period;
 if period.id is null then raise exception '% Semester % already exists',p_year,p_semester; end if;
 insert into staff_events(actor_id,event_type,entity_id,details) values(p_actor,'enlistment-period-created',period.id,jsonb_build_object('academicYear',p_year,'semester',p_semester));
 return to_jsonb(period);
end $$;

-- Enlists selected students who are currently active in the section. Students already enlisted in this section
-- for the period are left unchanged; a student enlisted in another section for the period is rejected.
create or replace function public.levelblue_enlist_students(p_actor text,p_batch uuid,p_request jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_role text; period academic_periods; section sections; learner students; item jsonb; old_batch enrollment_batches;
 existing section_enlistments; amount integer; added integer:=0; kept integer:=0;
begin
 select role into actor_role from users where id::text=p_actor and status='Active' for share;
 if actor_role is null or actor_role not in ('admin','super') then raise exception 'Active staff required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(p_batch::text));
 select * into old_batch from enrollment_batches where id=p_batch;
 if found then
  if old_batch.actor_id<>p_actor or old_batch.request<>p_request then raise exception 'Request ID was already used for a different checklist'; end if;
  return jsonb_build_object('count',(select count(*) from section_enlistments where batch_id=p_batch),'unchanged',0,'replayed',true);
 end if;
 if jsonb_typeof(p_request->'students') is distinct from 'array' then raise exception 'Invalid enlistment'; end if;
 amount:=jsonb_array_length(p_request->'students');
 if amount<1 or amount>500 or (select count(distinct x->>'id') from jsonb_array_elements(p_request->'students') x)<>amount
  or exists(select 1 from jsonb_array_elements(p_request->'students') x where jsonb_typeof(x->'id') is distinct from 'string' or jsonb_typeof(x->'version') is distinct from 'number')
  then raise exception 'Choose 1 to 500 distinct students'; end if;
 select * into period from academic_periods where id=p_request->>'periodId' for share;
 if not found then raise exception 'Enlistment period not found' using errcode='P0002'; end if;
 select * into section from sections where scope_id=p_request->>'sectionId' for share;
 if not found then raise exception 'Section not found' using errcode='P0002'; end if;
 if actor_role='admin' and not exists(select 1 from teacher_sections where teacher_id=p_actor and section_id=section.scope_id) then
  raise exception 'This section is not assigned to you' using errcode='42501';
 end if;
 if section.grade_level is null or section.grade_level not in ('Grade 11','Grade 12') then raise exception 'Confirm the section grade before enlisting students'; end if;
 insert into enrollment_batches(id,actor_id,request) values(p_batch,p_actor,p_request);
 for item in select value from jsonb_array_elements(p_request->'students') order by value->>'id' loop
  select * into learner from students where id::text=item->>'id' for update;
  if not found or learner.enrollment_status<>'active' or learner.section_id is distinct from section.scope_id
   or learner.enrollment_version is distinct from (item->>'version')::integer
   or coalesce(nullif(trim(learner.grade_level),''),section.grade_level)<>section.grade_level
   or (learner.academic_year is not null and learner.academic_year<>period.academic_year)
   then raise exception 'Enlistment changed or does not match this roster; reload and review'; end if;
  select * into existing from section_enlistments where period_id=period.id and student_id=learner.id::text and withdrawn_at is null;
  if found then
   if existing.section_id<>section.scope_id then raise exception '% is already enlisted in another section for this period',learner.name; end if;
   kept:=kept+1;
  else
   insert into section_enlistments(batch_id,period_id,section_id,student_id,grade_level,enlisted_by)
    values(p_batch,period.id,section.scope_id,learner.id::text,section.grade_level,p_actor);
   added:=added+1;
  end if;
 end loop;
 insert into staff_events(actor_id,event_type,entity_id,details)
  values(p_actor,'enlistment-period-enlisted',p_batch::text,jsonb_build_object('periodId',period.id,'sectionId',section.scope_id,'added',added,'unchanged',kept));
 return jsonb_build_object('count',added,'unchanged',kept,'replayed',false);
end $$;

-- Records a past membership. Only students with a recorded link to the section (current members, or a move
-- into or out of it in enrollment_history) qualify, so this never invents a placement. Current enrollment,
-- version and progress are not checked or changed.
create or replace function public.levelblue_record_past_enlistment(p_actor text,p_batch uuid,p_request jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_role text; period academic_periods; section sections; learner students; v_student text; old_batch enrollment_batches;
 existing section_enlistments; amount integer; added integer:=0; kept integer:=0; v_note text:=trim(coalesce(p_request->>'note',''));
begin
 select role into actor_role from users where id::text=p_actor and status='Active' for share;
 if actor_role is null or actor_role not in ('admin','super') then raise exception 'Active staff required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(p_batch::text));
 select * into old_batch from enrollment_batches where id=p_batch;
 if found then
  if old_batch.actor_id<>p_actor or old_batch.request<>p_request then raise exception 'Request ID was already used for a different checklist'; end if;
  return jsonb_build_object('count',(select count(*) from section_enlistments where batch_id=p_batch),'unchanged',0,'replayed',true);
 end if;
 if jsonb_typeof(p_request->'students') is distinct from 'array' then raise exception 'Invalid enlistment'; end if;
 amount:=jsonb_array_length(p_request->'students');
 if amount<1 or amount>500 or (select count(distinct x) from jsonb_array_elements_text(p_request->'students') x)<>amount
  or exists(select 1 from jsonb_array_elements(p_request->'students') x where jsonb_typeof(x) is distinct from 'string')
  then raise exception 'Choose 1 to 500 distinct students'; end if;
 if length(v_note) not between 3 and 300 then raise exception 'Explain the past membership in 3 to 300 characters'; end if;
 select * into period from academic_periods where id=p_request->>'periodId' for share;
 if not found then raise exception 'Enlistment period not found' using errcode='P0002'; end if;
 select * into section from sections where scope_id=p_request->>'sectionId' for share;
 if not found then raise exception 'Section not found' using errcode='P0002'; end if;
 if actor_role='admin' and not exists(select 1 from teacher_sections where teacher_id=p_actor and section_id=section.scope_id) then
  raise exception 'This section is not assigned to you' using errcode='42501';
 end if;
 if section.grade_level is null or section.grade_level not in ('Grade 11','Grade 12') then raise exception 'Confirm the section grade before recording students'; end if;
 insert into enrollment_batches(id,actor_id,request) values(p_batch,p_actor,p_request);
 for v_student in select value from jsonb_array_elements_text(p_request->'students') order by value loop
  select * into learner from students where id::text=v_student for update;
  if not found then raise exception 'Student not found; reload and review'; end if;
  if learner.section_id is distinct from section.scope_id and not exists(select 1 from enrollment_history h where h.student_id=learner.id::text and section.scope_id in (h.from_section,h.to_section)) then
   raise exception '% has no recorded membership in this section',learner.name;
  end if;
  select * into existing from section_enlistments where period_id=period.id and section_enlistments.student_id=learner.id::text and withdrawn_at is null;
  if found then
   if existing.section_id<>section.scope_id then raise exception '% is already enlisted in another section for this period',learner.name; end if;
   kept:=kept+1;
  else
   insert into section_enlistments(batch_id,period_id,section_id,student_id,grade_level,enlisted_by,recorded_retroactively,note)
    values(p_batch,period.id,section.scope_id,learner.id::text,section.grade_level,p_actor,true,v_note);
   added:=added+1;
  end if;
 end loop;
 insert into staff_events(actor_id,event_type,entity_id,details)
  values(p_actor,'enlistment-period-recorded',p_batch::text,jsonb_build_object('periodId',period.id,'sectionId',section.scope_id,'added',added,'unchanged',kept,'note',v_note));
 return jsonb_build_object('count',added,'unchanged',kept,'replayed',false);
end $$;

-- Sections with semester history are kept. Raised before the foreign key so staff see a clear reason.
create or replace function public.levelblue_guard_section_history() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if exists(select 1 from section_enlistments where section_id=old.scope_id) then
  raise exception 'This section has semester roster history. Keep it so past rosters stay intact.';
 end if;
 return old;
end $$;
drop trigger if exists levelblue_guard_section_history on public.sections;
create trigger levelblue_guard_section_history before delete on public.sections for each row execute function public.levelblue_guard_section_history();

-- Corrects a mistaken enlistment. The row stays in the period's history with who withdrew it and why.
create or replace function public.levelblue_withdraw_enlistment(p_actor text,p_enlistment uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_role text; entry section_enlistments; reason text:=trim(coalesce(p_reason,''));
begin
 select role into actor_role from users where id::text=p_actor and status='Active' for share;
 if actor_role is null or actor_role not in ('admin','super') then raise exception 'Active staff required' using errcode='42501'; end if;
 if length(reason) not between 3 and 300 then raise exception 'Give a reason of 3 to 300 characters'; end if;
 select * into entry from section_enlistments where id=p_enlistment for update;
 if not found or (actor_role='admin' and not exists(select 1 from teacher_sections where teacher_id=p_actor and section_id=entry.section_id)) then
  raise exception 'Enlistment not found' using errcode='P0002';
 end if;
 if entry.withdrawn_at is not null then raise exception 'This enlistment was already withdrawn'; end if;
 update section_enlistments set withdrawn_by=p_actor,withdrawn_at=now(),withdrawal_reason=reason where id=p_enlistment returning * into entry;
 insert into staff_events(actor_id,event_type,entity_id,details)
  values(p_actor,'enlistment-period-withdrawn',entry.id::text,jsonb_build_object('periodId',entry.period_id,'sectionId',entry.section_id,'studentId',entry.student_id,'reason',reason));
 return to_jsonb(entry);
end $$;

-- Supabase grants new functions to anon, authenticated and service_role directly, so revoke from each.
revoke all on function public.levelblue_create_academic_period(text,text,integer),
 public.levelblue_enlist_students(text,uuid,jsonb),
 public.levelblue_record_past_enlistment(text,uuid,jsonb),
 public.levelblue_withdraw_enlistment(text,uuid,text),
 public.levelblue_guard_section_history() from public,anon,authenticated,service_role;
grant execute on function public.levelblue_create_academic_period(text,text,integer),
 public.levelblue_enlist_students(text,uuid,jsonb),
 public.levelblue_record_past_enlistment(text,uuid,jsonb),
 public.levelblue_withdraw_enlistment(text,uuid,text) to service_role;
commit;
notify pgrst,'reload schema';

-- Rollback (manual; requires explicit approval; never run automatically):
--   1. If necessary, revert the web backend/frontend to a version without the Semester rosters tab and
--      /api/enrollment/periods routes. Until then the tab reports that this migration is missing.
--   2. Drop the trigger and functions:
--        drop trigger if exists levelblue_guard_section_history on public.sections;
--        drop function if exists public.levelblue_guard_section_history();
--        drop function if exists public.levelblue_record_past_enlistment(text,uuid,jsonb);
--        drop function if exists public.levelblue_withdraw_enlistment(text,uuid,text);
--        drop function if exists public.levelblue_enlist_students(text,uuid,jsonb);
--        drop function if exists public.levelblue_create_academic_period(text,text,integer);
--   3. Only after exporting the period rosters if they are needed:
--        drop table if exists public.section_enlistments;
--        drop table if exists public.academic_periods;
--   4. enrollment_batches and staff_events rows written by enlistment remain intact.
