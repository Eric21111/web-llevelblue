-- Apply after 20261031_student_module_pretests.sql in the shared Supabase project (web + mobile APIs).
-- Atomic mastery writes for the mobile API: progress sync and the official pre-test each update
-- students.mastery_* and bkt_records in one transaction, holding the student row lock.
-- Additive except for widening bkt_records.probability_known from numeric(4,3) to numeric, which
-- keeps every stored value and does not rewrite the table. Existing rows are not modified.
-- Apply this before deploying the mobile API that calls these functions; that API has no
-- non-atomic fallback. Rollback: revert the API first, then drop both functions. Narrowing the
-- column again rounds every stored value to 3 decimals.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- 0. Prerequisites. Any failure aborts before a change is made.
do $$
declare
  v_def text;
  v_pre text;
begin
  if exists (select 1 from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname in ('levelblue_write_mastery', 'levelblue_record_pretest_result')) then
    raise exception 'Atomic mastery functions already exist; review them before applying this migration';
  end if;

  -- SECURITY DEFINER runs as the applying role, which must not be subject to row-level security.
  if not (select r.rolbypassrls from pg_roles r where r.rolname = current_user)
     and not (pg_has_role(current_user,
                (select c.relowner from pg_class c where c.oid = 'public.students'::regclass), 'USAGE')
              and pg_has_role(current_user,
                (select c.relowner from pg_class c where c.oid = 'public.bkt_records'::regclass), 'USAGE')) then
    raise exception 'Apply this migration as the owner of public.students and public.bkt_records';
  end if;
  if exists (select 1 from pg_class c
             where c.oid in ('public.students'::regclass, 'public.bkt_records'::regclass)
               and c.relforcerowsecurity) then
    raise exception 'Forced row-level security on students or bkt_records is not supported';
  end if;

  select pg_get_constraintdef(c.oid) into v_def
  from pg_constraint c
  where c.conrelid = 'public.bkt_records'::regclass
    and c.conname = 'bkt_records_student_id_topic_key'
    and c.contype = 'u';
  if v_def is distinct from 'UNIQUE (student_id, topic)' then
    raise exception 'bkt_records needs UNIQUE (student_id, topic); found %', coalesce(v_def, 'none');
  end if;

  if (select format_type(atttypid, atttypmod) from pg_attribute
      where attrelid = 'public.students'::regclass and attname = 'id' and not attisdropped)
       is distinct from 'uuid'
     or (select format_type(atttypid, atttypmod) from pg_attribute
         where attrelid = 'public.bkt_records'::regclass and attname = 'student_id' and not attisdropped)
       is distinct from 'uuid'
     or (select format_type(atttypid, atttypmod) from pg_attribute
         where attrelid = 'public.students'::regclass and attname = 'module_pretests' and not attisdropped)
       is distinct from 'jsonb'
     or coalesce((select format_type(atttypid, atttypmod) from pg_attribute
                  where attrelid = 'public.bkt_records'::regclass and attname = 'probability_known'
                    and not attisdropped), '') not in ('numeric(4,3)', 'numeric')
     or not exists (select 1 from pg_attribute
                    where attrelid = 'public.students'::regclass and attname = 'status' and not attisdropped) then
    raise exception 'Unexpected student or BKT column types';
  end if;

  select format_type(atttypid, atttypmod) into v_pre
  from pg_attribute
  where attrelid = 'public.students'::regclass and attname = 'pre' and not attisdropped;
  if v_pre is null or not (v_pre in ('integer', 'smallint', 'bigint') or v_pre like 'numeric%') then
    raise exception 'students.pre must be an integer or numeric column; found %', coalesce(v_pre, 'none');
  end if;

  if (select count(*) from pg_attribute
      where attrelid = 'public.students'::regclass and not attisdropped
        and attname in ('mastery_phishing', 'mastery_smishing', 'mastery_vishing',
                        'mastery_pretexting', 'mastery_baiting')
        and format_type(atttypid, atttypmod) = 'numeric') <> 5 then
    raise exception 'students.mastery_* must be five unconstrained numeric columns';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'bkt_records'
               and is_nullable = 'NO' and column_default is null
               and is_identity = 'NO' and is_generated = 'NEVER'
               and column_name not in ('student_id', 'topic', 'probability_known')) then
    raise exception 'bkt_records has a required column the functions cannot fill';
  end if;
end $$;

-- 1. Store the same exact value as students.mastery_*. Removing the typmod is not a table rewrite.
alter table public.bkt_records alter column probability_known type numeric;

-- With search_path = '' every table is schema-qualified; built-in functions and operators
-- still resolve from pg_catalog, which PostgreSQL always searches first.

-- 2. Progress-sync mastery write. Every mastery writer locks the student row before bkt_records.
create function public.levelblue_write_mastery(
  p_student uuid,
  p_mastery jsonb,
  p_expected jsonb,
  p_incomplete_modules text[]
) returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '3s'
as $$
declare
  v_row public.students%rowtype;
  v_key text;
  v_current numeric;
  v_columns constant text[] := array['mastery_phishing', 'mastery_smishing', 'mastery_vishing',
                                     'mastery_pretexting', 'mastery_baiting'];
  v_modules constant text[] := array['mod_01', 'mod_02', 'mod_03', 'mod_04', 'mod_05'];
  -- Same falsy flag values as the API parser and the 20261031 backfill.
  v_not_done constant jsonb[] := array['false'::jsonb, 'null'::jsonb, '0'::jsonb, '""'::jsonb,
                                       '{}'::jsonb, '[]'::jsonb];
begin
  if p_student is null
     or p_incomplete_modules is null
     or array_position(p_incomplete_modules, null) is not null
     or not (p_incomplete_modules <@ v_modules)
     or jsonb_typeof(p_mastery) is distinct from 'object'
     or jsonb_typeof(p_expected) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Invalid mastery write';
  end if;
  if (select count(*) from jsonb_object_keys(p_mastery)) not between 1 and 5
     or exists (select 1 from jsonb_object_keys(p_mastery) as k(name) where k.name <> all (v_columns))
     or exists (select 1 from jsonb_object_keys(p_mastery) as k(name) where not p_expected ? k.name)
     or exists (select 1 from jsonb_object_keys(p_expected) as k(name) where not p_mastery ? k.name) then
    raise exception using errcode = '22023', message = 'Invalid mastery keys';
  end if;
  for v_key in select jsonb_object_keys(p_mastery) loop
    if jsonb_typeof(p_mastery -> v_key) <> 'number'
       or jsonb_typeof(p_expected -> v_key) not in ('number', 'null') then
      raise exception using errcode = '22023', message = 'Invalid mastery value';
    end if;
    if (p_mastery ->> v_key)::numeric not between 0 and 1 then
      raise exception using errcode = '22023', message = 'Mastery value out of range';
    end if;
  end loop;

  select * into v_row from public.students where id = p_student for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if lower(btrim(coalesce(v_row.status::text, ''))) in ('inactive', 'archived') then
    return jsonb_build_object('status', 'restricted');
  end if;
  if exists (select 1 from unnest(p_incomplete_modules) as m(module_id)
             where v_row.module_pretests ? m.module_id
               and (v_row.module_pretests -> m.module_id) <> all (v_not_done)) then
    return jsonb_build_object('status', 'conflict', 'reason', 'pretest_completed');
  end if;
  for v_key in select jsonb_object_keys(p_mastery) loop
    v_current := case v_key
      when 'mastery_phishing'   then v_row.mastery_phishing
      when 'mastery_smishing'   then v_row.mastery_smishing
      when 'mastery_vishing'    then v_row.mastery_vishing
      when 'mastery_pretexting' then v_row.mastery_pretexting
      when 'mastery_baiting'    then v_row.mastery_baiting
    end;
    -- Exact decimal comparison: a newer write, however small, is never replaced.
    if v_current is distinct from (p_expected ->> v_key)::numeric then
      return jsonb_build_object('status', 'conflict', 'reason', 'mastery_changed');
    end if;
  end loop;

  update public.students set
    mastery_phishing   = case when p_mastery ? 'mastery_phishing'   then (p_mastery ->> 'mastery_phishing')::numeric   else mastery_phishing end,
    mastery_smishing   = case when p_mastery ? 'mastery_smishing'   then (p_mastery ->> 'mastery_smishing')::numeric   else mastery_smishing end,
    mastery_vishing    = case when p_mastery ? 'mastery_vishing'    then (p_mastery ->> 'mastery_vishing')::numeric    else mastery_vishing end,
    mastery_pretexting = case when p_mastery ? 'mastery_pretexting' then (p_mastery ->> 'mastery_pretexting')::numeric else mastery_pretexting end,
    mastery_baiting    = case when p_mastery ? 'mastery_baiting'    then (p_mastery ->> 'mastery_baiting')::numeric    else mastery_baiting end
  where id = p_student;

  insert into public.bkt_records (student_id, topic, probability_known)
  select p_student, t.topic, (p_mastery ->> t.col)::numeric
  from (values ('Phishing', 'mastery_phishing'), ('Smishing', 'mastery_smishing'),
               ('Vishing', 'mastery_vishing'), ('Pretexting', 'mastery_pretexting'),
               ('Baiting', 'mastery_baiting')) as t(topic, col)
  where p_mastery ? t.col
  on conflict on constraint bkt_records_student_id_topic_key
  do update set probability_known = excluded.probability_known;

  return jsonb_build_object('status', 'ok');
end $$;

-- 3. Official pre-test result: once per module, guarded by the prior it was graded from
create function public.levelblue_record_pretest_result(
  p_student uuid,
  p_module text,
  p_mastery numeric,
  p_pre integer,
  p_expected_prior numeric
) returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '3s'
as $$
declare
  v_row public.students%rowtype;
  v_current numeric;
  v_flags jsonb;
  v_not_done constant jsonb[] := array['false'::jsonb, 'null'::jsonb, '0'::jsonb, '""'::jsonb,
                                       '{}'::jsonb, '[]'::jsonb];
  v_topic text := case p_module
    when 'mod_01' then 'Phishing'
    when 'mod_02' then 'Smishing'
    when 'mod_03' then 'Vishing'
    when 'mod_04' then 'Pretexting'
    when 'mod_05' then 'Baiting'
  end;
begin
  if p_student is null
     or v_topic is null
     or p_mastery is null
     or p_mastery not between 0 and 1
     or (p_module = 'mod_01') <> (p_pre is not null)
     or (p_pre is not null and p_pre not between 0 and 100) then
    raise exception using errcode = '22023', message = 'Invalid pretest result';
  end if;

  select * into v_row from public.students where id = p_student for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if lower(btrim(coalesce(v_row.status::text, ''))) in ('inactive', 'archived') then
    return jsonb_build_object('status', 'restricted');
  end if;
  -- Checked before the prior: a committed pre-test is always reported as completed.
  if v_row.module_pretests ? p_module
     and (v_row.module_pretests -> p_module) <> all (v_not_done) then
    return jsonb_build_object('status', 'already_completed');
  end if;
  v_current := case p_module
    when 'mod_01' then v_row.mastery_phishing
    when 'mod_02' then v_row.mastery_smishing
    when 'mod_03' then v_row.mastery_vishing
    when 'mod_04' then v_row.mastery_pretexting
    when 'mod_05' then v_row.mastery_baiting
  end;
  if v_current is distinct from p_expected_prior then
    return jsonb_build_object('status', 'prior_changed');
  end if;

  update public.students set
    module_pretests    = module_pretests || jsonb_build_object(p_module, true),
    mastery_phishing   = case when p_module = 'mod_01' then p_mastery else mastery_phishing end,
    mastery_smishing   = case when p_module = 'mod_02' then p_mastery else mastery_smishing end,
    mastery_vishing    = case when p_module = 'mod_03' then p_mastery else mastery_vishing end,
    mastery_pretexting = case when p_module = 'mod_04' then p_mastery else mastery_pretexting end,
    mastery_baiting    = case when p_module = 'mod_05' then p_mastery else mastery_baiting end,
    pre                = case when p_module = 'mod_01' then p_pre else pre end
  where id = p_student
  returning module_pretests into v_flags;

  insert into public.bkt_records (student_id, topic, probability_known)
  values (p_student, v_topic, p_mastery)
  on conflict on constraint bkt_records_student_id_topic_key
  do update set probability_known = excluded.probability_known;

  return jsonb_build_object(
    'status', 'ok',
    'completed_modules', (select coalesce(jsonb_agg(e.key order by e.key), '[]'::jsonb)
                          from jsonb_each(v_flags) as e(key, value)
                          where e.value <> all (v_not_done)));
end $$;

-- 4. Only the service role may call either function
revoke all on function public.levelblue_write_mastery(uuid, jsonb, jsonb, text[])
  from public, anon, authenticated;
revoke all on function public.levelblue_record_pretest_result(uuid, text, numeric, integer, numeric)
  from public, anon, authenticated;
grant execute on function public.levelblue_write_mastery(uuid, jsonb, jsonb, text[]) to service_role;
grant execute on function public.levelblue_record_pretest_result(uuid, text, numeric, integer, numeric)
  to service_role;

notify pgrst, 'reload schema';
commit;
