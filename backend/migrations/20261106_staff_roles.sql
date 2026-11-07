-- Milestone 1: school roles only. No assignment, enrollment or OTP changes.
begin;
alter table public.users add column if not exists is_head_admin boolean not null default false
 check (not is_head_admin or role='admin');
update public.users set role_label='Principal'
 where role='super' and role_label is distinct from 'Principal';

-- Even if a legacy installation grants client writes on users, a client cannot
-- set its own school authority. Staff management is handled by the server.
create or replace function public.levelblue_guard_school_role() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if current_user in ('anon','authenticated') then
  if (tg_op='INSERT' and (new.role in ('super','developer','admin') or new.is_head_admin))
     or (tg_op='UPDATE' and (new.role,new.is_head_admin) is distinct from (old.role,old.is_head_admin)) then
   raise exception 'Staff roles require the Principal console' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists levelblue_guard_school_role on public.users;
create trigger levelblue_guard_school_role before insert or update of role,is_head_admin on public.users
 for each row execute function public.levelblue_guard_school_role();

-- admin remains the classroom role for compatibility with current section
-- policies and mobile APIs. Only super (Principal) may appoint or demote.
create or replace function public.levelblue_set_staff_tier(p_actor text,p_staff text,p_head_admin boolean)
returns void language plpgsql set search_path=public,pg_temp as $$
declare previous boolean;
begin
 perform 1 from users where id::text=p_actor and role='super' and status='Active' for share;
 if not found then raise exception 'Principal access required' using errcode='42501'; end if;
 if p_head_admin is null then raise exception 'Choose a staff role'; end if;
 select is_head_admin into previous from users where id::text=p_staff and role='admin' for update;
 if not found then raise exception 'Choose an existing teacher or Head Admin'; end if;
 if previous=p_head_admin then return; end if;
 update users set is_head_admin=p_head_admin,role_label=case when p_head_admin then 'Head Admin' else 'Teacher' end where id::text=p_staff;
 insert into staff_events(actor_id,event_type,entity_id,details)
 values(p_actor,'staff-role-updated',p_staff,jsonb_build_object('from',case when previous then 'Head Admin' else 'Teacher' end,'to',case when p_head_admin then 'Head Admin' else 'Teacher' end));
end $$;
revoke all on function public.levelblue_set_staff_tier(text,text,boolean) from public,anon,authenticated;
grant execute on function public.levelblue_set_staff_tier(text,text,boolean) to service_role;
commit;
notify pgrst,'reload schema';
