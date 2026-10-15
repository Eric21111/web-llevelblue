-- Teacher first-login email verification. Apply before deploying the OTP flow.
begin;
create table if not exists public.teacher_invites (
 user_id text primary key,
 email text not null,
 code_hash text,
 expires_at timestamptz,
 attempts integer not null default 0,
 locked_until timestamptz,
 sent_at timestamptz,
 window_start timestamptz not null default now(),
 send_count integer not null default 0
);
alter table public.teacher_invites add column if not exists verified_grant_hash text;
alter table public.teacher_invites add column if not exists verified_until timestamptz;
alter table public.teacher_invites enable row level security;
revoke all on public.teacher_invites from public,anon,authenticated;
grant all on public.teacher_invites to service_role;

-- Lock the account first in both operations: concurrent resends and activation
-- cannot reuse a code or reset its attempt limit.
create or replace function public.levelblue_invite_send(p_user text,p_email text,p_password text,p_hash text)
returns jsonb language plpgsql set search_path=public as $$
declare u users; i teacher_invites;
begin
 select * into u from users where id::text=p_user for update;
 if not found or u.role<>'admin' or u.status<>'Invited' or u.email<>p_email or u.password<>p_password then
  return jsonb_build_object('error','session');
 end if;
 insert into teacher_invites(user_id,email) values(p_user,p_email) on conflict do nothing;
 select * into i from teacher_invites where user_id=p_user for update;
 if i.locked_until>now() then return jsonb_build_object('error','locked'); end if;
 if i.sent_at>now()-interval '60 seconds' then return jsonb_build_object('error','cooldown'); end if;
 if i.window_start>now()-interval '1 hour' and i.send_count>=5 then return jsonb_build_object('error','limit'); end if;
 update teacher_invites set email=p_email,code_hash=p_hash,expires_at=now()+interval '10 minutes',
  verified_grant_hash=null,verified_until=null,
  attempts=case when i.locked_until<=now() then 0 else i.attempts end,locked_until=null,sent_at=now(),
  window_start=case when i.window_start<=now()-interval '1 hour' then now() else i.window_start end,
  send_count=case when i.window_start<=now()-interval '1 hour' then 1 else i.send_count+1 end
 where user_id=p_user;
 return jsonb_build_object('sent',true);
end $$;

create or replace function public.levelblue_invite_verify(p_user text,p_email text,p_password text,p_hash text,p_grant_hash text)
returns jsonb language plpgsql set search_path=public as $$
declare u users; i teacher_invites;
begin
 select * into u from users where id::text=p_user for update;
 if not found or u.role<>'admin' or u.status<>'Invited' or u.email<>p_email or u.password<>p_password then
  return jsonb_build_object('error','session');
 end if;
 select * into i from teacher_invites where user_id=p_user for update;
 if not found or i.email<>p_email or i.code_hash is null then return jsonb_build_object('error','invalid'); end if;
 if i.locked_until>now() then return jsonb_build_object('error','locked'); end if;
 if i.expires_at<=now() then return jsonb_build_object('error','expired'); end if;
 if i.code_hash<>p_hash then
  update teacher_invites set attempts=attempts+1,
   locked_until=case when attempts+1>=5 then now()+interval '15 minutes' else null end,
   expires_at=case when attempts+1>=5 then now() else expires_at end
  where user_id=p_user;
  return jsonb_build_object('error',case when i.attempts+1>=5 then 'locked' else 'invalid' end);
 end if;
 update teacher_invites set code_hash=null,expires_at=null,attempts=0,
  verified_grant_hash=p_grant_hash,verified_until=now()+interval '10 minutes' where user_id=p_user;
 return jsonb_build_object('verified',true);
end $$;

create or replace function public.levelblue_invite_activate(p_user text,p_email text,p_password text,p_grant_hash text,p_new_password text)
returns jsonb language plpgsql set search_path=public as $$
declare u users; i teacher_invites;
begin
 select * into u from users where id::text=p_user for update;
 if not found or u.role<>'admin' or u.status<>'Invited' or u.email<>p_email or u.password<>p_password then
  return jsonb_build_object('error','session');
 end if;
 select * into i from teacher_invites where user_id=p_user for update;
 if not found or i.email<>p_email or i.verified_grant_hash is null or i.verified_until<=now() or i.verified_grant_hash<>p_grant_hash then
  return jsonb_build_object('error','setup');
 end if;
 update users set password=p_new_password,status='Active',inactive_previous_status=null where id=u.id;
 delete from teacher_invites where user_id=p_user;
 insert into staff_events(actor_id,event_type,entity_id,details)
  values(p_user,'teacher-invite-verified',p_user,jsonb_build_object('method','email-otp'));
 return jsonb_build_object('activated',true);
end $$;
-- Remove the earlier combined endpoint if this migration is being rerun.
drop function if exists public.levelblue_invite_complete(text,text,text,text,text);

-- Pending codes also disappear when an account is removed or its email changes.
create or replace function public.levelblue_clear_teacher_invite() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='DELETE' then delete from teacher_invites where user_id=old.id::text; return old; end if;
 if old.email is distinct from new.email then
  update teacher_invites set code_hash=null,expires_at=null,verified_grant_hash=null,verified_until=null where user_id=old.id::text;
 end if;
 return new;
end $$;
drop trigger if exists levelblue_clear_teacher_invite on public.users;
create trigger levelblue_clear_teacher_invite after delete or update of email on public.users
 for each row execute function public.levelblue_clear_teacher_invite();
revoke all on function public.levelblue_invite_send(text,text,text,text),public.levelblue_invite_verify(text,text,text,text,text),public.levelblue_invite_activate(text,text,text,text,text),public.levelblue_clear_teacher_invite() from public,anon,authenticated;
grant execute on function public.levelblue_invite_send(text,text,text,text),public.levelblue_invite_verify(text,text,text,text,text),public.levelblue_invite_activate(text,text,text,text,text),public.levelblue_clear_teacher_invite() to service_role;
commit;
notify pgrst,'reload schema';
