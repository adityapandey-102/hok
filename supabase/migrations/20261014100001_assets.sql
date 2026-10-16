-- Asset link library (REQUIREMENTS §5.5, FR-AST-01..07; ARCHITECTURE §6).
-- The platform stores LINKS, never files: an asset is a titled URL (Drive,
-- Dropbox, Canva, ...) under one client, with a type, a comment, reusable
-- per-client tags and an optional link to one of that client's events.
-- Internal only: never exposed on the client portal (FR-AST-07).
--
-- Depends on 20261013000003_clients.sql (clients, pg_trgm) and
-- 20261013000004_stage_templates_events.sql (events), which sort before this
-- file, so `migration up` always applies them first.
--
-- Row scope (a manager sees only assets of clients they own) is enforced by
-- hok-api; the grants + RLS below are defence in depth, as for clients.

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  -- RESTRICT: clients are archived, never deleted.
  client_id uuid not null references public.clients (id) on delete restrict,
  -- Optional link to one of THIS client's events (checked by the API: events
  -- never change client). SET NULL: if an event row is ever removed the asset stays.
  event_id uuid references public.events (id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 160),
  -- http(s) only: the API validates the scheme with isValidHttpUrl; the check
  -- is a backstop so a javascript: / data: URL can never be stored.
  url text not null check (length(url) <= 2048 and url ~* '^https?://'),
  type text not null check (type in ('photo', 'video', 'document', 'design', 'audio', 'other')),
  comment text check (length(comment) <= 2000),
  -- Optimistic lock: a write naming an older version is 409 ASSET_MODIFIED.
  version integer not null default 1 check (version >= 1),
  created_by uuid references public.profiles (id) on delete set null,
  -- FR-AST-06 soft delete: hidden everywhere, row kept.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tags are reusable within a client and matched ignoring case ("Reels" and
-- "reels" are one tag; the first spelling is kept).
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 30),
  created_at timestamptz not null default now()
);
create unique index tags_client_name_key on public.tags (client_id, lower(name));
-- Tag auto-suggest: ILIKE '%term%' (escaped by containsPattern).
create index tags_name_trgm_idx on public.tags using gin (name gin_trgm_ops);

create table public.asset_tags (
  asset_id uuid not null references public.assets (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (asset_id, tag_id)
);
-- "Assets with this tag" and the suggestion counts (the PK serves asset -> tags).
create index asset_tags_tag_idx on public.asset_tags (tag_id, asset_id);

-- Live set only: every list ignores soft-deleted rows, so every index is partial on that.
-- A client's assets, newest first (the client workspace's Assets tab).
create index assets_client_created_idx on public.assets (client_id, created_at desc, id desc) where deleted_at is null;
-- Type filter inside a client.
create index assets_client_type_idx on public.assets (client_id, type, created_at desc) where deleted_at is null;
-- The Admin's all-clients list, newest first (managers reach theirs through clients_owner_created_idx).
create index assets_created_idx on public.assets (created_at desc, id desc) where deleted_at is null;
-- "Assets of this event" filter (and the event FK).
create index assets_event_idx on public.assets (event_id) where event_id is not null and deleted_at is null;
-- Search over title and comment: ILIKE '%term%' uses these.
create index assets_title_trgm_idx on public.assets using gin (title gin_trgm_ops) where deleted_at is null;
create index assets_comment_trgm_idx on public.assets using gin (comment gin_trgm_ops) where deleted_at is null;

-- set_updated_at() is defined in 20261013000001_profiles.sql.
create trigger assets_set_updated_at
  before update on public.assets
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------- Data API (defence in depth) --

grant select, insert, update, delete on public.assets, public.tags, public.asset_tags to service_role;
grant select on public.assets, public.tags, public.asset_tags to authenticated;

alter table public.assets enable row level security;
alter table public.tags enable row level security;
alter table public.asset_tags enable row level security;

-- Only the owner of the asset's client, and only live rows.
create policy assets_select_own on public.assets for select
  using (deleted_at is null and exists (select 1 from public.clients c where c.id = client_id and c.owner_id = auth.uid()));
create policy tags_select_own on public.tags for select
  using (exists (select 1 from public.clients c where c.id = client_id and c.owner_id = auth.uid()));
create policy asset_tags_select_own on public.asset_tags for select
  using (exists (
    select 1 from public.assets a join public.clients c on c.id = a.client_id
    where a.id = asset_id and a.deleted_at is null and c.owner_id = auth.uid()
  ));
