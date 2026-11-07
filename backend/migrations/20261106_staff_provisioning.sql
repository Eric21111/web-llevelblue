-- Milestone 2. Apply AFTER 20261106_staff_roles.sql.
begin;
-- Keep private contact details out of users and existing SELECT * / login responses.
create table if not exists public.faculty_contact_profiles (
 id text primary key, birthday date not null, contact_number text not null
);
alter table public.faculty_contact_profiles enable row level security;
revoke all on public.faculty_contact_profiles from public,anon,authenticated;
grant select,insert,update,delete on public.faculty_contact_profiles to service_role;
-- One atomic reservation across both login tables. Preserve existing collisions;
-- they remain reserved until every original holder changes or releases the key.
lock table public.users, public.students in share row exclusive mode;
create table if not exists public.account_identity_keys(
 kind text not null, value text not null, holders integer not null, primary key(kind,value)
);
alter table public.account_identity_keys enable row level security;
revoke all on public.account_identity_keys from public,anon,authenticated;
create or replace function public.levelblue_identity_key(v text) returns text language sql immutable strict
as $$ select nullif(lower(trim(regexp_replace(v,'[[:space:]]+',' ','g'))),'') $$;
delete from public.account_identity_keys;
insert into public.account_identity_keys
select kind,value,count(*) from (select name,email from public.users union all select name,email from public.students) a
cross join lateral(values ('name',public.levelblue_identity_key(a.name)),('email',public.levelblue_identity_key(a.email))) k(kind,value)
where value is not null group by kind,value;
create or replace function public.levelblue_account_identity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare k text; previous text; incoming text;
begin
 foreach k in array array['email','name'] loop
  previous:=case when tg_op<>'INSERT' then levelblue_identity_key(to_jsonb(old)->>k) end;
  incoming:=case when tg_op<>'DELETE' then levelblue_identity_key(to_jsonb(new)->>k) end;
  if previous is not distinct from incoming then continue; end if;
  if incoming is not null then
   insert into account_identity_keys values(k,incoming,1) on conflict do nothing;
   if not found then raise exception 'This % is already used by another account.',k using errcode='23505'; end if;
  end if;
  if previous is not null then
   update account_identity_keys set holders=holders-1 where kind=k and value=previous;
   delete from account_identity_keys where kind=k and value=previous and holders=0;
  end if;
 end loop;
 if tg_op='DELETE' and tg_table_name='users' then
  delete from faculty_contact_profiles where id=old.id::text;
 end if;
 return null;
end $$;
revoke all on function public.levelblue_account_identity() from public,anon,authenticated;
drop trigger if exists levelblue_identity on public.users;
create trigger levelblue_identity after insert or update of name,email or delete on public.users for each row execute function public.levelblue_account_identity();
drop trigger if exists levelblue_identity on public.students;
create trigger levelblue_identity after insert or update of name,email or delete on public.students for each row execute function public.levelblue_account_identity();

-- Retain the existing admin role code and invitation/OTP pipeline for both
-- section-scoped staff tiers. Authority comes from the authenticated DB row.
create or replace function public.levelblue_invite_faculty(p_actor text,p_details jsonb,p_hash text,p_sections text[])
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare actor users; member users; tier text:=p_details->>'tier'; dob date:=(p_details->>'birthday')::date; phone text:=p_details->>'contactNumber';
begin
 select * into actor from users where id::text=p_actor and status='Active' for update;
 if not found or not(actor.role='super' or (actor.role='admin' and actor.is_head_admin)) then raise exception 'Staff management access required' using errcode='42501'; end if;
 if tier is null or tier not in ('teacher','subadmin') or (tier='subadmin' and actor.role<>'super') then raise exception 'Only the Principal may appoint a Head Admin' using errcode='42501'; end if;
 if dob is null or dob>current_date or dob<date '1900-01-01' or phone is null or phone !~ '^\+?[0-9]{7,15}$' then raise exception 'Enter a valid birthday and contact number'; end if;
 if coalesce(cardinality(p_sections),0)=0 then raise exception 'Select at least one assigned section'; end if;
 perform 1 from sections where scope_id=any(p_sections) order by scope_id for share;
 if exists(select from unnest(p_sections) s where not exists(select from sections where scope_id=s) or
    (actor.role<>'super' and not exists(select from teacher_sections where teacher_id=p_actor and section_id=s))) then raise exception 'Section is unavailable for assignment' using errcode='42501'; end if;
 insert into users(first_name,last_name,middle_initial,name,email,password,role,role_label,is_head_admin,sections,students,status)
 values(p_details->>'firstName',p_details->>'lastName',p_details->>'middleInitial',p_details->>'name',p_details->>'email',p_hash,'admin',
 case tier when 'subadmin' then 'Head Admin' else 'Teacher' end,tier='subadmin',0,0,'Invited') returning * into member;
 insert into faculty_contact_profiles(id,birthday,contact_number) values(member.id::text,dob,phone);
 insert into teacher_sections(teacher_id,section_id,assigned_by) select member.id::text,s,p_actor from (select distinct unnest(p_sections) s) q;
 insert into staff_events(actor_id,event_type,entity_id,details) values(p_actor,'faculty-created',member.id::text,jsonb_build_object('sections',p_sections,'tier',tier));
 return to_jsonb(member)-'password';
end $$;

create or replace function public.levelblue_edit_faculty_profile(p_actor text,p_teacher text,p_details jsonb)
returns void language plpgsql set search_path=public,pg_temp as $$
begin
 perform levelblue_edit_teacher(p_actor,p_teacher,p_details);
 if (p_details->>'birthday')::date not between date '1900-01-01' and current_date or p_details->>'birthday' is null
    or coalesce(p_details->>'contactNumber','') !~ '^\+?[0-9]{7,15}$' then raise exception 'Invalid birthday or phone'; end if;
 insert into faculty_contact_profiles(id,birthday,contact_number) values(p_teacher,(p_details->>'birthday')::date,p_details->>'contactNumber')
 on conflict(id) do update set birthday=excluded.birthday,contact_number=excluded.contact_number;
end $$;
revoke all on function public.levelblue_edit_faculty_profile(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.levelblue_edit_faculty_profile(text,text,jsonb) to service_role;

revoke all on function public.levelblue_invite_faculty(text,jsonb,text,text[]) from public,anon,authenticated;
grant execute on function public.levelblue_invite_faculty(text,jsonb,text,text[]) to service_role;
commit;
notify pgrst,'reload schema';
