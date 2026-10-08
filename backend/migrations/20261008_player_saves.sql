-- Run in the same Supabase project used by the web and mobile backends.
-- Additive: creates cloud-save storage without changing students or BKT records.
begin;

create table if not exists public.player_saves (
  -- The mobile API uses upsert without on_conflict, so student_id must be the PK.
  student_id uuid primary key references public.students(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

-- Students authenticate with the mobile API's JWT, not Supabase Auth.
-- The API verifies the student and accesses only that student's save using
-- its server-side service key. Never put this key in the Godot application.
revoke all on table public.player_saves from public, anon, authenticated;
grant select, insert, update, delete on table public.player_saves to service_role;

-- Make the new table visible to Supabase's REST API/schema cache.
notify pgrst, 'reload schema';
commit;
