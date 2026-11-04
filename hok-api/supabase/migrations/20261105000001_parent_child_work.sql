-- Round 4: parent and child events and tasks.
--
-- From any stage of an event or a task, a child event or child task can be created, tied to that stage.
-- While a stage has unfinished children the parent can't move past it (the API's move gate; same gate
-- as round 3's approvals). Nesting is at most 3 levels (parent -> child -> grandchild).
--
-- The same five columns go on BOTH events and staff_tasks. A child has at most one parent, which is an
-- event or a task; `parent_*_stage_id` is the stage of that parent the child hangs on.
--
-- ADDITIVE ONLY. Production runs migrations before the new API is deployed, so the OLD API runs against
-- this schema for a few minutes: every new column is nullable or has a default (depth = 1), nothing is
-- dropped or renamed, and the old API never sets a parent, so every old row is a top-level item.

alter table public.events
  add column parent_event_id uuid references public.events (id) on delete set null,
  add column parent_task_id uuid references public.staff_tasks (id) on delete set null,
  add column parent_event_stage_id uuid references public.event_stages (id) on delete set null,
  add column parent_task_stage_id uuid references public.task_stages (id) on delete set null,
  add column depth smallint not null default 1 check (depth between 1 and 3);

alter table public.staff_tasks
  add column parent_event_id uuid references public.events (id) on delete set null,
  add column parent_task_id uuid references public.staff_tasks (id) on delete set null,
  add column parent_event_stage_id uuid references public.event_stages (id) on delete set null,
  add column parent_task_stage_id uuid references public.task_stages (id) on delete set null,
  add column depth smallint not null default 1 check (depth between 1 and 3);

-- shortcut: only "at most one parent" is a CHECK. "Both or neither of parent + stage" (and "the stage belongs to
-- that parent", which would need a composite FK that nullable pairs can't give) is enforced by the API inside the
-- creating transaction. A stricter pair CHECK would break the `on delete set null` actions: when a parent task is
-- deleted, Postgres nulls the child's parent id and its stage id in separate steps, and a CHECK on the pair fails
-- in between. The check below holds in every order.
alter table public.events
  add constraint events_one_parent_check check (parent_event_id is null or parent_task_id is null);
alter table public.staff_tasks
  add constraint staff_tasks_one_parent_check check (parent_event_id is null or parent_task_id is null);

-- A parent task that is deleted leaves its children as top-level items (set null). Their `depth` then goes
-- stale (it stays 2 or 3). Harmless: depth is only read from a live parent when a child is created.
-- Parent events are never deleted (events.client_id is on delete restrict), so that case doesn't arise.

-- The move gate's "open children of this parent / stage" reads, and the supporting index for every FK
-- (partial: most rows have no parent).
create index events_parent_event_idx on public.events (parent_event_id) where parent_event_id is not null;
create index events_parent_task_idx on public.events (parent_task_id) where parent_task_id is not null;
create index events_parent_event_stage_idx on public.events (parent_event_stage_id) where parent_event_stage_id is not null;
create index events_parent_task_stage_idx on public.events (parent_task_stage_id) where parent_task_stage_id is not null;

create index staff_tasks_parent_event_idx on public.staff_tasks (parent_event_id) where parent_event_id is not null;
create index staff_tasks_parent_task_idx on public.staff_tasks (parent_task_id) where parent_task_id is not null;
create index staff_tasks_parent_event_stage_idx on public.staff_tasks (parent_event_stage_id) where parent_event_stage_id is not null;
create index staff_tasks_parent_task_stage_idx on public.staff_tasks (parent_task_stage_id) where parent_task_stage_id is not null;
