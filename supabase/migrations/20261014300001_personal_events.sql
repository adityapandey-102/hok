-- Personal calendar entries (REQUIREMENTS FR-CAL-02/03; ARCHITECTURE §6).
-- A manager's own events that aren't client events -- an internal meeting, a
-- planning session -- with an optional link to one of THEIR clients. Visible
-- to the owner and the Admin only. The calendar feed (GET /calendar) merges
-- these with client events. ADR 0007.

create table public.personal_events (
  id uuid primary key default gen_random_uuid(),
  -- Personal data: goes with its owner (staff are deactivated, not deleted,
  -- so in practice this only fires for test fixtures).
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- Optional context; SET NULL so a client's removal (fixtures only -- the API
  -- never deletes clients) doesn't take personal entries with it.
  client_id uuid references public.clients (id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 160),
  -- Same time model and 31-day cap as client events (calendar ranges bound
  -- their scan on starts_at).
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null check (length(time_zone) between 1 and 64),
  description text check (length(description) <= 5000),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint personal_events_times_check
    check (ends_at >= starts_at and ends_at <= starts_at + interval '31 days')
);

-- A manager's own calendar range (the common case).
create index personal_events_owner_starts_idx on public.personal_events (owner_id, starts_at);
-- The Admin's range across owners.
create index personal_events_starts_idx on public.personal_events (starts_at);
-- Entries linked to a client (the client calendar's filter, the FK).
create index personal_events_client_idx on public.personal_events (client_id) where client_id is not null;

create trigger personal_events_set_updated_at
  before update on public.personal_events
  for each row
  execute function public.set_updated_at();

grant select, insert, update, delete on public.personal_events to service_role;
grant select on public.personal_events to authenticated;

alter table public.personal_events enable row level security;

create policy personal_events_select_own on public.personal_events
  for select
  using (auth.uid() = owner_id);
