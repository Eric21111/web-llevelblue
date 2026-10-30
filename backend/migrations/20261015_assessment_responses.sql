-- Apply after learning_records. Preserve immutable old scores and allow retries
-- from an upgraded mobile API that now attaches item-level response snapshots.
begin;
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
        or (existing.data is distinct from item->'data'
          and not (existing.kind in ('pretest','posttest')
            and not (existing.data ? 'responses')
            and existing.data = ((item->'data') - 'responses' - 'response_version'))) then
        raise exception 'Learning event ID already used with different content';
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.levelblue_record_learning(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.levelblue_record_learning(uuid,jsonb) to service_role;
commit;
notify pgrst,'reload schema';
