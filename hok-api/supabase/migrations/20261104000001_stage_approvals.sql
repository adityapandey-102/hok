-- Round 3: stage approvals (event and task templates, client approval in the portal).
--
-- 1. Every stage (template, event and task) can name APPROVERS. A stage with approvers is an
--    approval stage: the item can't move past it until an approval row for it is 'approved'.
--    Tokens: 'admin', 'team_managers' (the client's team managers), 'client' (event templates
--    only; the API enforces that), or a role name (never 'admin').
-- 2. stage_approvals: one row per request ("round"): pending -> approved / changes_requested /
--    cancelled; an approved or pending row is 'superseded' / 'cancelled' when the item moves
--    back to that stage or earlier. History is kept.
--
-- ADDITIVE ONLY. Production runs migrations before the new API is deployed, so the OLD API runs
-- against this schema for a few minutes: every new column has a default ('{}'), nothing is
-- dropped or renamed, and with no approvers set anywhere the old API's unguarded stage moves
-- are exactly what the new API would allow.

-- ------------------------------------------------------------- 1. approvers --

-- The allowed tokens: 3 specials + the roles of profiles_role_check
-- (20261101000001_content_writer_role.sql) minus 'admin'. At most 8 per stage.
alter table public.stage_template_stages
  add column approvers text[] not null default '{}'
    check (approvers <@ array['admin', 'team_managers', 'client', 'social_media_manager', 'marketing_manager', 'project_manager', 'marketing_agent', 'developer', 'editor', 'content_writer']::text[] and cardinality(approvers) <= 8);

alter table public.event_stages
  add column approvers text[] not null default '{}'
    check (approvers <@ array['admin', 'team_managers', 'client', 'social_media_manager', 'marketing_manager', 'project_manager', 'marketing_agent', 'developer', 'editor', 'content_writer']::text[] and cardinality(approvers) <= 8);

alter table public.task_stages
  add column approvers text[] not null default '{}'
    check (approvers <@ array['admin', 'team_managers', 'client', 'social_media_manager', 'marketing_manager', 'project_manager', 'marketing_agent', 'developer', 'editor', 'content_writer']::text[] and cardinality(approvers) <= 8);

-- ------------------------------------------------------------ 2. approvals --

create table public.stage_approvals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete cascade,
  task_id uuid references public.staff_tasks (id) on delete cascade,
  event_stage_id uuid references public.event_stages (id) on delete cascade,
  task_stage_id uuid references public.task_stages (id) on delete cascade,
  -- pending: waiting. approved / changes_requested: decided. cancelled: withdrawn by the requester
  -- or a manager, or dropped when the item moved back. superseded: was approved, but the item
  -- moved back to that stage or earlier, so it no longer counts (kept for history).
  status text not null default 'pending' check (status in ('pending', 'approved', 'changes_requested', 'cancelled', 'superseded')),
  request_note text check (request_note is null or length(request_note) <= 2000),
  request_link text check (request_link is null or (length(request_link) <= 2000 and request_link ~* '^https?://')),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  -- null when decided by the client (via the portal), or when the row was cancelled by a move.
  decided_by uuid references public.profiles (id) on delete set null,
  decided_via text check (decided_via in ('staff', 'portal')),
  decided_at timestamptz,
  decision_comment text check (decision_comment is null or length(decision_comment) <= 2000),
  version integer not null default 1,
  constraint stage_approvals_one_subject check (
    (event_id is not null and event_stage_id is not null and task_id is null and task_stage_id is null) or
    (task_id is not null and task_stage_id is not null and event_id is null and event_stage_id is null))
);

-- At most one pending request per stage (the API maps the violation to 409 STAGE_APPROVAL_PENDING).
create unique index stage_approvals_one_pending_event on public.stage_approvals (event_stage_id) where status = 'pending' and event_stage_id is not null;
create unique index stage_approvals_one_pending_task on public.stage_approvals (task_stage_id) where status = 'pending' and task_stage_id is not null;

-- An item's rounds, newest first; the move gate's "which stages are approved" read.
create index stage_approvals_event_idx on public.stage_approvals (event_id, requested_at desc) where event_id is not null;
create index stage_approvals_task_idx on public.stage_approvals (task_id, requested_at desc) where task_id is not null;
-- The approvals inbox and the badge: pending ones, oldest first/last.
create index stage_approvals_pending_idx on public.stage_approvals (requested_at desc) where status = 'pending';

-- A supporting index for every other foreign key (partial where nullable).
create index stage_approvals_event_stage_idx on public.stage_approvals (event_stage_id) where event_stage_id is not null;
create index stage_approvals_task_stage_idx on public.stage_approvals (task_stage_id) where task_stage_id is not null;
create index stage_approvals_requested_by_idx on public.stage_approvals (requested_by) where requested_by is not null;
create index stage_approvals_decided_by_idx on public.stage_approvals (decided_by) where decided_by is not null;

-- ------------------------------------------------- Data API (defence in depth) --

-- hok-api reads and writes through a direct Postgres connection. The Data API roles get
-- nothing (as for every table since 20261030000004): row-level security is on with no
-- policies, a second wall.
grant select, insert, update, delete on public.stage_approvals to service_role;
revoke all on public.stage_approvals from anon, authenticated;

alter table public.stage_approvals enable row level security;
