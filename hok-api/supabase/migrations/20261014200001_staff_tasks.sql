-- Staff tasks (REQUIREMENTS §5.9, FR-TSK-01..10; ARCHITECTURE §6).
--
-- * Only the Admin creates, edits, reassigns, reopens and deletes a task
--   (staff_tasks:assign). A task has EXACTLY ONE assignee: any active staff
--   member, of any role.
-- * The assignee (staff_tasks:read/update = "own") sees only tasks assigned to
--   them and moves the status todo / in_progress / blocked / done, with an
--   optional comment. Once done, only the Admin reopens it.
-- * Every status change, comment, reassign and reopen appends a row to
--   staff_task_updates in the SAME transaction as the change (append-only:
--   the API never updates or deletes these rows; they go only with their task).
-- * Editor tasks carry raw_files_url (Drive), reference_url and script
--   (FR-TSK-10). The API requires raw_files_url when the assignee is an
--   editor and keeps the three fields empty for everyone else.
--
-- Row scope is enforced by hok-api (it connects directly, not through the Data
-- API); the grants + RLS below are defence in depth, as for clients.
--
-- Depends on 20261013000004 (events) for the event_id foreign key. That file
-- sorts first, so `supabase migration up` applies it before this one. If the
-- events table is missing anyway, this migration still applies: event_id stays
-- a plain uuid column (no FK) and the API refuses any eventId with
-- 400 STAFF_TASK_EVENT_INVALID until the events table exists. A later
-- migration then adds the constraint (see the DO block at the end).

create table public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 160),
  description text check (length(description) <= 5000),

  -- Exactly one assignee. RESTRICT: staff are deactivated, never deleted, and
  -- a task must never vanish with a person.
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  -- Who assigned it (the Admin). Kept as history; null if that account is ever removed.
  assigned_by uuid references public.profiles (id) on delete set null,

  -- Optional context. SET NULL: a task outlives the client/event it mentions
  -- (clients are archived, never deleted, but fixtures and future cleanups may).
  client_id uuid references public.clients (id) on delete set null,
  event_id uuid,

  -- An instant (UTC). The web picks a wall time in the Admin's zone.
  due_at timestamptz,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),

  -- Editor tasks (FR-TSK-10). http(s) links validated by the API.
  raw_files_url text check (length(raw_files_url) <= 2048),
  reference_url text check (length(reference_url) <= 2048),
  script text check (length(script) <= 20000),
  -- FR-TSK-02 "optional reference links" for any task: [{ "url": "...", "label": "..." }], at most 10.
  reference_links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(reference_links) = 'array' and jsonb_array_length(reference_links) <= 10),

  -- Stamped when the task is marked done, cleared when the Admin reopens it.
  completed_at timestamptz,
  -- Optimistic lock: every write bumps it; a stale one is 409 STAFF_TASK_MODIFIED.
  -- Comments don't touch the task row, so they never invalidate an open form.
  version integer not null default 1 check (version >= 1),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint staff_tasks_done_completed_chk
    check ((status = 'done') = (completed_at is not null))
);

-- "My tasks": an assignee's whole list, newest first. Also serves the
-- assignee FK (the RESTRICT check) and the Admin's assignee filter.
create index staff_tasks_assignee_created_idx on public.staff_tasks (assignee_id, created_at desc, id desc);
-- The LIVE set (never grows with history): an assignee's open tasks by due
-- date, and firm-wide overdue / due-soon (dashboards M10, the overdue filter).
create index staff_tasks_assignee_open_due_idx on public.staff_tasks (assignee_id, due_at) where status <> 'done';
create index staff_tasks_open_due_idx on public.staff_tasks (due_at) where status <> 'done';
-- The Admin's status filter and each Kanban column (one query per status).
create index staff_tasks_status_created_idx on public.staff_tasks (status, created_at desc, id desc);
-- The client filter and the FK's ON DELETE SET NULL; most tasks have no client.
create index staff_tasks_client_idx on public.staff_tasks (client_id) where client_id is not null;
create index staff_tasks_event_idx on public.staff_tasks (event_id) where event_id is not null;

create trigger staff_tasks_set_updated_at
  before update on public.staff_tasks
  for each row
  execute function public.set_updated_at();

-- The task's timeline (FR-TSK-04/06). Append-only.
create table public.staff_task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.staff_tasks (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  -- created: the Admin assigned it · status: a status change (+ optional comment)
  -- comment: a comment only · reassigned: the Admin changed the assignee
  -- reopened: the Admin reopened a done task
  kind text not null check (kind in ('created', 'status', 'comment', 'reassigned', 'reopened')),
  from_status text check (from_status in ('todo', 'in_progress', 'blocked', 'done')),
  to_status text check (to_status in ('todo', 'in_progress', 'blocked', 'done')),
  from_assignee_id uuid references public.profiles (id) on delete set null,
  to_assignee_id uuid references public.profiles (id) on delete set null,
  comment text check (length(comment) <= 2000),
  created_at timestamptz not null default now(),

  constraint staff_task_updates_comment_required_chk
    check (kind <> 'comment' or length(btrim(comment)) > 0),
  constraint staff_task_updates_status_pair_chk
    check (kind not in ('status', 'reopened') or (from_status is not null and to_status is not null))
);

-- A task's timeline, newest first (detail shows the last 100).
create index staff_task_updates_task_idx on public.staff_task_updates (task_id, created_at desc, id desc);

-- ------------------------------------------------- Data API (defence in depth) --

grant select, insert, update, delete on public.staff_tasks, public.staff_task_updates to service_role;
grant select on public.staff_tasks, public.staff_task_updates to authenticated;

alter table public.staff_tasks enable row level security;
alter table public.staff_task_updates enable row level security;

-- Through the Data API an authenticated user could read only the tasks
-- assigned to them. (The Admin's "see all" lives in hok-api.)
create policy staff_tasks_select_own on public.staff_tasks
  for select
  using (auth.uid() = assignee_id);
create policy staff_task_updates_select_own on public.staff_task_updates
  for select
  using (exists (select 1 from public.staff_tasks t where t.id = task_id and t.assignee_id = auth.uid()));

-- ----------------------------------------------------- event FK, if possible --

do $$
begin
  if to_regclass('public.events') is not null then
    alter table public.staff_tasks
      add constraint staff_tasks_event_id_fkey
      foreign key (event_id) references public.events (id) on delete set null;
  else
    raise notice 'public.events does not exist yet: staff_tasks.event_id has no foreign key. Add staff_tasks_event_id_fkey in a later migration.';
  end if;
end
$$;
