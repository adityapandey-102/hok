-- Every foreign key gets a supporting index (index audit, 2026-10-17).
--
-- Before this, 16 single-column foreign keys had no index. They are "who did
-- it" / "came from" links (created_by, changed_by, author_id, actor_id, …)
-- that no current list filters on, so reads never needed them -- but:
--   * deleting or SET-NULLing a parent row (a profile, a template, a portal
--     link) made Postgres scan the whole child table to find references;
--   * Phase 2 reports and the activity log read exactly these columns
--     ("what did this person do, newest first").
--
-- Nullable columns get PARTIAL indexes (`where … is not null`): rows without a
-- value never enter the index, so it stays small; `col = $1` (a strict
-- comparison, as the FK checks use) implies `col is not null`, so the planner
-- can use them. The two growing logs the reports read by person also carry
-- created_at, so "this person's latest N" is one ordered index range.
-- All small tables today: plain CREATE INDEX (no CONCURRENTLY needed locally).

-- Who created what (SET NULL on profile delete).
create index if not exists stage_templates_created_by_idx on public.stage_templates (created_by) where created_by is not null;
create index if not exists events_created_by_idx on public.events (created_by) where created_by is not null;
create index if not exists assets_created_by_idx on public.assets (created_by) where created_by is not null;
create index if not exists portal_links_created_by_idx on public.portal_links (created_by) where created_by is not null;
create index if not exists staff_tasks_assigned_by_idx on public.staff_tasks (assigned_by) where assigned_by is not null;

-- Where an event came from (SET NULL when a template is removed).
create index if not exists events_template_idx on public.events (template_id) where template_id is not null;

-- Stage moves: who moved it (reports: by person, newest first) and the stage ids.
create index if not exists event_stage_history_changed_by_idx on public.event_stage_history (changed_by, created_at desc) where changed_by is not null;
create index if not exists event_stage_history_from_stage_idx on public.event_stage_history (from_stage_id) where from_stage_id is not null;
create index if not exists event_stage_history_to_stage_idx on public.event_stage_history (to_stage_id);

-- Task timeline: who wrote / reassigned (reports: by person, newest first).
create index if not exists staff_task_updates_author_idx on public.staff_task_updates (author_id, created_at desc) where author_id is not null;
create index if not exists staff_task_updates_from_assignee_idx on public.staff_task_updates (from_assignee_id) where from_assignee_id is not null;
create index if not exists staff_task_updates_to_assignee_idx on public.staff_task_updates (to_assignee_id) where to_assignee_id is not null;

-- Client comments: which link it came through, who replied, who changed status.
create index if not exists client_comments_portal_link_idx on public.client_comments (portal_link_id) where portal_link_id is not null;
create index if not exists client_comments_replied_by_idx on public.client_comments (replied_by) where replied_by is not null;
create index if not exists client_comment_history_changed_by_idx on public.client_comment_history (changed_by) where changed_by is not null;

-- Notifications: who caused it (SET NULL on profile delete; the table grows forever).
create index if not exists notifications_actor_idx on public.notifications (actor_id) where actor_id is not null;
