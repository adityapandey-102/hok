-- Clients (REQUIREMENTS §5.2, FR-CLI-01..07; ARCHITECTURE §6). Each client is
-- owned by exactly ONE client manager (admin, social_media_manager or
-- marketing_manager). A manager sees and edits only owner_id = themselves; the
-- Admin sees all and is the only one who reassigns. Everything that later hangs
-- off a client (events, assets, portal links, comments) references client_id,
-- so reassigning owner_id moves "the client and all its data" in one update.
--
-- Row scope is enforced by hok-api (it connects directly, not through the Data
-- API); the grants + RLS policy below are defence in depth, as for profiles.

-- Trigram search on business_name. Ships with Postgres/Supabase; idempotent
-- (needleye enables it the same way).
create extension if not exists pg_trgm;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  -- Exactly one owner. RESTRICT, not cascade: staff accounts are deactivated,
  -- never deleted, and a client must never disappear with a person.
  owner_id uuid not null references public.profiles (id) on delete restrict,

  business_name text not null check (length(btrim(business_name)) between 1 and 160),
  logo_url text check (length(logo_url) <= 2048),
  industry text check (length(industry) <= 80),
  contact_person text check (length(contact_person) <= 120),
  phone text check (length(phone) <= 24),
  email text check (length(email) <= 254),
  address text check (length(address) <= 500),
  website text check (length(website) <= 2048),
  -- { "instagram": "@acme", "youtube": "https://youtube.com/@acme", ... }.
  -- Keys come from a fixed platform list and values are validated in the API
  -- (clients/domain/client-profile.rules.ts); the database only insists on an object.
  social_handles jsonb not null default '{}'::jsonb check (jsonb_typeof(social_handles) = 'object'),
  -- Services the client subscribes to, as plain labels ("Social media
  -- management", "Monthly shoot"). text[] rather than jsonb: a flat list of
  -- strings with no structure, and `= any(services)` / a GIN index work on it
  -- directly if it's ever filtered on. Deduplicated and capped in the API.
  services text[] not null default '{}' check (cardinality(services) <= 20),
  contract_start date,
  contract_end date,
  -- The client's IANA zone: the portal shows times in it (NFR-08). Named zone
  -- validated by the API; the check only stops empty / absurd values.
  time_zone text not null default 'Asia/Kolkata' check (length(time_zone) between 1 and 64),
  -- Internal only: never shown on the client portal.
  notes text check (length(notes) <= 5000),

  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  -- Set when archived (hidden from active lists, data retained, portal link
  -- disabled once portals exist in M8); cleared on unarchive.
  archived_at timestamptz,
  -- Optimistic lock (needleye's pattern): every write bumps it; a write that
  -- names an older version is refused with 409 CLIENT_MODIFIED.
  version integer not null default 1 check (version >= 1),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint clients_contract_dates_check
    check (contract_start is null or contract_end is null or contract_end >= contract_start),
  constraint clients_archived_at_check
    check ((status = 'archived') = (archived_at is not null))
);

-- A manager's list: owner_id = me, newest first. Also serves the FK (owner
-- lookups, the RESTRICT check) and the Admin's owner filter.
create index clients_owner_created_idx on public.clients (owner_id, created_at desc, id desc);
-- The Admin's all-clients list and the status filter, newest first. The
-- default list hides archived clients (status <> 'archived').
create index clients_status_created_idx on public.clients (status, created_at desc, id desc);
-- Industry filter: case-insensitive exact match.
create index clients_industry_idx on public.clients (lower(industry));
-- Name search: ILIKE '%term%' (escaped by containsPattern) uses this.
create index clients_business_name_trgm_idx on public.clients using gin (business_name gin_trgm_ops);

-- set_updated_at() is defined in 20261013000001_profiles.sql.
create trigger clients_set_updated_at
  before update on public.clients
  for each row
  execute function public.set_updated_at();

-- Data API: defence in depth only (hok-api uses its own Postgres connection).
grant select, insert, update, delete on public.clients to service_role;
grant select on public.clients to authenticated;

alter table public.clients enable row level security;

-- Through the Data API an authenticated user could read only the clients they
-- own. (The Admin's "see all" lives in hok-api, which scopes every query.)
create policy clients_select_own on public.clients
  for select
  using (auth.uid() = owner_id);
