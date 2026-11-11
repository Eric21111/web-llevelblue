-- Apply after 20261015_assessment_responses.sql. Additive: no existing learning, student or history rows change,
-- and nothing is enforced by this file. Safe to apply before the mobile app reports chapters.
-- Adds first-completion chapter evidence: one 'chapter' learning record per student, module and chapter, sent by
-- the mobile app when a story chapter (mod_0X_ch_0Y) is completed for the first time. Perk-assisted completions
-- count and keep data.assist_status ('assisted', 'unassisted' or 'unknown') so staff can see them.
-- Legacy progress is never inferred from saves: students without chapter records stay "Completion Not Verified".
-- Promotion enforcement is a separate file: 20261111_promotion_enforcement.sql.
begin;
do $$
declare c record;
begin
 if to_regclass('public.learning_records') is null or to_regprocedure('public.levelblue_record_learning(uuid,jsonb)') is null then
  raise exception 'Apply 20261008_learning_records.sql and 20261015_assessment_responses.sql first.';
 end if;
 -- The original inline kind check has a generated name, so find it by definition.
 for c in select conname from pg_constraint where conrelid='public.learning_records'::regclass and contype='c'
  and pg_get_constraintdef(oid) like '%kind%' and pg_get_constraintdef(oid) like '%mastery%' loop
  execute format('alter table public.learning_records drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.learning_records add constraint learning_records_kind_check
 check (kind in ('pretest','posttest','stage','mastery','chapter'));
alter table public.learning_records add constraint learning_records_chapter_shape check (kind<>'chapter' or (
 data->>'chapter' in ('1','2','3','4','5')
 and data->>'chapter_id'=module_id||'_ch_0'||(data->>'chapter')
 and coalesce(data->>'assist_status','unknown') in ('assisted','unassisted','unknown')));
-- First completion only: a replayed or repeated completion of the same chapter adds nothing.
create unique index if not exists learning_records_chapter_completion
 on public.learning_records(student_id,module_id,(data->>'chapter')) where kind='chapter';

-- Same as 20261015_assessment_responses.sql, except that a later completion of an already recorded chapter,
-- sent with a new event ID (for example after reinstalling), is skipped instead of failing the whole upload.
create or replace function public.levelblue_record_learning(p_student uuid, p_events jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare item jsonb; existing public.learning_records; inserted integer;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 100 then
    raise exception 'Invalid learning batch';
  end if;
  for item in select value from jsonb_array_elements(p_events) loop
    if item->>'kind'='chapter' and exists(select 1 from public.learning_records
      where student_id=p_student and kind='chapter' and module_id=item->>'module_id'
        and data->>'chapter'=item->'data'->>'chapter' and event_id<>(item->>'event_id')::uuid) then
      continue;
    end if;
    insert into public.learning_records(student_id,event_id,kind,module_id,occurred_at,data)
    values(p_student,(item->>'event_id')::uuid,item->>'kind',item->>'module_id',
      (item->>'occurred_at')::timestamptz,item->'data')
    on conflict(student_id,event_id) do nothing;
    get diagnostics inserted = row_count;
    if inserted = 0 then
      select * into existing from public.learning_records
        where student_id=p_student and event_id=(item->>'event_id')::uuid;
      if existing.kind is distinct from item->>'kind'
        or existing.module_id is distinct from item->>'module_id'
        or existing.occurred_at is distinct from (item->>'occurred_at')::timestamptz
        or (existing.data is distinct from item->'data'
          and not (existing.kind in ('pretest','posttest')
            and not (existing.data ? 'responses')
            and existing.data = ((item->'data') - 'responses' - 'response_version'))) then
        raise exception 'Learning event ID already used with different content';
      end if;
    end if;
  end loop;
end $$;

-- Read-only. Null when all five modules have all five chapters recorded; otherwise
-- 'completion-not-verified' (no chapter evidence at all) or 'modules-incomplete'.
-- Pre-tests, mastery and legacy stage results are separate measures and never count as completion.
create or replace function public.levelblue_promotion_blocker(p_student text)
returns text language plpgsql stable set search_path=public as $$
declare chapters integer:=0;
begin
 if p_student ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  select count(distinct (r.module_id,r.data->>'chapter')) into chapters from learning_records r
   where r.student_id=p_student::uuid and r.kind='chapter';
 end if;
 return case when chapters=25 then null when chapters=0 then 'completion-not-verified' else 'modules-incomplete' end;
end $$;

-- Supabase grants new functions to anon, authenticated and service_role directly, so revoke from each.
revoke all on function public.levelblue_record_learning(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.levelblue_record_learning(uuid,jsonb) to service_role;
revoke all on function public.levelblue_promotion_blocker(text) from public,anon,authenticated,service_role;
grant execute on function public.levelblue_promotion_blocker(text) to service_role;
commit;
notify pgrst,'reload schema';

-- Deployment order:
--   1. Apply this file. Nothing changes for staff; every Grade 11 student shows "Completion Not Verified".
--   2. Release the mobile API and app that send kind='chapter' events (separate approved task).
--   3. Only after chapter evidence is flowing and reviewed, apply 20261111_promotion_enforcement.sql.

-- Rollback (manual; requires explicit approval; never run automatically):
--   1. Roll back 20261111_promotion_enforcement.sql first if it was applied.
--   2. Stop the mobile release that sends chapter events, or the API will reject them after step 4.
--   3. Re-run only the levelblue_record_learning definition from 20261015_assessment_responses.sql, then:
--        drop function if exists public.levelblue_promotion_blocker(text);
--        drop index if exists public.learning_records_chapter_completion;
--        alter table public.learning_records drop constraint if exists learning_records_chapter_shape;
--   4. Only after exporting chapter records if they are needed:
--        delete from public.learning_records where kind='chapter';
--        alter table public.learning_records drop constraint learning_records_kind_check,
--         add constraint learning_records_kind_check check (kind in ('pretest','posttest','stage','mastery'));
