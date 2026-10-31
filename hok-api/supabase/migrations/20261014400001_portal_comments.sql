-- Client portal links and client comments (REQUIREMENTS §5.7-5.8, FR-POR-01..09,
-- FR-CMT-01..08; ARCHITECTURE §7). ADR 0008.
--
-- * A portal link is 32 random bytes (base64url) handed out ONCE; only its
--   SHA-256 hash is stored, so a database leak yields no working link. At most
--   one ACTIVE link per client: regenerate = revoke the old + insert a new one,
--   disable = revoke. Archiving a client revokes its link (hok-api, same
--   transaction). Links never expire on their own (FR-POR-02).
-- * The client posts comments through the link; the owning manager works them
--   Received -> In Progress -> Solved with an optional reply. Every status
--   change is appended to client_comment_history (who, when).
--
-- The public endpoints are served by hok-api only; nothing here is exposed
-- through the Data API (no grants to anon/authenticated on portal_links).

create table public.portal_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- hex(sha256(token)): 64 characters. The token itself is never stored.
  token_hash text not null unique check (length(token_hash) = 64),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  -- Throttled to at most one write an hour (staff see "last opened").
  last_used_at timestamptz,
  constraint portal_links_revoked_check check (active = (revoked_at is null))
);

-- One active link per client; also the staff lookup "current link of client X".
create unique index portal_links_one_active_idx on public.portal_links (client_id) where active;
-- The client's link history (newest first).
create index portal_links_client_created_idx on public.portal_links (client_id, created_at desc);

create table public.client_comments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- Optional: a comment about one of this client's events (the API checks it's theirs).
  event_id uuid references public.events (id) on delete set null,
  -- Which link it came through (kept for the record; links are never deleted by the API).
  portal_link_id uuid references public.portal_links (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  status text not null default 'received' check (status in ('received', 'in_progress', 'solved')),
  -- The manager's reply, shown to the client on the portal (FR-CMT-04/05).
  reply text check (length(reply) <= 2000),
  replied_by uuid references public.profiles (id) on delete set null,
  replied_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A client's comments, newest first (portal list, client filter in the inbox).
create index client_comments_client_created_idx on public.client_comments (client_id, created_at desc);
-- The inbox's live set: unsolved comments by status (badge counts, default view).
create index client_comments_open_idx on public.client_comments (status, created_at desc) where status <> 'solved';
-- Comments about an event.
create index client_comments_event_idx on public.client_comments (event_id) where event_id is not null;

create trigger client_comments_set_updated_at
  before update on public.client_comments
  for each row
  execute function public.set_updated_at();

-- Append-only (the API never updates or deletes these rows).
create table public.client_comment_history (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.client_comments (id) on delete cascade,
  from_status text not null check (from_status in ('received', 'in_progress', 'solved')),
  to_status text not null check (to_status in ('received', 'in_progress', 'solved')),
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index client_comment_history_comment_idx on public.client_comment_history (comment_id, created_at);

-- Data API: service role only (defence in depth). Staff read comments through
-- hok-api; no anon/authenticated access to any of these tables.
grant select, insert, update, delete on public.portal_links, public.client_comments, public.client_comment_history to service_role;

alter table public.portal_links enable row level security;
alter table public.client_comments enable row level security;
alter table public.client_comment_history enable row level security;
-- RLS on with no policy: the Data API denies everything.
