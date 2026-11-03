# Round 2 spec: task templates and stages, task links, client-visible assets

Source: [PLAN-team-feedback-2026-11.md](../PLAN-team-feedback-2026-11.md) steps C + D (decisions 4, 7 and 8).
Builders: **API** (`hok-api`) and **Web** (`hok-web`), in parallel, joined by the contract in §7.
Reviewer: Opus.
Round 1 is committed (`5cb99cd`), so build on it.

## 0. Rules for every helper

**Exactly the rules in [round-1.md §0](round-1.md)**, which you must read. Plus these:

- Don't edit any spec. Put gaps and doubts in your final message.
- Additive database changes only:
  - no `drop`, no column renames, no type changes on existing columns;
  - backfills are fine;
  - old columns that are no longer used stay in place, marked with a `-- shortcut:` comment.
- Production runs migrations before the new API is deployed, so the **old API must keep working against the new schema** for a few minutes. Only add columns that are nullable or have defaults; new NOT NULL constraints come only after a backfill, in the same migration.

---

## 1. Stage templates get a kind: event or task (API)

### Migration `supabase/migrations/20261103000001_task_stages_links_client_assets.sql`

One file covers all of §1–§4.

**On `stage_templates`:**
- `kind text not null default 'event' check (kind in ('event','task'))`.
- `roles text[] not null default '{}'`: for task templates, the assignee roles it's offered for. Empty means any role. A CHECK keeps every element a valid role other than `admin`; mirror the role list from `20261101000001_content_writer_role.sql`.
- Index `(kind, active, lower(name))`.
- Names stay unique across both kinds (the existing unique index).

### API
- Create takes `kind` (default `event`) and `roles` (allowed only when `kind = 'task'`; otherwise a 400 `STAGE_TEMPLATE_ROLES_INVALID`).
- Update can change `roles` but never `kind`. A `kind` in an update is a 400 `VALIDATION_ERROR`, or drop it from the DTO.
- The list gets filters `kind=event|task` and `role=<role>`. The role filter returns task templates whose `roles` is empty or contains that role.
- **Event creation** must refuse a task template, and **task creation** an event template: 400 `EVENT_TEMPLATE_INVALID` / `STAFF_TASK_TEMPLATE_INVALID`. This goes through the existing `assertTemplateUsable`, extended with a `kind`.
- **Picking a template:** event creators read event templates as they do today. Anyone with `staff_tasks:assign` (Admin and managers) must be able to read **active** task templates for the picker. Check how the event form reads templates today (what capability guards `GET /stage-templates`) and give managers the same read access for `kind=task`. Template management stays Admin-only.

---

## 2. Tasks move through stages (API)

### Migration (same file)

```sql
create table public.task_stages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.staff_tasks (id) on delete cascade,
  position integer not null check (position between 1 and 20),
  name text not null check (length(btrim(name)) between 1 and 60),
  unique (task_id, position),
  unique (id, task_id)
);
alter table public.staff_tasks
  add column template_id uuid references public.stage_templates (id) on delete set null,
  add column template_name text,
  add column current_stage_id uuid,
  add column stage_count integer check (stage_count between 1 and 20),
  add column blocked_reason text check (blocked_reason is null or length(blocked_reason) <= 1000);
alter table public.staff_tasks add constraint staff_tasks_current_stage_fk
  foreign key (current_stage_id, id) references public.task_stages (id, task_id) deferrable initially deferred;
```

**Backfill for existing rows.** Production has none; the local DB has seed and test rows. Give each existing task three stages snapshotted on the task itself (no template row): `To do`, `In progress`, `Done`.
- `template_name = 'Simple (older task)'`, `stage_count = 3`.
- `current_stage_id` by status: todo → 1, in_progress or blocked → 2, done → 3.
- Then `template_name` and `stage_count` become NOT NULL. `current_stage_id` stays nullable, like `events`.

**Updates timeline:** add nullable `from_stage_id` and `to_stage_id` to `staff_task_updates` (FK `task_stages` on delete cascade). Widen the `kind` CHECK (find it in `20261014200001_staff_tasks.sql`) with `stage`, `completed`, `blocked` and `unblocked`.

Add indexes for every new FK, following the `20261017000001_foreign_key_indexes.sql` style.

Grants, RLS and revokes for `task_stages`: copy what `event_stages` has, adjusted to the state after `20261030000004_revoke_data_api_reads.sql`.

### Status is now derived from the stage

The `status` column stays, because dashboards, filters, the board and reminders use it. It is set **only** by these rules:

| Situation | status |
|---|---|
| at stage 1 | `todo` |
| at stage 2..N | `in_progress` |
| completed (moved past the last stage) | `done` (and `completed_at` set) |
| blocked flag raised | `blocked` (the stage doesn't change) |

Put these as pure functions in `staff-task.rules.ts`: `statusForStage(position, stageCount)` and `assertStageMove(...)`. Mirror the events' `assertStageMove` (any stage, forward or back; refuse the current stage; refuse a stage of another task; refuse when `done`).

### Endpoints (they replace `POST /staff-tasks/:id/status`, which is **removed**)

| Method | Path | Body | Who | Effect |
|---|---|---|---|---|
| POST | `/staff-tasks` | adds required `templateId`; removes `rawFilesUrl`, `referenceUrl`, `referenceLinks`, `script`; adds optional `brief` (≤20000) and optional `links: {url,label?}[]` (≤20, kind `brief`) | as round 1 | Snapshots the template's stages, starts at stage 1, status `todo`. Template must be `kind='task'` and active, and its `roles` must be empty or include the assignee's role (else 400 `STAFF_TASK_TEMPLATE_INVALID`). |
| PATCH | `/staff-tasks/:id` | same field changes as above; **no** `templateId` (stages are fixed once created) | canManage | `brief` editable. Reassigning to someone whose role the task's template didn't list is allowed (the stages are already snapshotted). |
| POST | `/staff-tasks/:id/stage` | `{ version, stageId?, complete?: true, comment? }`, exactly one of `stageId` / `complete` | assignee, creator, Admin | Moves to any stage, or completes (only from the last stage, else 409 `STAFF_TASK_NOT_AT_LAST_STAGE`). Clears `blocked_reason`, recomputes status, writes a timeline entry (`stage` or `completed`). |
| POST | `/staff-tasks/:id/block` | `{ version, reason }` (1–1000) | assignee, Admin | status `blocked`, `blocked_reason` set, timeline `blocked`. 409 if already blocked or done. |
| POST | `/staff-tasks/:id/unblock` | `{ version, comment? }` | assignee, creator, Admin | Status back from the stage, reason cleared, timeline `unblocked`. 409 if not blocked. |
| POST | `/staff-tasks/:id/reopen` | `{ version, stageId?, comment? }` (was `status`) | canManage | Only from `done`. Moves to `stageId` (default: the last stage), status from the stage, `completed_at` cleared, timeline `reopened`. |

- Detail and summary responses add `templateName`, `stageCount`, `currentStage {id,name,position}` and `blockedReason`. The detail adds `stages: {id,name,position}[]`.
- The timeline entries carry `fromStageName` and `toStageName`, joined in the existing query (no N+1).
- **Notifications:** reuse `task_status_changed` for stage, completed, blocked and unblocked, with the stage name and the reason in the payload. Update the message builder: "moved X to Rough cut", "completed X", "blocked X: <reason>". Recipients: the existing `otherSide` rule.
- The calendar `task` item adds `currentStageName`, `currentStagePosition` and `stageCount`, joined in the calendar's task query.
- The reopen DTO and every test that used `/status` must be updated. Remove the old status DTO and route.

---

## 3. Links on every task (API)

### Migration (same file)

```sql
create table public.staff_task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.staff_tasks (id) on delete cascade,
  kind text not null check (kind in ('brief','delivered')),
  url text not null check (length(url) between 1 and 2000 and url ~* '^https?://'),
  label text check (label is null or length(btrim(label)) between 1 and 120),
  stage_id uuid references public.task_stages (id) on delete set null,
  added_by uuid references public.profiles (id) on delete set null,
  shared_asset_id uuid references public.assets (id) on delete set null,
  created_at timestamptz not null default now()
);
create index staff_task_links_task_idx on public.staff_task_links (task_id, kind, created_at);
-- plus FK indexes for stage_id, added_by and shared_asset_id (partial, where not null)
```

**Backfill:**
- `raw_files_url` → a `brief` link labelled "Raw files".
- `reference_url` → a `brief` link labelled "Reference edit".
- Each `reference_links` element → a `brief` link with its label.
- `added_by` is the task's `assigned_by`.
- Leave the old columns in place with a `-- shortcut: unused since round 2, drop in a later cleanup migration` comment.
- `script` stays as the column behind the API's `brief` field. Don't rename it.

### Endpoints

| Method | Path | Body | Who |
|---|---|---|---|
| POST | `/staff-tasks/:id/links` | `{ kind, url, label?, stageId? }` | `brief`: canManage. `delivered`: the assignee or the Admin. |
| DELETE | `/staff-tasks/:id/links/:linkId` | – | whoever added it, or canManage |
| POST | `/staff-tasks/:id/links/:linkId/share` | `{ title?, stageId? }` (an **event** stage id) | see §4 |

- Every route checks task visibility first (404), then the role rule (403 `STAFF_TASK_FORBIDDEN`).
- At most 50 links per task (409 `STAFF_TASK_LINKS_LIMIT`).
- The URL must be http(s); validate it in zod with the same URL helper assets use.
- `stageId` must be one of the task's stages (400).
- The detail response gets `links: { id, kind, url, label, stageId, stageName, addedById, addedByName, createdAt, sharedAssetId }[]`, newest last, in one query.
- Audit: `staff_task.link_added` and `staff_task.link_removed`. Add them to `audit-actions`.

---

## 4. Client-visible assets (API)

### Migration (same file)

```sql
alter table public.assets
  add column visible_to_client boolean not null default false,
  add column event_stage_id uuid references public.event_stages (id) on delete set null;
create index assets_event_client_visible_idx on public.assets (event_id, created_at desc)
  where visible_to_client and deleted_at is null;
create index if not exists assets_event_stage_idx on public.assets (event_stage_id) where event_stage_id is not null;
```

### Assets API
- Create and update accept `visibleToClient` (boolean) and `eventStageId` (nullable).
- `visibleToClient = true` needs `eventId` set: the portal shows assets per event (400 `ASSET_CLIENT_VISIBLE_NEEDS_EVENT`).
- `eventStageId` must be a stage of the asset's event (400 `ASSET_STAGE_INVALID`).
- Clearing or changing `eventId` clears `eventStageId`, and also `visibleToClient` if the event becomes null.
- Responses add `visibleToClient` and `eventStageId`/`eventStageName`.
- The list gets a filter `visibleToClient=true`.
- Audit: the existing asset update entry with the field names.

### Portal (`portal-public.service.ts` + repo)
- `GET /portal/:token/events/:eventId` adds `assets: { id, title, url, type, stageName: string|null, createdAt }[]`:
  - only `visible_to_client and deleted_at is null and event_id = :eventId and client_id = ctx.clientId`;
  - newest first, max 100, one query;
  - **no** comment, tags, preview fields or creator, because they are internal.
  - Update `portal.entity.ts`, its client-safe shape comment, and the portal integration tests, including one proving an unmarked asset and another client's asset never appear.
- The dashboard is unchanged.

### "Share with client" from a delivered link
`POST /staff-tasks/:id/links/:linkId/share`:
- The link must be `kind='delivered'` and not already shared (409 `STAFF_TASK_LINK_ALREADY_SHARED`).
- The task must have an `eventId` (409 `STAFF_TASK_NO_EVENT`).
- The caller must be able to write assets on that event's client: the Admin, or on its team, via the same rule as `assets:write` with `isOnTeam`. Otherwise 403 `STAFF_TASK_FORBIDDEN`. Note that an editor (level 3) can't share; their manager does.
- In **one transaction**:
  - insert an asset: `client_id` and `event_id` from the task, `title` = body title or link label or "Delivered work", `url`, type `other` (or the closest existing type, so check `AssetType`), `visible_to_client = true`, `event_stage_id` = body stageId if it's a stage of that event, `created_by` = caller;
  - set `staff_task_links.shared_asset_id`.
  - Cross-module write, Infrastructure-to-Infrastructure per ADR 0003, with a one-line comment.
- Audit `asset.created` and `staff_task.link_shared`.
- Queue the link-preview fetch the same way asset creation does today, if that's easy. Otherwise skip it and note that in your report.

---

## 5. Web

### Templates admin (`modules/stage-templates`, `app/(main)/app/templates`)
- A segmented **Events | Tasks** switch at the top. The list and "New template" follow it.
- The task template form adds a **"For roles"** multi-select of every role except Admin, with a hint: "Empty = any role". The role labels come from `ROLE_LABELS`.
- `kind` is shown, read-only, on edit.

### Event form
- Its template picker asks for `kind=event`. Check it doesn't show task templates.

### Task form (`TaskFormModal`)
- Field order: assignee (ladder-filtered, as in round 1), then **template**, required. It's a `SearchSelect` filtered by `kind=task&role=<assignee role>&active=true`, disabled until an assignee is picked, and it shows the stage names as a preview under the picker.
- Then title, description, **Brief** (a textarea for the script or instructions, on every task), due date, priority, client/event, and a small **Brief links** list (add url + label rows, max 20).
- Remove the editor-only fields block.
- On edit: no template picker (it shows the template name and the fixed stages). Brief and other fields stay editable.

### Task detail (`TaskDetailClient`)
- A **stage tracker**, the same visual pattern as the event detail's stage tracker; reuse that component if it's generic enough, otherwise mirror it.
- **Actions** for the assignee, creator and Admin:
  - "Move to <next stage>" as the primary button;
  - a stage menu to jump to any stage, with an optional comment;
  - on the last stage, "Mark complete".
- **Blocked:** a "Blocked" banner with the reason. The assignee and Admin see "Mark blocked" (reason required); the assignee, creator and Admin see "Unblock".
- **Reopen** (canManage, on done tasks): pick a stage, default the last.
- **Links area** with two lists:
  - **Brief and inputs**: the creator, manager or Admin adds.
  - **Delivered work**: the assignee or Admin adds.
  - Each row shows the label (or the URL host), the stage chip, who added it and when, open in a new tab (`rel="noopener noreferrer"`), and delete (when allowed).
  - On delivered links, a **"Share with client"** button. Show it only when the task has an event and the viewer can manage that client: Admin, or on the team. Use a `canShare` flag from the API on the detail; add it to the contract if needed. It opens a small modal with a title and an optional event stage. After sharing, show "Shared with client ✓".
- The timeline shows stage moves, completions, blocks and unblocks in plain words.
- The "View only" banner for team managers stays.

### Lists, board and calendar
- Task list rows and board cards show the current stage, e.g. "Rough cut · 2/5", next to the status pill.
- The board still groups by status.
- Calendar task chips and the day pop-up show the stage name.

### Assets (`modules/assets`)
- The asset form gets a **"Show to client"** switch, enabled only when an event is picked, plus an optional **stage** select (that event's stages).
- Lists show a "Client can see" badge, and get a filter for it.

### Portal (`modules/client-portal` / the `/p/[token]` event page)
- A **"Shared with you"** section on the event page listing the visible assets: type icon, title, stage chip, date, open link (new tab, `rel="noopener noreferrer"`).
- Hide the section when the list is empty.
- Keep the plain portal style.

### Guide
- Update the tasks entry (templates, stages, links, blocked) and the templates entry (task templates for roles).
- Add a line about "Show to client".

### Tests
- Unit tests for any new pure helpers, such as the stage progress label.
- Playwright:
  1. Admin creates a task template "Reel edit" for Editors. An SMM assigns a task with it to the editor. The editor moves it through the stages, adds a delivered link and completes it. The SMM sees it done.
  2. The SMM shares the delivered link with the client. The portal event page shows it under "Shared with you".
  3. An unmarked asset never appears in the portal.
- Update the existing staff-tasks e2e test for the new form (template required) and the removed status buttons.

---

## 6. Seed, permission matrix and tests (API helper)

- **Seed:** add 2 task templates ("Reel edit" for editor; "Caption writing" for content_writer) and 1 generic one with no roles. Every seeded task uses a template. One editor task has brief links and a delivered link. One asset on a seeded event is marked visible to the client.
- **RBAC matrix:** add rows for:
  - `/stage` (assignee 200, creator 200, team manager 403, stranger 404);
  - `/block` (assignee 200, creator 403);
  - `/unblock`;
  - `/links` (brief: creator 201 / assignee 403; delivered: assignee 201 / creator 403);
  - delete link;
  - `/share` (creator-manager on team 201, assignee 403, task with no event 409);
  - `GET /stage-templates?kind=task` (managers 200, task-only staff 403);
  - template management (Admin only);
  - removed `/status` (404 for all).
- **Integration tests:** stage moves and derived status, complete only from the last stage, block/unblock, reopen to a stage, links limit, the share transaction (asset + link marked in one go, rolled back on failure), and portal assets scoping.
- The query-budget tests for task detail and the portal event must stay within budget: links, stages and timeline each as one query.

---

## 7. Contract (both helpers)

```
StageTemplate += { kind: "event"|"task", roles: Role[] }
GET  /stage-templates?kind=event|task&role=<role>&active=true&search&limit&offset
POST /stage-templates { name, stages: string[], kind?: "event"|"task", roles?: Role[] }
PATCH /stage-templates/:id { version, name?, stages?, active?, roles? }

StaffTaskSummary += { templateName, stageCount, currentStage: {id,name,position}, blockedReason: string|null }
StaffTaskDetail  += { stages: {id,name,position}[], brief: string|null, links: TaskLink[], canShare: boolean }
                  -= { rawFilesUrl, referenceUrl, referenceLinks, script }
TaskLink = { id, kind: "brief"|"delivered", url, label: string|null, stageId: string|null, stageName: string|null,
             addedById: string|null, addedByName: string|null, createdAt, sharedAssetId: string|null }
Timeline entry += { fromStageName: string|null, toStageName: string|null }, kinds += stage|completed|blocked|unblocked

POST  /staff-tasks { title, assigneeId, templateId, description?, brief?, dueAt?, priority?, clientId?, eventId?, links?: {url,label?}[] }
PATCH /staff-tasks/:id { version, title?, description?, brief?, dueAt?, priority?, clientId?, eventId?, assigneeId? }
POST  /staff-tasks/:id/stage   { version, stageId?: string, complete?: true, comment?: string }
POST  /staff-tasks/:id/block   { version, reason }
POST  /staff-tasks/:id/unblock { version, comment? }
POST  /staff-tasks/:id/reopen  { version, stageId?, comment? }
POST  /staff-tasks/:id/links   { kind, url, label?, stageId? } -> 201 { task }
DELETE /staff-tasks/:id/links/:linkId -> { task }
POST  /staff-tasks/:id/links/:linkId/share { title?, stageId? } -> 201 { task, assetId }
(removed) POST /staff-tasks/:id/status

Asset += { visibleToClient: boolean, eventStageId: string|null, eventStageName: string|null }
POST/PATCH /assets... += { visibleToClient?, eventStageId? };  GET /assets?visibleToClient=true
Portal event detail += { assets: { id, title, url, type, stageName: string|null, createdAt }[] }
CalendarTaskItem += { currentStageName, currentStagePosition, stageCount }

New error codes: STAGE_TEMPLATE_ROLES_INVALID, STAFF_TASK_TEMPLATE_INVALID, STAFF_TASK_NOT_AT_LAST_STAGE,
  STAFF_TASK_STAGE_INVALID, STAFF_TASK_STAGE_UNCHANGED, STAFF_TASK_ALREADY_BLOCKED, STAFF_TASK_NOT_BLOCKED,
  STAFF_TASK_LINKS_LIMIT, STAFF_TASK_LINK_ALREADY_SHARED, STAFF_TASK_NO_EVENT, STAFF_TASK_LINK_NOT_FOUND,
  ASSET_CLIENT_VISIBLE_NEEDS_EVENT, ASSET_STAGE_INVALID
```

Writes on a task (stage, block, unblock, reopen, links, share) return the fresh detail as `{ task }`, as today.
