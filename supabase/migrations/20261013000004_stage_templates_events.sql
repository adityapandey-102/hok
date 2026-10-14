-- Stage templates and client events (REQUIREMENTS §5.3, FR-EVT-01..09;
-- ARCHITECTURE §6, §10). ADR 0006.
--
-- * The Admin keeps stage templates: a name + an ordered list of stages.
-- * A manager creates an event for one of their clients from an ACTIVE
--   template; the template's stages are COPIED into event_stages, so editing
--   or deactivating the template later never changes existing events (FR-EVT-03).
-- * Moving an event's current stage appends a row to event_stage_history in
--   the same transaction (who, when, optional note, visible-to-client flag).
--
-- Row scope (a manager sees only events of clients they own) is enforced by
-- hok-api; the grants + RLS below are defence in depth, as for clients.

-- ---------------------------------------------------------------- templates --

create table public.stage_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  -- Inactive templates can't be picked for new events; events already made
  -- from them keep their own copy of the stages.
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Names are unique, ignoring case ("Photo Shoot" vs "photo shoot").
create unique index stage_templates_name_key on public.stage_templates (lower(name));
-- The managers' picker: active templates by name.
create index stage_templates_active_name_idx on public.stage_templates (active, lower(name));

create trigger stage_templates_set_updated_at
  before update on public.stage_templates
  for each row
  execute function public.set_updated_at();

-- An edit replaces a template's whole stage list (rename / reorder / add /
-- remove in one go): nothing references these rows, events copy them.
create table public.stage_template_stages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.stage_templates (id) on delete cascade,
  position integer not null check (position between 1 and 20),
  name text not null check (length(btrim(name)) between 1 and 60),
  unique (template_id, position)
);

-- ------------------------------------------------------------------- events --

create table public.events (
  id uuid primary key default gen_random_uuid(),
  -- RESTRICT: clients are archived, never deleted.
  client_id uuid not null references public.clients (id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 160),
  type text not null check (type in ('shoot', 'campaign', 'meeting', 'content_posting', 'other')),
  -- Instants in UTC; time_zone is where the event happens (shown alongside
  -- the viewer's zone when they differ). Max 31 days long, so a calendar range
  -- query can bound its scan on starts_at (see events_starts_at_idx).
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null check (length(time_zone) between 1 and 64),
  -- A place or an online link.
  location text check (length(location) <= 500),
  description text check (length(description) <= 5000),
  -- Informational only (FR-EVT-05): profile ids, validated by the API.
  assigned_team uuid[] not null default '{}' check (cardinality(assigned_team) <= 20),
  -- Which template it came from (null once that template is ever deleted --
  -- the API never deletes templates) and its name at the time, for display.
  template_id uuid references public.stage_templates (id) on delete set null,
  template_name text not null,
  -- Always one of THIS event's stages (composite FK below). Nullable only
  -- for the instant between inserting the event and its stages.
  current_stage_id uuid,
  -- Stages never change after creation, so their count is a snapshot too
  -- (the list's progress tracker needs it without a per-row count).
  stage_count integer not null check (stage_count between 1 and 20),
  -- FR-EVT-04: on top of the stage, any event can be cancelled or postponed.
  state text not null default 'active' check (state in ('active', 'cancelled', 'postponed')),
  version integer not null default 1 check (version >= 1),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_times_check
    check (ends_at >= starts_at and ends_at <= starts_at + interval '31 days')
);

create table public.event_stages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position integer not null check (position between 1 and 20),
  name text not null check (length(btrim(name)) between 1 and 60),
  unique (event_id, position),
  -- Target of events' composite FK: a current stage must belong to its event.
  unique (id, event_id)
);

alter table public.events
  add constraint events_current_stage_fk
  foreign key (current_stage_id, id) references public.event_stages (id, event_id)
  deferrable initially deferred;

-- Append-only (the API never updates or deletes these rows).
create table public.event_stage_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  -- Null on the first entry, written when the event is created.
  from_stage_id uuid references public.event_stages (id) on delete cascade,
  to_stage_id uuid not null references public.event_stages (id) on delete cascade,
  note text check (length(note) <= 1000),
  -- FR-EVT-06 / FR-POR-06: shown on the client portal (M8) when true.
  visible_to_client boolean not null default false,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- A client's events by date (the client workspace's Events tab).
create index events_client_starts_idx on public.events (client_id, starts_at);
-- Calendar ranges across clients (Admin calendar; managers join clients by owner).
create index events_starts_at_idx on public.events (starts_at);
-- An event's stages in order (the unique (event_id, position) index serves it).
-- An event's history, newest first.
create index event_stage_history_event_idx on public.event_stage_history (event_id, created_at desc);

create trigger events_set_updated_at
  before update on public.events
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------- Data API (defence in depth) --

grant select, insert, update, delete on public.stage_templates, public.stage_template_stages,
  public.events, public.event_stages, public.event_stage_history to service_role;
grant select on public.stage_templates, public.stage_template_stages to authenticated;
grant select on public.events, public.event_stages, public.event_stage_history to authenticated;

alter table public.stage_templates enable row level security;
alter table public.stage_template_stages enable row level security;
alter table public.events enable row level security;
alter table public.event_stages enable row level security;
alter table public.event_stage_history enable row level security;

-- Templates are not secret: any signed-in user may read them.
create policy stage_templates_select_all on public.stage_templates for select to authenticated using (true);
create policy stage_template_stages_select_all on public.stage_template_stages for select to authenticated using (true);

-- Events (and their stages/history): only for the owner of the event's client.
create policy events_select_own on public.events for select
  using (exists (select 1 from public.clients c where c.id = client_id and c.owner_id = auth.uid()));
create policy event_stages_select_own on public.event_stages for select
  using (exists (select 1 from public.events e join public.clients c on c.id = e.client_id
                 where e.id = event_id and c.owner_id = auth.uid()));
create policy event_stage_history_select_own on public.event_stage_history for select
  using (exists (select 1 from public.events e join public.clients c on c.id = e.client_id
                 where e.id = event_id and c.owner_id = auth.uid()));
