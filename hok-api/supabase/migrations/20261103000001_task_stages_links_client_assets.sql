-- Round 2 (decisions 4, 7 and 8, 2026-11-03): task templates and stages, links
-- on every task, and assets the client can see.
--
-- 1. stage_templates get a kind ('event' | 'task') and, for task templates, the
--    roles they are offered for.
-- 2. A task moves through stages snapshotted from a task template at creation
--    (task_stages), the way an event does. `status` stays and is derived from
--    the stage by the API (stage 1 = todo, 2..N = in_progress, past the last =
--    done, blocked flag = blocked).
-- 3. staff_task_links: plain links on every task, "brief" (inputs) or
--    "delivered" (finished work); a delivered one can be shared with the client.
-- 4. assets can be marked visible to the client (shown on the portal under their
--    event) and tied to one of that event's stages.
--
-- ADDITIVE ONLY. Production runs migrations before the new API is deployed, so
-- the OLD API keeps running against this schema for a few minutes: new columns
-- are nullable or have defaults, nothing is dropped or renamed, and a task the
-- old API inserts still gets its stages (see the trigger below). The only
-- constraint touched is staff_task_updates.kind, widened (never narrowed).

-- ------------------------------------------------ 1. template kind + roles --

alter table public.stage_templates
  add column kind text not null default 'event' check (kind in ('event', 'task')),
  -- The assignee roles a TASK template is offered for; empty = any role. Mirrors
  -- profiles_role_check (20261101000001_content_writer_role.sql) minus 'admin'.
  add column roles text[] not null default '{}'
    check (roles <@ array['social_media_manager', 'marketing_manager', 'project_manager', 'marketing_agent', 'developer', 'editor', 'content_writer']::text[]),
  add constraint stage_templates_roles_task_only_chk check (kind = 'task' or roles = '{}');

-- The picker: active templates of one kind by name. (Names stay unique across
-- both kinds: stage_templates_name_key is unchanged.)
create index stage_templates_kind_active_name_idx on public.stage_templates (kind, active, lower(name));

-- ----------------------------------------------------------- 2. task stages --

create table public.task_stages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.staff_tasks (id) on delete cascade,
  position integer not null check (position between 1 and 20),
  name text not null check (length(btrim(name)) between 1 and 60),
  unique (task_id, position),
  -- Target of staff_tasks' composite FK: a current stage must belong to its task.
  unique (id, task_id)
);

alter table public.staff_tasks
  -- Which task template it came from (null once that template is ever deleted --
  -- the API never deletes templates) and its name at the time, for display.
  add column template_id uuid references public.stage_templates (id) on delete set null,
  add column template_name text,
  -- Always one of THIS task's stages (composite FK below). Nullable only for the
  -- instant between inserting the task and its stages, like events.
  add column current_stage_id uuid,
  -- Stages never change after creation, so their count is a snapshot too.
  add column stage_count integer check (stage_count between 1 and 20),
  -- Why it is blocked (status = 'blocked'); cleared on unblock and on every stage move.
  add column blocked_reason text check (blocked_reason is null or length(blocked_reason) <= 1000);

-- Backfill: every existing task gets three stages of its own (no template row):
-- To do / In progress / Done, and sits at the one its status maps to.
-- Production has no tasks; the local database has seed and test rows.
-- (The updated_at trigger is paused so the backfill doesn't rewrite every date.)
alter table public.staff_tasks disable trigger staff_tasks_set_updated_at;

insert into public.task_stages (task_id, position, name)
select t.id, s.position, s.name
from public.staff_tasks t
cross join (values (1, 'To do'), (2, 'In progress'), (3, 'Done')) as s (position, name);

update public.staff_tasks t
set template_name = 'Simple (older task)',
    stage_count = 3,
    current_stage_id = (
      select ts.id from public.task_stages ts
      where ts.task_id = t.id
        and ts.position = case t.status when 'todo' then 1 when 'done' then 3 else 2 end
    );

alter table public.staff_tasks enable trigger staff_tasks_set_updated_at;

-- The defaults keep the old API's INSERTs working during the deploy window.
alter table public.staff_tasks
  alter column template_name set default 'Simple (older task)',
  alter column template_name set not null,
  alter column stage_count set default 3,
  alter column stage_count set not null;

alter table public.staff_tasks
  add constraint staff_tasks_current_stage_fk
  foreign key (current_stage_id, id) references public.task_stages (id, task_id)
  deferrable initially deferred;

-- A task inserted WITHOUT a current stage and without a template is the old API's
-- (the new API always names its stage): give it the same three simple stages as
-- the backfill so it is never stage-less. Harmless once the old API is gone.
create function public.staff_tasks_default_stages()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.current_stage_id is null and new.template_id is null and new.template_name = 'Simple (older task)' then
    insert into public.task_stages (task_id, position, name)
    values (new.id, 1, 'To do'), (new.id, 2, 'In progress'), (new.id, 3, 'Done');
    update public.staff_tasks
    set current_stage_id = (
      select ts.id from public.task_stages ts
      where ts.task_id = new.id
        and ts.position = case new.status when 'todo' then 1 when 'done' then 3 else 2 end
    )
    where id = new.id;
  end if;
  return null;
end
$$;

create trigger staff_tasks_default_stages
  after insert on public.staff_tasks
  for each row
  execute function public.staff_tasks_default_stages();

-- The timeline records stage moves. Nullable, so old rows and the old API are unaffected.
alter table public.staff_task_updates
  add column from_stage_id uuid references public.task_stages (id) on delete cascade,
  add column to_stage_id uuid references public.task_stages (id) on delete cascade;

-- Widen (never narrow) the kinds: stage = moved to a stage, completed = moved past
-- the last stage, blocked / unblocked = the blocked flag.
alter table public.staff_task_updates drop constraint staff_task_updates_kind_check;
alter table public.staff_task_updates add constraint staff_task_updates_kind_check check (kind in (
  'created', 'status', 'comment', 'reassigned', 'reopened', 'stage', 'completed', 'blocked', 'unblocked'
));

-- A supporting index for every new foreign key (20261017000001 style: partial where nullable).
create index staff_tasks_template_idx on public.staff_tasks (template_id) where template_id is not null;
create index staff_tasks_current_stage_idx on public.staff_tasks (current_stage_id) where current_stage_id is not null;
create index staff_task_updates_from_stage_idx on public.staff_task_updates (from_stage_id) where from_stage_id is not null;
create index staff_task_updates_to_stage_idx on public.staff_task_updates (to_stage_id) where to_stage_id is not null;
-- task_stages.task_id is served by the unique (task_id, position) index.

-- ------------------------------------------------------------ 3. task links --

create table public.staff_task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.staff_tasks (id) on delete cascade,
  -- brief = inputs the assignee works from; delivered = the finished work.
  kind text not null check (kind in ('brief', 'delivered')),
  -- http(s) only: the API validates with isValidHttpUrl; this is the backstop.
  url text not null check (length(url) between 1 and 2000 and url ~* '^https?://'),
  label text check (label is null or length(btrim(label)) between 1 and 120),
  -- The task stage it belongs to (optional); SET NULL, stages go only with their task.
  stage_id uuid references public.task_stages (id) on delete set null,
  added_by uuid references public.profiles (id) on delete set null,
  -- Set when a delivered link is shared with the client (the asset it became).
  shared_asset_id uuid references public.assets (id) on delete set null,
  created_at timestamptz not null default now()
);

-- A task's links by kind, oldest first.
create index staff_task_links_task_idx on public.staff_task_links (task_id, kind, created_at);
create index staff_task_links_stage_idx on public.staff_task_links (stage_id) where stage_id is not null;
create index staff_task_links_added_by_idx on public.staff_task_links (added_by) where added_by is not null;
create index staff_task_links_shared_asset_idx on public.staff_task_links (shared_asset_id) where shared_asset_id is not null;

-- Backfill from the editor brief and reference links, all as "brief" links added by
-- the task's creator. The old columns stay in place, unused.
-- shortcut: raw_files_url, reference_url and reference_links are unused since round 2, drop in a later cleanup migration.
-- (`script` stays: it is the column behind the API's `brief` field.)
insert into public.staff_task_links (task_id, kind, url, label, added_by, created_at)
select t.id, 'brief', t.raw_files_url, 'Raw files', t.assigned_by, t.created_at
from public.staff_tasks t
where t.raw_files_url is not null and length(t.raw_files_url) <= 2000 and t.raw_files_url ~* '^https?://';

insert into public.staff_task_links (task_id, kind, url, label, added_by, created_at)
select t.id, 'brief', t.reference_url, 'Reference edit', t.assigned_by, t.created_at + interval '1 millisecond'
from public.staff_tasks t
where t.reference_url is not null and length(t.reference_url) <= 2000 and t.reference_url ~* '^https?://';

insert into public.staff_task_links (task_id, kind, url, label, added_by, created_at)
select t.id, 'brief', e.link ->> 'url', nullif(left(btrim(coalesce(e.link ->> 'label', '')), 120), ''),
       t.assigned_by, t.created_at + (e.ord + 1) * interval '1 millisecond'
from public.staff_tasks t
cross join lateral jsonb_array_elements(t.reference_links) with ordinality as e (link, ord)
where jsonb_typeof(t.reference_links) = 'array'
  and e.link ->> 'url' is not null
  and length(e.link ->> 'url') <= 2000
  and e.link ->> 'url' ~* '^https?://';

-- ------------------------------------------------ 4. client-visible assets --

alter table public.assets
  add column visible_to_client boolean not null default false,
  -- One of the asset's event's stages (the API checks); SET NULL if a stage row is ever removed.
  add column event_stage_id uuid references public.event_stages (id) on delete set null;

-- The portal's "Shared with you" list for one event, newest first (live, visible rows only).
create index assets_event_client_visible_idx on public.assets (event_id, created_at desc)
  where visible_to_client and deleted_at is null;
create index if not exists assets_event_stage_idx on public.assets (event_stage_id) where event_stage_id is not null;

-- ------------------------------------------------- Data API (defence in depth) --

-- hok-api reads and writes through a direct Postgres connection. The Data API
-- roles get nothing (as for every table since 20261030000004): row-level
-- security is on with no policies, a second wall.
grant select, insert, update, delete on public.task_stages, public.staff_task_links to service_role;
revoke all on public.task_stages, public.staff_task_links from anon, authenticated;

alter table public.task_stages enable row level security;
alter table public.staff_task_links enable row level security;
