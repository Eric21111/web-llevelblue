-- Apply after 20261015_teacher_invites.sql. Only encrypted temporary passwords
-- are retained; teacher-chosen passwords remain bcrypt hashes in users.
begin;
create table if not exists public.teacher_temporary_credentials (
 user_id text primary key,
 ciphertext text,
 cleared_at timestamptz
);
alter table public.teacher_temporary_credentials enable row level security;
revoke all on public.teacher_temporary_credentials from public,anon,authenticated;
grant all on public.teacher_temporary_credentials to service_role;

create or replace function public.levelblue_store_teacher_password(p_user text,p_password text,p_ciphertext text)
returns boolean language plpgsql set search_path=public as $$
begin
 perform 1 from users where id::text=p_user and role='admin' and status='Invited' and password=p_password for update;
 if not found then return false; end if;
 if exists(select 1 from teacher_invites where user_id=p_user and verified_grant_hash is not null) then return false; end if;
 -- A cleared credential cannot be restored by retries or a later code resend.
 insert into teacher_temporary_credentials(user_id,ciphertext) values(p_user,p_ciphertext) on conflict do nothing;
 return found;
end $$;

create or replace function public.levelblue_preview_teacher_password(p_actor text,p_user text)
returns jsonb language plpgsql set search_path=public as $$
declare u users; encrypted text;
begin
 perform 1 from users where id::text=p_actor and role='super' and status='Active' for share;
 if not found then raise exception 'School-head access required'; end if;
 select * into u from users where id::text=p_user and role='admin' for share;
 if not found or u.status<>'Invited' then return null; end if;
 select ciphertext into encrypted from teacher_temporary_credentials where user_id=p_user and cleared_at is null;
 if encrypted is null then return null; end if;
 return jsonb_build_object('ciphertext',encrypted,'passwordHash',u.password);
end $$;

create or replace function public.levelblue_clear_temporary_password() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_TABLE_NAME='teacher_invites' then
  if new.verified_grant_hash is not null then
   update teacher_temporary_credentials set ciphertext=null,cleared_at=now() where user_id=new.user_id;
  end if;
 elsif TG_OP='DELETE' then
  delete from teacher_temporary_credentials where user_id=old.id::text;
 elsif new.status='Active' or old.password is distinct from new.password or old.email is distinct from new.email then
  update teacher_temporary_credentials set ciphertext=null,cleared_at=now() where user_id=new.id::text;
 end if;
 return null;
end $$;
drop trigger if exists levelblue_clear_temporary_password_verified on public.teacher_invites;
create trigger levelblue_clear_temporary_password_verified after insert or update on public.teacher_invites
 for each row execute function public.levelblue_clear_temporary_password();
drop trigger if exists levelblue_clear_temporary_password_account on public.users;
create trigger levelblue_clear_temporary_password_account after update or delete on public.users
 for each row execute function public.levelblue_clear_temporary_password();
revoke all on function public.levelblue_store_teacher_password(text,text,text),public.levelblue_preview_teacher_password(text,text),public.levelblue_clear_temporary_password() from public,anon,authenticated;
grant execute on function public.levelblue_store_teacher_password(text,text,text),public.levelblue_preview_teacher_password(text,text),public.levelblue_clear_temporary_password() to service_role;
commit;
notify pgrst,'reload schema';
