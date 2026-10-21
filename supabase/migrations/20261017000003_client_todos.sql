-- Phase 2: client to-do lists (REQUIREMENTS §5.4, FR-CTSK-01..04).
--
-- A manager's internal to-dos for one client ("Get the product list", "Book
-- the studio"), optionally about one of the client's events. Separate from
-- staff tasks (which the Admin assigns to people) and never shown on the
-- portal. All access goes through hok-api (row scope: the client's owner and
-- the Admin); the grants + RLS below are defence in depth, as for clients.

create table public.client_todos (
  id uuid primary key default gen_random_uuid(),
  -- A to-do belongs to its client: it goes with the client (clients are only
  -- ever archived in the app; deletes are fixture cleanup).
  client_id uuid not null references public.clients (id) on delete cascade,
  -- Optional: about one of the same client's events (checked in the API).
  event_id uuid references public.events (id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (length(description) <= 2000),
  due_at timestamptz,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  -- Stamped when marked done, cleared when reopened.
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  -- Optimistic lock: every write bumps it; a stale one is 409 CLIENT_TODO_MODIFIED.
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint client_todos_done_completed_chk
    check ((status = 'done') = (completed_at is not null))
);

-- A client's list, newest first (also the client FK's cascade).
create index client_todos_client_created_idx on public.client_todos (client_id, created_at desc, id desc);
-- The LIVE set (never grows with history): a client's open to-dos by due date
-- (the default list, overdue / due-soon, the manager's dashboard).
create index client_todos_client_open_due_idx on public.client_todos (client_id, due_at) where status <> 'done';
-- Firm-wide overdue / due-soon across a manager's clients (dashboard).
create index client_todos_open_due_idx on public.client_todos (due_at) where status <> 'done' and due_at is not null;
-- Every foreign key has an index (engineering-practices §1).
create index client_todos_event_idx on public.client_todos (event_id) where event_id is not null;
create index client_todos_created_by_idx on public.client_todos (created_by) where created_by is not null;

create trigger client_todos_set_updated_at
  before update on public.client_todos
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------- Data API (defence in depth) --

grant select, insert, update, delete on public.client_todos to service_role;
grant select on public.client_todos to authenticated;

alter table public.client_todos enable row level security;

-- Through the Data API an authenticated user could read only the to-dos of
-- clients they own. (The Admin's "see all" lives in hok-api.)
create policy client_todos_select_own on public.client_todos
  for select
  using (exists (select 1 from public.clients c where c.id = client_id and c.owner_id = auth.uid()));
