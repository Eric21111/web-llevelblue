-- Milestone 3: run after 20261106_staff_provisioning.sql.
-- Only staff assignments change. Student enrollment and learning records stay intact.
begin;
create or replace function public.levelblue_staff_handoff(
 p_actor text,p_teacher text,p_source text,p_target text,p_replacement text,p_action text
) returns void language plpgsql set search_path=public,pg_temp as $$
declare actor users; member users; replacement users;
begin
 -- Consistent lock order serializes changes to the same staff and sections.
 perform 1 from users where id::text in (p_actor,p_teacher,p_replacement) order by id for update;
 select * into actor from users where id::text=p_actor and status='Active';
 if not found or not(actor.role='super' or (actor.role='admin' and actor.is_head_admin)) then
  raise exception 'Principal or Head Admin access required' using errcode='42501';
 end if;
 select * into member from users where id::text=p_teacher and role='admin';
 if not found or (actor.role<>'super' and (member.is_head_admin or p_actor=p_teacher)) then
  raise exception 'This staff account is outside your permissions' using errcode='42501';
 end if;
 if p_action is null or p_action not in ('transfer','replace','cover','remove') then raise exception 'Choose a valid assignment action'; end if;
 if (p_action='transfer' and (p_target is null or member.status<>'Active'))
    or (p_action<>'transfer' and p_target is not null)
    or (p_action in ('replace','cover') and p_replacement is null)
    or (p_action='remove' and p_replacement is not null) then raise exception 'Check the selected action, destination and replacement'; end if;
 perform 1 from sections where scope_id in (p_source,p_target) order by scope_id for update;
 if p_source is null or not exists(select from sections where scope_id=p_source)
    or (p_target is not null and (p_target=p_source or not exists(select from sections where scope_id=p_target))) then raise exception 'Choose valid, different sections'; end if;
 if actor.role<>'super' and exists(select from sections s where s.scope_id in (p_source,p_target)
    and not exists(select from teacher_sections where teacher_id=p_actor and section_id=s.scope_id)) then
  raise exception 'Only your assigned sections can be managed' using errcode='42501';
 end if;
 if not exists(select from teacher_sections where teacher_id=p_teacher and section_id=p_source) then raise exception 'This assignment has changed. Refresh and try again'; end if;
 if p_replacement is not null then
  select * into replacement from users where id::text=p_replacement and role='admin' and status='Active';
  if not found or p_replacement=p_teacher or (actor.role<>'super' and replacement.is_head_admin) then
   raise exception 'Choose a different active teacher within your permissions' using errcode='42501';
  end if;
  insert into teacher_sections(teacher_id,section_id,assigned_by) values(p_replacement,p_source,p_actor) on conflict do nothing;
  if p_action='cover' and not found then raise exception 'That teacher already teaches this section'; end if;
 end if;
 if p_target is not null then
  insert into teacher_sections(teacher_id,section_id,assigned_by) values(p_teacher,p_target,p_actor) on conflict do nothing;
  if not found then raise exception 'This staff member already teaches the destination section'; end if;
 end if;
 if p_action<>'cover' then
  delete from teacher_sections where teacher_id=p_teacher and section_id=p_source;
  if exists(select from students where section_id=p_source and coalesce(enrollment_status,'active')='active')
     and not exists(select from teacher_sections ts join users u on u.id::text=ts.teacher_id
       where ts.section_id=p_source and u.role='admin' and u.status='Active') then
   raise exception 'This section still has students. Assign an active replacement or co-teacher first';
  end if;
 end if;
 insert into staff_events(actor_id,event_type,entity_id,details) values(p_actor,'staff-handoff',p_teacher,
  jsonb_build_object('action',p_action,'section_id',p_source,'to',p_target,'replacement',p_replacement));
end $$;
revoke all on function public.levelblue_staff_handoff(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.levelblue_staff_handoff(text,text,text,text,text,text) to service_role;
commit;
notify pgrst,'reload schema';
