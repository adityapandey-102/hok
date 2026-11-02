-- Round 1 (decision 2026-11-02): "My to-dos" -- private personal to-do lists.
--
-- Every person (Admin included) has their own list: a title, optional notes, an
-- optional due time, an urgency, and a done stamp. Nobody else can see it, not
-- even the Admin; all access goes through hok-api, where every query carries
-- owner_id = caller. Separate from staff tasks (assigned by someone else) and
-- client to-dos (a client's internal list). Additive only: no existing table
-- is touched.

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  -- Personal data: goes with its owner (staff are deactivated, not deleted, so
  -- in practice this only fires for test fixtures).
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text check (notes is null or char_length(notes) <= 2000),
  due_at timestamptz,
  urgency text not null default 'medium' check (urgency in ('low', 'medium', 'high', 'urgent')),
  done_at timestamptz,
  -- The next reminder moment still to send; null = none left (or done / no due date).
  next_remind_at timestamptz,
  -- Optimistic lock: every write bumps it; a stale one is 409 TODO_MODIFIED.
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The owner's open list by due date (the default list, the dashboard card).
create index todos_owner_open_due_idx on public.todos (owner_id, due_at) where done_at is null;
-- The owner's full list, newest first (also the owner FK's cascade).
create index todos_owner_created_idx on public.todos (owner_id, created_at desc, id desc);
-- The owner's calendar range (to-dos with a due date).
create index todos_owner_due_idx on public.todos (owner_id, due_at) where due_at is not null;
-- The reminder runner: the live set only (not done, a moment still to send).
create index todos_remind_due_idx on public.todos (next_remind_at) where next_remind_at is not null and done_at is null;

create trigger todos_set_updated_at
  before update on public.todos
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------- Data API (defence in depth) --

-- hok-api reads and writes through a direct Postgres connection. The Data API
-- roles get nothing (as for every table since 20261030000004): row-level
-- security is on with no policies, a second wall.
grant select, insert, update, delete on public.todos to service_role;
revoke all on public.todos from anon, authenticated;

alter table public.todos enable row level security;
