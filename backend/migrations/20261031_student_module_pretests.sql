-- Apply after 20261008_player_saves.sql in the shared Supabase project (web + mobile APIs).
-- Additive: adds students.module_pretests so the mobile API records pre-test completion together
-- with mastery and score in one students update. Before this column existed, completion flags
-- lived in player_saves.payload, where concurrent progress uploads could overwrite them.
-- Mastery columns, BKT records, lessons, wallets and player_saves payloads are not modified.
-- Rollback: do not drop the column; see the deployment notes in the mobile repository
-- (LevelBluer/docs/pretest_schema_migration.md). Completions recorded after this migration
-- exist only in this column.
begin;

do $$
declare existing_type text; unsupported_rows bigint;
begin
  select data_type into existing_type from information_schema.columns
   where table_schema = 'public' and table_name = 'students' and column_name = 'module_pretests';
  if existing_type is null then
    alter table public.students add column module_pretests jsonb not null default '{}'::jsonb;
  elsif existing_type <> 'jsonb' then
    raise exception 'students.module_pretests already exists as %, expected jsonb. Convert it manually before applying this migration.', existing_type;
  else
    -- A hand-made jsonb column may allow nulls; the API's conditional update needs an object.
    -- Arrays, strings and other shapes may hold completion flags, so stop instead of resetting them.
    select count(*) into unsupported_rows from public.students
     where module_pretests is not null and jsonb_typeof(module_pretests) <> 'object';
    if unsupported_rows > 0 then
      raise exception '% students.module_pretests values are not JSON objects. Convert them to objects such as {"mod_01": true} manually before applying this migration.', unsupported_rows;
    end if;
    update public.students set module_pretests = '{}'::jsonb where module_pretests is null;
    alter table public.students alter column module_pretests set default '{}'::jsonb;
    alter table public.students alter column module_pretests set not null;
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'students_module_pretests_object'
                    and conrelid = 'public.students'::regclass) then
    alter table public.students add constraint students_module_pretests_object
      check (jsonb_typeof(module_pretests) = 'object');
  end if;
end $$;

-- Backfill flags recorded by the legacy fallback. Accepts the two stored shapes:
-- {"mod_01": true} (pre-test API) and ["mod_01"] (mobile progress upload). Only known module ids
-- are copied; existing column flags are kept. Idempotent: rerunning changes nothing.
-- JSON-encoded string flags are not cast here (a bad string would abort the transaction);
-- the API keeps reading them from player_saves while the column has no flags.
with legacy as (
  select ps.student_id, flag.module_id
    from public.player_saves ps
    cross join lateral (
      -- Guard the set-returning calls: they raise on the wrong JSON type even inside WHERE.
      select key as module_id
        from jsonb_each(case when jsonb_typeof(ps.payload->'module_pretests') = 'object'
                             then ps.payload->'module_pretests' else '{}'::jsonb end)
       -- Same falsy values as the API parser (Python bool()); 0.0 compares equal to 0.
       where value not in ('false'::jsonb, 'null'::jsonb, '0'::jsonb, '""'::jsonb, '{}'::jsonb, '[]'::jsonb)
      union
      select value #>> '{}'
        from jsonb_array_elements(case when jsonb_typeof(ps.payload->'module_pretests') = 'array'
                                       then ps.payload->'module_pretests' else '[]'::jsonb end)
    ) flag
   where flag.module_id in ('mod_01', 'mod_02', 'mod_03', 'mod_04', 'mod_05')
), merged as (
  select student_id, jsonb_object_agg(module_id, true) as flags
    from legacy group by student_id
)
update public.students s
   set module_pretests = s.module_pretests || m.flags
  from merged m
 where s.id = m.student_id
   and not (s.module_pretests @> m.flags);

notify pgrst, 'reload schema';
commit;
