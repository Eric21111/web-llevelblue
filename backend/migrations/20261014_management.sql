-- Apply after web foundations and enrollment. No accounts or learning history are deleted.
begin;
-- Fail visibly on legacy duplicates. Do not merge or delete student accounts automatically.
do $$ begin
 if exists(select 1 from students where nullif(trim(email),'') is not null group by lower(trim(email)) having count(*)>1) then
  raise exception 'Duplicate student emails exist. Run the diagnostic in MANAGEMENT_SETUP.md and correct the conflicting accounts before retrying.';
 end if;
 if exists(select 1 from users where nullif(trim(email),'') is not null group by lower(trim(email)) having count(*)>1) then
  raise exception 'Duplicate staff emails exist. Correct the conflicting accounts before retrying.';
 end if;
end $$;
create unique index if not exists students_email_normalized_key on public.students(lower(trim(email))) where nullif(trim(email),'') is not null;
create unique index if not exists users_email_normalized_key on public.users(lower(trim(email))) where nullif(trim(email),'') is not null;

create or replace function public.levelblue_edit_student(p_actor text,p_student text,p_details jsonb)
returns void language plpgsql set search_path=public as $$
declare actor_role text; learner students; first text:=trim(p_details->>'firstName'); last text:=trim(p_details->>'lastName'); mail text:=lower(trim(p_details->>'email')); mi text:=left(trim(coalesce(p_details->>'middleInitial','')),1);
begin
 select role into actor_role from users where id::text=p_actor and status='Active' for update;
 if actor_role is null or actor_role not in ('super','admin') then raise exception 'Active staff required'; end if;
 select * into learner from students where id::text=p_student for update;
 if not found or (actor_role='admin' and not exists(select 1 from teacher_sections where teacher_id=p_actor and section_id=learner.section_id)) then raise exception 'Student not available in your sections'; end if;
 if first is null or length(first) not between 1 and 100 or last is null or length(last) not between 1 and 100 or mail is null or length(mail)>254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid first name, last name and email are required'; end if;
 update students set first_name=first,last_name=last,middle_initial=nullif(mi,''),name=first||case when mi='' then '' else ' '||upper(mi)||'.' end||' '||last,email=mail,technical=coalesce((p_details->>'technical')::boolean,technical) where id=learner.id;
 insert into staff_events(actor_id,event_type,entity_id,details) values(p_actor,'student-details-updated',p_student,jsonb_build_object('section_id',learner.section_id));
end $$;

create or replace function public.levelblue_edit_teacher(p_actor text,p_teacher text,p_details jsonb)
returns void language plpgsql set search_path=public as $$
declare first text:=trim(p_details->>'firstName');last text:=trim(p_details->>'lastName');mail text:=lower(trim(p_details->>'email'));mi text:=left(trim(coalesce(p_details->>'middleInitial','')),1);
begin
 perform 1 from users where id::text=p_actor and role='super' and status='Active' for update;
 if not found then raise exception 'School-head access required'; end if;
 perform 1 from users where id::text=p_teacher and role='admin' for update;
 if not found then raise exception 'Teacher not found'; end if;
 if first is null or length(first) not between 1 and 100 or last is null or length(last) not between 1 and 100 or mail is null or length(mail)>254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid first name, last name and email are required'; end if;
 update users set first_name=first,last_name=last,middle_initial=mi,name=first||case when mi='' then '' else ' '||upper(mi)||'.' end||' '||last,email=mail where id::text=p_teacher;
 insert into staff_events(actor_id,event_type,entity_id,details) values(p_actor,'teacher-details-updated',p_teacher,'{}');
end $$;

create or replace function public.levelblue_manage_section(p_actor text,p_section text,p_action text,p_details jsonb default '{}')
returns void language plpgsql set search_path=public as $$
declare actor_role text; current_section sections; used boolean; new_name text:=trim(p_details->>'name'); new_grade text:=p_details->>'gradeLevel';
begin
 select role into actor_role from users where id::text=p_actor and status='Active' for update;
 if actor_role is null or actor_role not in ('super','admin') then raise exception 'Active staff required'; end if;
 select * into current_section from sections where scope_id=p_section for update;
 if not found or (actor_role='admin' and not exists(select 1 from teacher_sections where teacher_id=p_actor and section_id=p_section)) then raise exception 'Section not available'; end if;
 -- Lock referencing tables so legacy name-only records cannot race a rename/delete.
 lock table students,feedback,learning_interventions,enrollment_history in share row exclusive mode;
 used:=exists(select 1 from students where section_id=p_section or section=current_section.name)
  or exists(select 1 from feedback where section_id=p_section or section=current_section.name)
  or exists(select 1 from learning_interventions where section_id=p_section)
  or exists(select 1 from enrollment_history where from_section=p_section or to_section=p_section);
 if p_action='delete' then
  if actor_role<>'super' then raise exception 'Only the school head can delete an empty section'; end if;
  if used then raise exception 'This section has enrollment or history. Keep it and use Section Checklist for graduating learners.'; end if;
  delete from teacher_sections where section_id=p_section;
  delete from sections where scope_id=p_section;
 elsif p_action='edit' then
  if new_name is null or length(new_name) not between 1 and 100 or new_grade is null or new_grade not in ('Grade 11','Grade 12') then raise exception 'Section name and Grade 11 or Grade 12 are required'; end if;
  if new_name<>current_section.name then
   if used then raise exception 'Section names with enrollment or history are protected for mobile compatibility'; end if;
   perform pg_advisory_xact_lock(hashtext(lower(new_name)));
   if exists(select 1 from sections where scope_id<>p_section and lower(trim(name))=lower(new_name)) then raise exception 'Section name already exists'; end if;
  end if;
  if new_grade is distinct from current_section.grade_level then
   if actor_role<>'super' then raise exception 'Only the school head can confirm grades'; end if;
   if current_section.grade_level is not null then raise exception 'Use Section Checklist to promote learners; confirmed grades cannot be changed here'; end if;
   if exists(select 1 from students where section_id=p_section and nullif(trim(grade_level),'') is not null and trim(grade_level)<>new_grade) then raise exception 'Enrolled student grades disagree. Check enrollment before confirming the grade'; end if;
  end if;
  update sections set name=new_name,subject=left(coalesce(p_details->>'subject','General Cybersecurity'),200),grade_level=new_grade where scope_id=p_section;
 else raise exception 'Invalid section action'; end if;
 insert into staff_events(actor_id,event_type,entity_id,details) values(p_actor,'section-'||p_action,p_section,jsonb_build_object('name',current_section.name,'changes',p_details));
end $$;
revoke all on function public.levelblue_edit_student(text,text,jsonb),public.levelblue_edit_teacher(text,text,jsonb),public.levelblue_manage_section(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.levelblue_edit_student(text,text,jsonb),public.levelblue_edit_teacher(text,text,jsonb),public.levelblue_manage_section(text,text,text,jsonb) to service_role;
commit;
notify pgrst,'reload schema';
