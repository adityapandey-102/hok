-- Profiles: 1:1 with auth.users, holds the RBAC role that authorizes every
-- other table in this schema. role is never trusted from client-writable
-- user_metadata after creation: it lives here, and only the Admin (through
-- hok-api's users module, which uses the service-role key) changes it.
--
-- Roles (docs/REQUIREMENTS.md §3):
--   admin                         -- everything; the only role that assigns staff tasks
--   social_media_manager,
--   marketing_manager             -- own clients, events, assets, calendars, portal, comments
--   marketing_agent, developer,
--   editor                        -- staff tasks only

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in (
    'admin', 'social_media_manager', 'marketing_manager', 'marketing_agent', 'developer', 'editor'
  )),
  -- IANA time zone the user works in (multiple time zones, NFR-08). The API
  -- validates the name; the check only stops empty / absurd values.
  time_zone text not null default 'Asia/Kolkata' check (length(time_zone) between 1 and 64),
  phone text,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Set on every successful sign-in (users list "last seen").
  last_login_at timestamptz
);

create index profiles_role_idx on public.profiles (role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Fires on every new auth.users row. The intended role / full name / time zone
-- are set in user_metadata at creation time by hok-api (the Admin creating an
-- account, or the one-time first-admin bootstrap), so this trigger just copies
-- them across. A missing role falls back to the least-privileged staff role
-- (editor: staff tasks only), never to a powerful one. Public sign-up is off in
-- supabase/config.toml, so only hok-api can create users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, time_zone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'editor'),
    coalesce(new.raw_user_meta_data ->> 'time_zone', 'Asia/Kolkata')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- This CLI/project defaults to NOT auto-exposing new public-schema tables to
-- the Data API roles (anon/authenticated/service_role) without explicit
-- GRANTs. The API talks to Postgres directly (Drizzle), not through the Data
-- API; these grants and RLS policies are defense-in-depth for that unused path.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select on public.profiles to authenticated;

alter table public.profiles enable row level security;

-- Every authenticated user can read their own profile; nothing else is exposed
-- through the Data API (team lookups go through hok-api, which scopes them).
create policy profiles_select_self on public.profiles
  for select
  using (auth.uid() = id);
