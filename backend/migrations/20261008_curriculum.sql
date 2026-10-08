-- Additive curriculum workflow. Apply after the web foundations migration.
begin;
create table if not exists public.curriculum_items (
 id uuid primary key default gen_random_uuid(), created_by text not null, created_at timestamptz not null default now()
);
create sequence if not exists public.curriculum_release_seq;
create table if not exists public.curriculum_revisions (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references public.curriculum_items(id),
 revision integer not null check(revision > 0), version integer not null default 1,
 kind text not null check(kind in ('lesson','quiz','codex')),
 topic text not null check(topic in ('Phishing','Smishing','Vishing','Pretexting','Baiting')),
 title text not null check(length(btrim(title)) between 1 and 180), content jsonb not null,
 status text not null default 'draft' check(status in ('draft','submitted','changes_requested','approved','published')),
 author_id text not null, review_note text not null default '', reviewed_by text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 submitted_at timestamptz, reviewed_at timestamptz, published_at timestamptz, published_by text,
 release_version bigint unique, unique(item_id,revision)
);
create unique index if not exists curriculum_one_working_revision on public.curriculum_revisions(item_id) where status <> 'published';
create table if not exists public.curriculum_events (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references public.curriculum_items(id),
 revision_id uuid not null references public.curriculum_revisions(id), actor_id text not null,
 action text not null, note text not null default '', created_at timestamptz not null default now()
);
alter table public.curriculum_items enable row level security;
alter table public.curriculum_revisions enable row level security;
alter table public.curriculum_events enable row level security;
revoke all on public.curriculum_items,public.curriculum_revisions,public.curriculum_events from anon,authenticated;
grant all on public.curriculum_items,public.curriculum_revisions,public.curriculum_events to service_role;
grant usage,select on sequence public.curriculum_release_seq to service_role;

-- Defense in depth: malformed content cannot bypass submission through an RPC call.
create or replace function public.levelblue_validate_content(k text,c jsonb,complete boolean)
returns void language plpgsql set search_path=public as $$
declare field text; arr jsonb; v jsonb;
begin
 if jsonb_typeof(c) is distinct from 'object' then raise exception 'Content must be an object'; end if;
 if k not in ('lesson','quiz','codex') or k is null then raise exception 'Unknown content kind'; end if;
 foreach field in array (case k when 'lesson' then array['body'] when 'quiz' then array['prompt','explanation'] else array['definition','safeResponse'] end) loop
  if jsonb_typeof(c->field) is distinct from 'string' or length(c->>field)>(case when field='body' then 20000 when field='prompt' then 5000 else 10000 end) or (complete and length(btrim(c->>field))=0) then raise exception 'Content text is missing or too long'; end if;
 end loop;
 arr:=c->(case k when 'lesson' then 'objectives' when 'quiz' then 'options' else 'warningSigns' end);
 if jsonb_typeof(arr) is distinct from 'array' then raise exception 'Content list required'; end if;
 if jsonb_array_length(arr)>(case when k='quiz' then 6 else 10 end) or (k='quiz' and jsonb_array_length(arr)<2) then raise exception 'Invalid number of entries'; end if;
 for v in select * from jsonb_array_elements(arr) loop
  if jsonb_typeof(v)<>'string' or length(v#>>'{}')>1000 or (complete and k='quiz' and length(btrim(v#>>'{}'))=0) then raise exception 'Invalid content list entry'; end if;
 end loop;
 if k='quiz' then
  if not c ? 'correctOption' then raise exception 'Correct answer field required'; end if;
  if c->'correctOption'<>'null'::jsonb then
   if jsonb_typeof(c->'correctOption')<>'number' or (c->>'correctOption')!~'^[0-9]+$' then raise exception 'Invalid correct answer'; end if;
   if (c->>'correctOption')::integer>=jsonb_array_length(arr) then raise exception 'Invalid correct answer'; end if;
  elsif complete then raise exception 'Correct answer required'; end if;
  if complete and (select count(distinct lower(btrim(value))) from jsonb_array_elements_text(arr))<>jsonb_array_length(arr) then raise exception 'Answer choices must be distinct'; end if;
 end if;
end $$;

create or replace function public.levelblue_curriculum_write(p_actor text,p_action text,p_revision uuid default null,p_expected integer default null,p_payload jsonb default '{}')
returns jsonb language plpgsql set search_path=public as $$
declare actor_role text; r curriculum_revisions; item uuid; note text:=coalesce(p_payload->>'note','');
begin
 select role into actor_role from users where id::text=p_actor and status='Active' for share;
 if actor_role is null or actor_role not in ('admin','super') then raise exception 'Active staff access required'; end if;
 if length(note)>3000 then raise exception 'Review note is too long'; end if;
 if p_action='create' then
  if actor_role<>'admin' then raise exception 'Only teachers author drafts'; end if;
  perform levelblue_validate_content(p_payload->>'kind',p_payload->'content',false);
  insert into curriculum_items(created_by) values(p_actor) returning id into item;
  insert into curriculum_revisions(item_id,revision,kind,topic,title,content,author_id)
   values(item,1,p_payload->>'kind',p_payload->>'topic',btrim(p_payload->>'title'),p_payload->'content',p_actor) returning * into r;
 else
  select item_id into item from curriculum_revisions where id=p_revision;
  if item is null then raise exception 'Content not available'; end if;
  perform 1 from curriculum_items where id=item for update;
  select * into r from curriculum_revisions where id=p_revision for update;
  if p_expected is null or r.version<>p_expected then raise exception 'Content changed. Refresh before trying again'; end if;
  if p_action in ('edit','submit','revise') then
   if actor_role<>'admin' or r.author_id<>p_actor then raise exception 'Only the author can change this draft'; end if;
  elsif p_action in ('request_changes','approve','publish') then
   if actor_role<>'super' then raise exception 'School-head review required'; end if;
  else raise exception 'Unknown content action'; end if;
  if p_action='revise' then
   if r.status<>'published' or exists(select 1 from curriculum_revisions where item_id=item and (status<>'published' or revision>r.revision)) then raise exception 'Revise the latest published version after finishing any open draft'; end if;
   insert into curriculum_revisions(item_id,revision,kind,topic,title,content,author_id)
    values(item,r.revision+1,r.kind,r.topic,r.title,r.content,p_actor) returning * into r;
  else
   if p_action in ('edit','submit') and r.status not in ('draft','changes_requested') then raise exception 'This revision is locked for review'; end if;
   if p_action in ('request_changes','approve') and r.status<>'submitted' then raise exception 'Only submitted content can be reviewed'; end if;
   if p_action='publish' and r.status<>'approved' then raise exception 'Approve the revision before publishing'; end if;
   if p_action='request_changes' and length(btrim(note))=0 then raise exception 'Explain the requested changes'; end if;
   if p_action='edit' then
    perform levelblue_validate_content(r.kind,p_payload->'content',false);
    r.title:=btrim(p_payload->>'title'); r.content:=p_payload->'content';
   end if;
   if p_action in ('submit','approve','publish') then perform levelblue_validate_content(r.kind,r.content,true); end if;
   if p_action='submit' then r.status:='submitted'; r.submitted_at:=now(); end if;
   if p_action in ('request_changes','approve') then
    r.status:=case p_action when 'approve' then 'approved' else 'changes_requested' end;
    r.review_note:=btrim(note); r.reviewed_by:=p_actor; r.reviewed_at:=now();
   end if;
   if p_action='publish' then
    -- Serialize releases so a committed catalog version never skips an earlier in-flight release.
    perform pg_advisory_xact_lock(20261008);
    r.status:='published'; r.published_at:=now(); r.published_by:=p_actor; r.release_version:=nextval('curriculum_release_seq');
   end if;
   update curriculum_revisions set title=r.title,content=r.content,status=r.status,version=version+1,updated_at=now(),
    submitted_at=r.submitted_at,review_note=r.review_note,reviewed_by=r.reviewed_by,reviewed_at=r.reviewed_at,
    published_at=r.published_at,published_by=r.published_by,release_version=r.release_version
    where id=r.id returning * into r;
  end if;
 end if;
 insert into curriculum_events(item_id,revision_id,actor_id,action,note) values(r.item_id,r.id,p_actor,p_action,btrim(note));
 return to_jsonb(r);
end $$;
revoke all on function public.levelblue_validate_content(text,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.levelblue_curriculum_write(text,text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.levelblue_validate_content(text,jsonb,boolean) to service_role;
grant execute on function public.levelblue_curriculum_write(text,text,uuid,integer,jsonb) to service_role;
-- A single snapshot avoids missing releases if publication occurs during pagination.
create or replace function public.levelblue_published_catalog()
returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('schemaVersion',1,'releaseVersion',coalesce((select max(release_version) from curriculum_revisions where status='published'),0),
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',item_id,'revision',revision,'releaseVersion',release_version,
 'kind',kind,'topic',topic,'title',title,'content',content,'publishedAt',published_at) order by item_id)
 from (select distinct on(item_id) * from curriculum_revisions where status='published' order by item_id,revision desc) latest),'[]'::jsonb));
$$;
revoke all on function public.levelblue_published_catalog() from public,anon,authenticated;
grant execute on function public.levelblue_published_catalog() to service_role;
commit;
