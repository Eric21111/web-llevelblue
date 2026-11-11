-- Apply after 20261111_chapter_evidence.sql, and only once the mobile app is reporting chapter completions:
-- from this point no Grade 11 student is promoted without all five modules verified complete.
-- Additive: no student, history or learning rows change. Graduation is unaffected.
-- Enforcement sits where every promotion is recorded. Manual checklists and Automatic Advancement both insert
-- enrollment_history rows inside levelblue_transition_enrollment, so the check runs inside that transaction, at
-- execution time, after the learner is locked. Automatic Advancement also skips not-ready learners with a recorded
-- reason instead of failing the whole section, and leaves them out of new plans.
begin;
do $$
begin
 if to_regprocedure('public.levelblue_promotion_blocker(text)') is null then
  raise exception 'Apply 20261111_chapter_evidence.sql first.';
 end if;
 if to_regclass('public.enrollment_history') is null
  or to_regprocedure('public.levelblue_schedule_skip_reason(text,integer,text,text,text)') is null
  or to_regprocedure('public.levelblue_advancement_candidates(text)') is null then
  raise exception 'Apply 20261011_enrollment.sql, 20261107_enrollment_schedules.sql and 20261108_school_advancement.sql first.';
 end if;
end $$;

create or replace function public.levelblue_guard_promotion_readiness() returns trigger language plpgsql set search_path=public as $$
begin
 if new.action='promote' and levelblue_promotion_blocker(new.student_id) is not null then
  raise exception 'Not yet ready for promotion: all five LevelBlue modules must be verified complete. Reload the checklist and review.';
 end if;
 return new;
end $$;
drop trigger if exists levelblue_guard_promotion_readiness on public.enrollment_history;
create trigger levelblue_guard_promotion_readiness before insert on public.enrollment_history
 for each row execute function public.levelblue_guard_promotion_readiness();

-- Same as 20261107_enrollment_schedules.sql, plus the readiness check for Grade 11 promotion.
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
 if p_grade='Grade 11' and levelblue_promotion_blocker(learner.id::text) is not null then return 'not-ready-for-promotion'; end if;
 return null;
end $$;

-- Same as 20261108_school_advancement.sql, plus the readiness reason for Grade 11 learners.
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
    when sec.grade_level='Grade 11' and levelblue_promotion_blocker(st.id::text) is not null then 'not-ready-for-promotion'
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

-- Lets the web dashboard tell staff whether readiness is enforced or still advisory.
create or replace function public.levelblue_promotion_enforced() returns boolean language sql stable set search_path=public as $$
 select exists(select 1 from pg_trigger where tgname='levelblue_guard_promotion_readiness' and tgrelid='public.enrollment_history'::regclass and tgenabled<>'D')
$$;

-- Supabase grants new functions to anon, authenticated and service_role directly, so revoke from each.
revoke all on function public.levelblue_guard_promotion_readiness(),
 public.levelblue_schedule_skip_reason(text,integer,text,text,text),
 public.levelblue_advancement_candidates(text),
 public.levelblue_promotion_enforced() from public,anon,authenticated,service_role;
grant execute on function public.levelblue_schedule_skip_reason(text,integer,text,text,text),
 public.levelblue_advancement_candidates(text),
 public.levelblue_promotion_enforced() to service_role;
commit;
notify pgrst,'reload schema';

-- Pending Automatic Advancement plans created before this file still run: each Grade 11 learner is rechecked at
-- execution and skipped with reason 'not-ready-for-promotion' if not ready.

-- Rollback (manual; requires explicit approval; never run automatically):
--   1. drop trigger if exists levelblue_guard_promotion_readiness on public.enrollment_history;
--      drop function if exists public.levelblue_guard_promotion_readiness();
--      drop function if exists public.levelblue_promotion_enforced();
--   2. Re-run only the levelblue_schedule_skip_reason definition from 20261107_enrollment_schedules.sql and the
--      levelblue_advancement_candidates definition from 20261108_school_advancement.sql, with their grants.
--   3. The dashboard then shows readiness as advisory again. Students already promoted stay promoted.
--   4. Execute these statements manually only after the rollback has been approved.
