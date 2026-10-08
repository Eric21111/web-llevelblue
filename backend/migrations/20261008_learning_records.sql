-- Additive learning evidence. Never infer historical events from legacy saves.
begin;
create table if not exists public.learning_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  event_id uuid not null,
  kind text not null check (kind in ('pretest','posttest','stage','mastery')),
  module_id text not null check (module_id in ('mod_01','mod_02','mod_03','mod_04','mod_05')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  unique(student_id,event_id)
);
create index if not exists learning_records_student_date on public.learning_records(student_id,occurred_at,id);
create unique index if not exists learning_records_stage_result on public.learning_records(student_id,module_id,(data->>'attempt_id'))
  where kind='stage' and data->>'outcome' in ('cleared','failed','abandoned');
create unique index if not exists learning_records_assessment_attempt on public.learning_records(student_id,module_id,(data->>'attempt_id'),(data->>'instrument'))
  where kind='posttest';
alter table public.learning_records enable row level security;
revoke all on public.learning_records from public, anon, authenticated;
grant select, insert, delete on public.learning_records to service_role;

-- The mobile API validates and grades event payloads. This function makes a
-- whole upload atomic and makes retries safe without allowing history rewrites.
create or replace function public.levelblue_record_learning(p_student uuid, p_events jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare item jsonb; existing public.learning_records; inserted integer;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 100 then
    raise exception 'Invalid learning batch';
  end if;
  for item in select value from jsonb_array_elements(p_events) loop
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
        or existing.data is distinct from item->'data' then
        raise exception 'Learning event ID already used with different content';
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.levelblue_record_learning(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.levelblue_record_learning(uuid,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
