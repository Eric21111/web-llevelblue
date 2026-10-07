-- Apply after 20261007_student_feedback.sql. Additive: no accounts, saves or learning records are deleted.
begin;
alter table public.students add column if not exists grade_level text;
alter table public.sections add column if not exists scope_id text;
update public.sections set scope_id = id::text where scope_id is null;
alter table public.sections alter column scope_id set default gen_random_uuid()::text;
alter table public.sections alter column scope_id set not null;
create unique index if not exists sections_scope_id_key on public.sections(scope_id);
alter table public.sections add column if not exists grade_level text check (grade_level in ('Grade 11','Grade 12'));
-- Do not guess grade from a section name. Only unanimous existing enrollment establishes grade.
update public.sections s set grade_level = g.grade from
 (select section,min(grade_level) grade from public.students group by section
  having count(distinct grade_level)=1 and min(grade_level) in ('Grade 11','Grade 12')) g
where s.name=g.section and s.grade_level is null;
alter table public.students add column if not exists section_id text references public.sections(scope_id);
update public.students st set section_id=s.scope_id from public.sections s
where st.section_id is null and st.section=s.name
and (select count(*) from public.sections x where x.name=s.name)=1;
create index if not exists students_section_id_idx on public.students(section_id);
alter table public.feedback add column if not exists section_id text references public.sections(scope_id);
update public.feedback f set section_id=s.scope_id from public.sections s
where f.section_id is null and f.section=s.name
and (select count(*) from public.sections x where x.name=s.name)=1;
alter table public.students add column if not exists pre_completed_at timestamptz;
alter table public.students add column if not exists post_completed_at timestamptz;
alter table public.students add column if not exists pre_scale text;
alter table public.students add column if not exists post_scale text;
alter table public.students add column if not exists pre_assessment_pair_id text;
alter table public.students add column if not exists post_assessment_pair_id text;

alter table public.users add column if not exists inactive_previous_status text;

create table if not exists public.staff_events (
 id uuid primary key default gen_random_uuid(), actor_id text not null,
 event_type text not null, entity_id text, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.teacher_sections (
 teacher_id text not null, section_id text not null references public.sections(scope_id),
 assigned_by text not null, assigned_at timestamptz not null default now(), primary key(teacher_id,section_id)
);
create table if not exists public.learning_interventions (
 id uuid primary key default gen_random_uuid(), student_id text not null,
 section_id text not null references public.sections(scope_id), actor_id text not null,
 kind text not null check(kind in ('review','remediation','bounty-review')),
 topic text check(topic in ('Phishing','Smishing','Vishing','Pretexting','Baiting')),
 note text not null check(length(note) between 1 and 5000), scheduled_date date,
 outcome text not null default 'Pending' check(outcome in ('Pending','In progress','Completed','Follow-up needed')),
 bounty_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.learning_interventions add column if not exists updated_by text;
create index if not exists interventions_section_idx on public.learning_interventions(section_id,created_at desc);
alter table public.staff_events enable row level security;
alter table public.teacher_sections enable row level security;
alter table public.learning_interventions enable row level security;
-- Only the server's service role accesses these tables; JWT staff auth is enforced in Express.
revoke all on public.staff_events,public.teacher_sections,public.learning_interventions from anon,authenticated;
grant all on public.staff_events,public.teacher_sections,public.learning_interventions to service_role;

create or replace function public.levelblue_faculty(p_actor text,p_teacher text,p_status text,p_sections text[])
returns void language plpgsql set search_path=public as $$
declare old_status text;
begin
 if not exists(select 1 from users where id::text=p_actor and role='super' and status='Active') then raise exception 'School-head access required'; end if;
 select status into old_status from users where id::text=p_teacher and role='admin' for update;
 if not found then raise exception 'Teacher not found'; end if;
 if p_status not in ('Active','Inactive','Invited') or (old_status='Invited' and p_status='Active') then raise exception 'Invalid status transition'; end if;
 if p_status='Invited' and old_status<>'Invited' then raise exception 'Cannot re-invite an existing account'; end if;
 if exists(select 1 from unnest(p_sections) x where not exists(select 1 from sections s where s.scope_id=x)) then raise exception 'Unknown section'; end if;
 if p_status='Inactive' and old_status<>'Inactive' then
  update users set inactive_previous_status=old_status where id::text=p_teacher;
 elsif old_status='Inactive' and p_status='Active' and exists(select 1 from users where id::text=p_teacher and inactive_previous_status='Invited') then
  p_status := 'Invited';
 end if;
 update users set status=p_status where id::text=p_teacher;
 delete from teacher_sections where teacher_id=p_teacher;
 insert into teacher_sections(teacher_id,section_id,assigned_by) select p_teacher,x,p_actor from (select distinct unnest(p_sections) x) a;
 insert into staff_events(actor_id,event_type,entity_id,details) values(p_actor,'faculty-updated',p_teacher,jsonb_build_object('previousStatus',old_status,'status',p_status,'sections',p_sections));
end $$;

create or replace function public.levelblue_create_section(p_actor text,p_name text,p_subject text,p_grade text)
returns jsonb language plpgsql set search_path=public as $$
declare created sections; actor_role text;
begin
 select role into actor_role from users where id::text=p_actor and status='Active';
 if actor_role is null or actor_role not in ('admin','super') then raise exception 'Active staff required'; end if;
 if p_grade not in ('Grade 11','Grade 12') or length(trim(p_name))=0 then raise exception 'Invalid section'; end if;
 perform pg_advisory_xact_lock(hashtext(lower(trim(p_name))));
 if exists(select 1 from sections where lower(trim(name))=lower(trim(p_name))) then raise exception 'Section name already exists'; end if;
 insert into sections(name,subject,grade_level) values(trim(p_name),p_subject,p_grade) returning * into created;
 if actor_role='admin' then insert into teacher_sections(teacher_id,section_id,assigned_by) values(p_actor,created.scope_id,p_actor); end if;
 insert into staff_events(actor_id,event_type,entity_id,details) values(p_actor,'section-created',created.scope_id,jsonb_build_object('name',p_name,'grade',p_grade));
 return to_jsonb(created);
end $$;

create or replace function public.levelblue_intervention_audit() returns trigger language plpgsql set search_path=public as $$
begin
 insert into staff_events(actor_id,event_type,entity_id,details) values(case when TG_OP='INSERT' then new.actor_id else coalesce(new.updated_by,new.actor_id) end,case when TG_OP='INSERT' then new.kind else 'intervention-updated' end,new.id::text,to_jsonb(new));
 return new;
end $$;
drop trigger if exists levelblue_intervention_audit on public.learning_interventions;
create trigger levelblue_intervention_audit after insert or update on public.learning_interventions for each row execute function public.levelblue_intervention_audit();

-- Preserve old mobile section strings; resolve a stable ID only when the name is unambiguous.
create or replace function public.levelblue_student_section() returns trigger language plpgsql set search_path=public as $$
begin
 if new.section_id is null and (select count(*) from sections where name=new.section)=1 then
  select scope_id into new.section_id from sections where name=new.section;
 end if;
 if new.section_id is not null and not exists(select 1 from sections where scope_id=new.section_id and name=new.section) then
  raise exception 'Section name and stable ID disagree';
 end if;
 return new;
end $$;
drop trigger if exists levelblue_student_section on public.students;
create trigger levelblue_student_section before insert or update of section,section_id on public.students for each row execute function public.levelblue_student_section();
revoke all on function public.levelblue_faculty(text,text,text,text[]),public.levelblue_create_section(text,text,text,text) from public,anon,authenticated;
grant execute on function public.levelblue_faculty(text,text,text,text[]),public.levelblue_create_section(text,text,text,text) to service_role;
alter table public.support_bounties add column if not exists created_by text;
alter table public.support_bounties add column if not exists cancelled_by text;
alter table public.support_bounties add column if not exists cancelled_at timestamptz;
create or replace function public.levelblue_bounty_audit() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='INSERT' and new.created_by is not null then
  insert into staff_events(actor_id,event_type,entity_id,details) values(new.created_by,'bounty-assigned',new.id::text,jsonb_build_object('mentor',new.mentor_id,'mentee',new.mentee_id,'topic',new.topic));
 elsif TG_OP='UPDATE' and new.cancelled_at is distinct from old.cancelled_at and new.cancelled_by is not null then
  insert into staff_events(actor_id,event_type,entity_id,details) values(new.cancelled_by,'bounty-cancelled',new.id::text,'{}');
 end if;
 return new;
end $$;
drop trigger if exists levelblue_bounty_audit on public.support_bounties;
create trigger levelblue_bounty_audit after insert or update on public.support_bounties for each row execute function public.levelblue_bounty_audit();
commit;
notify pgrst, 'reload schema';
