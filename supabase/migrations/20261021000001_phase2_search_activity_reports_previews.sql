-- Phase 2: global search, activity log, reports and link previews
-- (REQUIREMENTS FR-SYS-01/02, FR-RPT-01..05, FR-AST-08).

-- ------------------------------------------------------------ global search --
-- Title search across events, staff tasks and client to-dos ("ILIKE '%term%'",
-- escaped by containsPattern). Clients (business_name) and assets (title,
-- comment, tags) already have trigram indexes (M3 / M6).
create index if not exists events_title_trgm_idx on public.events using gin (title gin_trgm_ops);
create index if not exists staff_tasks_title_trgm_idx on public.staff_tasks using gin (title gin_trgm_ops);
create index if not exists client_todos_title_trgm_idx on public.client_todos using gin (title gin_trgm_ops);

-- ------------------------------------------------- activity log / daily activity --
-- "What happened between <from> and <to>, newest first", firm-wide. The
-- history tables were only indexed per record (event, task, comment) and per
-- person; a time-range feed needs created_at itself. audit_log already has
-- (created_at desc) and (actor_id, created_at desc).
create index if not exists event_stage_history_created_idx on public.event_stage_history (created_at desc);
create index if not exists staff_task_updates_created_idx on public.staff_task_updates (created_at desc);
create index if not exists client_comment_history_created_idx on public.client_comment_history (created_at desc);
-- Comments clients post (the feed's "new client comment" rows).
create index if not exists client_comments_created_idx on public.client_comments (created_at desc);

-- ------------------------------------------------------------------ reports --
-- Staff report: "tasks this person finished in <month>" (on time vs late).
-- Assigned-in-month already uses staff_tasks_assignee_created_idx.
create index if not exists staff_tasks_assignee_completed_idx on public.staff_tasks (assignee_id, completed_at)
  where completed_at is not null;

-- ------------------------------------------------------------- link previews --
-- What the link points to, fetched once by hok-api when the asset is saved
-- (server-side, http(s) only, public addresses only, small and time-boxed).
-- All optional: a link without a preview shows its URL as before.
alter table public.assets add column if not exists preview_title text check (length(preview_title) <= 300);
alter table public.assets add column if not exists preview_description text check (length(preview_description) <= 500);
alter table public.assets add column if not exists preview_image_url text check (length(preview_image_url) <= 2048);
alter table public.assets add column if not exists preview_site_name text check (length(preview_site_name) <= 120);
-- When the fetch last ran (success or not), so it isn't retried on every save.
alter table public.assets add column if not exists preview_fetched_at timestamptz;
alter table public.assets drop constraint if exists assets_preview_image_url_http_chk;
alter table public.assets add constraint assets_preview_image_url_http_chk
  check (preview_image_url is null or preview_image_url ~* '^https?://');
