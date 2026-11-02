# Round 1 spec: role ladder, calendar for everyone, day pop-up, My to-dos

Source: [PLAN-team-feedback-2026-11.md](../PLAN-team-feedback-2026-11.md) steps A + B, approved 2026-11-02.
Builders: two helpers in parallel, **API** (`hok-api`) and **Web** (`hok-web`), joined by the contract in §6.
Reviewer: Opus, after both are done.

---

## 0. Rules for every helper (read first, no exceptions)

1. Work **only** inside your own app folder (`hok-api/` or `hok-web/`), plus this spec if you find a gap (note it under §9; don't silently change the spec).
2. **No git commands that write**: no commit, push, checkout, reset, stash or restore. `git diff` and `git status` are fine.
3. **No Docker or Supabase CLI commands**: no `supabase start/stop/db reset`. The local stack is already running (DB `localhost:54422`, Supabase API `54421`). The API dev server (4100) and web dev server (3400) are already running; don't kill them. To apply your new migration locally, run the SQL file against the local DB with `psql` or a Node script using `DATABASE_URL` from `hok-api/.env`. Never print `.env` values.
4. Follow `.claude/skills/hok-practices/SKILL.md` (read it) and the patterns of the surrounding code: same layering (api / application / domain / infrastructure), naming, comment density and error-code style. Read a sibling module before writing a new one (`personal-events` and `client-todos` are the closest models).
5. **Keep each file's existing line endings.** Some files are CRLF. Never mix endings in one file.
6. No new npm dependencies.
7. Finish with `npm run lint`, `npm run typecheck` and `npm test` all green in your app. The API helper also runs the integration tests and `tests/rbac-matrix.mjs` (see the API's README or `package.json` scripts). Report exact pass counts and anything skipped.
8. Your final message: the files changed, the test counts, and any spec gaps or doubts. Keep it short.

---

## 1. Role ladder (who can create and assign tasks)

Add to `hok-api/src/domain/roles.ts`, and mirror it in `hok-web/lib/domain/constants/roles.ts`:

```ts
/** Task-assignment ladder (decision 2026-11-02): 1 = Admin (incl. the Owner), 2 = client managers, 3 = everyone else. */
export function roleLevel(role: Role): 1 | 2 | 3
/** Only downwards: level 1 -> 2 and 3, level 2 -> 3. Level 3 assigns nobody. */
export function canAssignTo(assigner: Role, assignee: Role): boolean
```

- Level 1: `admin`. The Owner is an admin with `is_owner`, so it's covered.
- Level 2: `social_media_manager`, `marketing_manager`, `project_manager`.
- Level 3: every other role.
- `canAssignTo(a, b)` = `roleLevel(a) <= 2 && roleLevel(a) < roleLevel(b)`.
- **Admin can no longer assign to another admin or to themselves.** Assignment goes strictly downwards.
- Unit tests: the full 8×8 role table.

### Capability change (both repos' `capabilities.ts` + their tests)

| Capability | Admin | SMM / MM / PM | Agent / Dev / Editor / Writer |
|---|---|---|---|
| `staff_tasks:assign` | `true` | `"own"` (was `false`) | `false` |
| `todos:manage` (new) | `"own"` | `"own"` | `"own"` |

- `todos:manage` is `"own"` **for the Admin too**: to-dos are private (decision 5). There is no Admin bypass anywhere.
- Update the comments above each capability to describe the new meaning.

---

## 2. Staff tasks: who sees and who manages (API)

### Visibility (decision 3)

A caller sees a task when any of these is true:

| Who | Sees |
|---|---|
| Admin | every task |
| anyone | tasks assigned to them (`assignee_id = me`) |
| anyone | tasks they created (`assigned_by = me`) |
| client managers (roles with `clients:read` scope `"own"`) | tasks whose `client_id` is a client whose team they're on (`isOnTeam` from `clients/infrastructure/client-team.sql.ts`) |

- Replace `StaffTaskScope` `{ kind: "own", userId }` with `{ kind: "own", userId, viaTeam: boolean }`.
  - `viaTeam` is true only for client-manager roles. A person moved to a task-only role keeps no team visibility, even if still listed on a team.
- **List query:** add one OR condition, `(assignee_id = $me OR assigned_by = $me [OR (client_id IS NOT NULL AND isOnTeam(client_id, $me))])`. It must be a single query, with no N+1. Existing indexes cover `assignee_id`, `assigned_by` and `client_id`.
- **Detail/guards:** `assertTaskVisible` needs the team membership. The repo's locked-row read returns `teamIds` (use `teamIdsOf(client_id)`, the same pattern other modules use for in-memory guards) so the check happens on the locked row.
- A task that isn't visible is a **404** (`STAFF_TASK_NOT_FOUND`), never a 403, as today.

### Who may do what on a visible task

| Action | Allowed |
|---|---|
| create | Admin and level 2 (`staff_tasks:assign` not false) |
| edit, reassign, reopen, delete | Admin, or **the creator** (`assigned_by = me`) if they still hold `staff_tasks:assign` |
| change status | the assignee, or the Admin (as today) |
| comment | the assignee, the creator, or the Admin |
| team managers who are neither creator nor assignee | read only. Any write is a **403** `STAFF_TASK_FORBIDDEN` (new code; the task is visible to them, so a 404 would be wrong) |

- **Create / reassign rules (new, in `staff-task.rules.ts`, pure and unit-tested):**
  - `assertCanAssign(callerRole, assigneeRole)` uses `canAssignTo`. On failure, a 400 `STAFF_TASK_ASSIGNEE_NOT_ALLOWED` with the message "You can only assign tasks to roles below yours".
  - The ladder is checked against the **caller's** role, so an Admin editing a manager-created task can pick levels 2 and 3, and a manager can pick level 3 only.
- **Client and event link for level 2:** a manager may link only a client whose team they're on, or an event of such a client. Otherwise it's a 400 `STAFF_TASK_CLIENT_INVALID` (same as "no such client", so existence doesn't leak). The Admin can link any client.
- Routes keep `requireCapability("staff_tasks:assign")` on create, edit, delete and reopen, now passing for managers. The creator rule is enforced in the service on the locked row.
- **Notifications:** the existing `otherSide` logic already uses `assignedBy`, so the creator (a manager) is told when the assignee acts. No change needed. Confirm with a test.
- **Drop the editor raw-files rule (decision 4):**
  - `resolveEditorFields` no longer requires `rawFilesUrl` for editors.
  - Keep the "editor fields only for editors" check as it is (round 2 replaces these fields with links).
  - Remove error code `STAFF_TASK_EDITOR_FIELDS_REQUIRED` only if nothing else uses it. Otherwise leave it unused.
- **List filters:**
  - Every caller may use `assigneeId`, `role` and `clientId`, always ANDed with their scope.
  - New optional filter `relation`: `assigned` (assigned to me) | `created` (created by me) | `team` (via my client teams, managers only).
- **Response DTO:** add `assignedById` and `assignedByName` to the summary and detail (join profiles once in the existing query; no extra query per row). Also add `canManage: boolean` (the caller is the Admin or the creator with assign rights), so the web needs no role logic of its own.
- **Audit:** unchanged actions. The actor is now possibly a manager.

### Assignee picker

`GET /team-members`:
- Keeps `requireCapability("events:write")` (Admin and managers).
- Add `?assignable=true`: returns only **active** people whose role the caller may assign to (`canAssignTo(caller.role, member.role)`). Filter by role list in SQL, not in memory after paging.

---

## 3. Calendar for everyone (API)

- `calendarRouter` now uses `requireCapability("staff_tasks:read")`, which every role has, instead of `events:read`.
- The feed-link routes (`GET/POST/DELETE /calendar/feed-link`) keep `requireCapability("events:read")` on each route: the `.ics` subscription stays manager-only this round.
- The public `.ics` feed is unchanged.
- `include` query param: extend it to `"all" | "events" | "personal" | "tasks" | "todos"` (default `all`).

### What each kind returns, per caller

| Kind | Who gets it | Scope |
|---|---|---|
| `event` | callers with `events:read` | as today |
| `personal` | callers with `personal_events:manage` | as today. Personal events are **unchanged** (decision 6). |
| `task` | everyone | the §2 visibility rule. The Admin gets all tasks, narrowed to that assignee when `ownerId` is given. Placed at `due_at`. Tasks without a due date never appear. |
| `todo` | everyone | **always and only the caller's own**. Never another person's, even for the Admin with `ownerId`. Placed at `due_at`. To-dos without a due date never appear. |

- Event-only filters (`eventType`, `state`) exclude the other three kinds. That's the existing rule for personal entries; apply it to all of them.
- `clientId` filters events, personal entries and tasks by client. To-dos have no client, so they're excluded when `clientId` is set.
- At most **4 queries** per feed, run in parallel with `Promise.all`, each capped at `CALENDAR_MAX_ITEMS_PER_KIND + 1`. `truncated` is true if any kind hit its cap. Extend the query-budget integration test.
- Range overlap for tasks and to-dos: `due_at >= from AND due_at < to`. Uses the existing `staff_tasks` `due_at` indexes and the new to-dos index (§4).

### New calendar item kinds (`calendar.entity.ts`)

```ts
interface CalendarTaskItem extends CalendarItemBase {
  kind: "task";
  // startsAt = endsAt = due_at; timeZone = the viewer's profile zone is NOT known here, so use "UTC" and let the web show viewer-local time
  status: StaffTaskStatus;
  priority: StaffTaskPriority;
  assigneeId: string;
  assigneeName: string;
}
interface CalendarTodoItem extends CalendarItemBase {
  kind: "todo";
  // startsAt = endsAt = due_at; clientId = clientName = null; ownerId = owner
  urgency: TodoUrgency;
  done: boolean;
}
```

For tasks, `ownerId` is `assigneeId`, and `clientId`/`clientName` come from the task (they may be null).

The calendar module stays read-only on other modules' tables (ADR 0003), as it is today.

---

## 4. My to-dos (API): new module `todos`

### Migration `supabase/migrations/20261102000001_todos.sql` (additive only)

```sql
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text check (notes is null or char_length(notes) <= 2000),
  due_at timestamptz,
  urgency text not null default 'medium' check (urgency in ('low','medium','high','urgent')),
  done_at timestamptz,
  -- the next reminder moment still to send; null = none left (or done / no due date)
  next_remind_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index todos_owner_open_due_idx on public.todos (owner_id, due_at) where done_at is null;
create index todos_owner_created_idx on public.todos (owner_id, created_at desc, id desc);
create index todos_owner_due_idx on public.todos (owner_id, due_at) where due_at is not null;   -- calendar
create index todos_remind_due_idx on public.todos (next_remind_at) where next_remind_at is not null and done_at is null;
alter table public.todos enable row level security;
```

- Copy the existing `updated_at` trigger and the grants/revokes from the closest recent migration (`client_todos` plus `20261030000004_revoke_data_api_reads.sql`), so the Data API can't read the table. Match whatever those do exactly.
- Don't touch any existing table.

### Domain (`todos/domain/todo.rules.ts`, pure, unit-tested)

```ts
export const TODO_URGENCIES = ["low", "medium", "high", "urgent"] as const;
/** Reminder offsets before due, per urgency (decision 2026-11-02). */
const OFFSETS_MS = { urgent: [DAY, HOUR, 0], high: [HOUR, 0], medium: [0], low: [] };
/** The earliest reminder moment strictly after `after`, or null. */
export function nextTodoReminder(dueAt: Date | null, urgency: TodoUrgency, after: Date): Date | null;
```

- Recompute `next_remind_at` on create, and on any change to `due_at`, `urgency` or done state (with `after = now`). Done sets it to null. Undone recomputes it.
- Tests:
  - every urgency;
  - a due time in the past (gives null);
  - a due time 30 minutes away for urgent (only the "at due" moment is left).

### API (`/api/v1/todos`, every route `requireAuth` + `requireCapability("todos:manage")`)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/todos` | `status=open\|done\|all` (default `open`), `dueFrom`, `dueTo`, `limit` (≤100, default 50), `offset` | `{ todos, total, limit, offset }`. Open ones ordered by due (nulls last), then created. Done ones by `done_at desc`. |
| POST | `/todos` | `{ title, notes?, dueAt?, urgency? }` | 201 `{ todo }` |
| PATCH | `/todos/:id` | `{ version, title?, notes?, dueAt?(nullable), urgency?, done?(boolean) }` | `{ todo }`. Version mismatch gives 409 `TODO_MODIFIED`. |
| DELETE | `/todos/:id` | – | 204 |

- `todo` = `{ id, title, notes, dueAt, urgency, done: boolean, doneAt, version, createdAt, updatedAt }`.
- **Owner only:** every query has `owner_id = caller` in its WHERE clause. Another person's id is a **404** `TODO_NOT_FOUND`, for the Admin too.
- Use the uuid param guard, as other modules do.
- zod: title trimmed, 1–200 characters; notes ≤2000; `dueAt` an ISO instant; unknown keys rejected (`.strict()`, as the other DTOs do).
- No audit log entries: to-dos are private personal notes. Add a one-line comment saying so.
- Add to `openapi.yaml`.

### Reminders (extend the existing runner, no new timer)

- Add `todo_reminder` to `NOTIFICATION_TYPES` and `NOTIFICATION_TYPE_INFO`:
  - `live: true`;
  - label "My to-do reminders";
  - description "Reminders for your own to-dos, based on urgency."
  - The DB column is open vocabulary, so no migration is needed for this.
- Payload builder `todoReminderPayload({ todoId, title, dueAt, timeZone, now })`, in the same style as `taskDueReminderPayload`. The link goes to `/app/todos`. The message wording depends on whether it's due now or due in N hours/days.
- In `DrizzleRemindersRepository.claimDue`, add a third claim in the **same transaction**:
  - Select up to `limit` rows with `next_remind_at <= now AND done_at is null`, ordered by `next_remind_at`, `FOR UPDATE SKIP LOCKED`, joined to the owner's active profile and `time_zone`.
  - For each row:
    - Send it only if `now - next_remind_at <= 30 min`. Older ones (the API was down) are skipped silently. This is the same "never send late" idea as today, with a 30-minute grace because to-do moments are exact rather than 2 hours ahead.
    - Then set `next_remind_at = nextTodoReminder(due_at, urgency, now)`. At most 50 rows, so per-row updates inside the transaction are acceptable. Comment this in the code.
  - Skip owners who are deactivated (`profiles.active = false`): advance `next_remind_at` without notifying.
  - Recipient: the owner only.
- Tests:
  - unit tests for the payload;
  - an integration test in `reminders.integration.test.ts`:
    - an urgent to-do due in 50 minutes, then claim: the 1-hour reminder is sent and `next_remind_at` becomes the due time;
    - done to-dos are never claimed;
    - a stale reminder (40 minutes old) is skipped and advanced.

### Dashboard

`GET /dashboard` gains a `todos` section for **every** role:

```ts
todos: { open: number; overdue: number; next: Todo[] /* up to 5 open, by due nulls last */ }
```

- At most 2 extra queries (a count, and the top 5). Update the dashboard query-budget test.
- Owner only.

---

## 5. Web (`hok-web`)

### Domain mirror
- `roles.ts`: add `roleLevel` and `canAssignTo`, with tests.
- `capabilities.ts`: add `todos:manage`, and change `staff_tasks:assign`; update the tests.
- Types:
  - the new calendar item kinds (`task`, `todo`) in `modules/calendar/calendarItems.ts`;
  - `Todo` and the dashboard `todos` section;
  - task `assignedById`, `assignedByName`, `canManage`.

### Navigation (`components/shell/nav-config.ts`)
- **Calendar:** visible to every role; `requires` becomes `staff_tasks:read`. Page title: Admin "Calendar"; everyone else "My calendar".
- **To-dos:** a new item for every role, `requires: "todos:manage"`, href `/app/todos`, icon `checklist` (or the nearest existing icon in `components/ui/iconPaths.ts`; don't add new icon paths unless needed). Place it right after Tasks. Check how the phone tab bar picks items: don't push an existing tab out without noting it in §9.

### Calendar page (`app/(main)/app/calendar/page.tsx`)
- Guard: `staff_tasks:read` (everyone).
- Subtitle per role:
  - Admin: "Every client event and task in the agency, plus your to-dos."
  - Managers: "Your clients' events, your tasks and to-dos, and personal entries."
  - Others: "Your tasks and to-dos."
- `CalendarSubscribe` only for `events:read`.
- The "New event" button only for `events:write`.

### Month view: counts instead of chips (`CalendarView.tsx`)
- Each day cell shows **counts per kind**, never chips. Only non-zero kinds appear: `2 events · 3 tasks · 1 to-do · 1 personal`.
  - Phones (cells are narrow): coloured dots with numbers. Give the line an `aria-label`, e.g. "2 events, 3 tasks, 1 to-do".
  - The "+N more" span is removed.
- The whole cell is a **button**: clicking it, or pressing Enter/Space, opens the **Day pop-up**. Keep the grid roles accessible, with a visible focus ring.
- Remove the per-cell `+` icon; the pop-up holds the create buttons.
- On a client tab (`clientId` set), and when `readOnly`: the pop-up still opens and lists items, but shows only the buttons that make sense there (New event on a client tab, if allowed).

### Day pop-up (new `modules/calendar/components/DayModal.tsx`, using `components/ui/Modal`)
- The title is the long day label (`formatDayLabel`).
- Sections, in this order, showing only kinds that have items:
  - **Events**: chip, time and client, linking to `/app/events/:id`.
  - **Tasks**: title, status pill, priority, assignee and due time, linking to `/app/tasks/:id`.
  - **To-dos**: a checkbox that toggles done (PATCH with version; refresh the feed after), title, urgency pill and time.
  - **Personal**: opens the existing `PersonalEventModal`.
- Empty day: "Nothing on this day."
- Footer buttons, each shown only when allowed:
  - **New event** (`events:write`): link to `/app/events/new?date=<day>`. Check how the current `newEventHref` builds it and reuse that.
  - **New task** (`staff_tasks:assign`): opens `TaskFormModal` with the due date prefilled to that day (17:00 in the viewer's zone, editable).
  - **New to-do** (`todos:manage`, everyone): opens `TodoFormModal` with the due date prefilled the same way.
  - **New personal entry** (`personal_events:manage`): the existing personal modal for that day.
- Week view and list view: show tasks and to-dos as chips alongside events, in the existing chip style. Give each kind a distinct but quiet style; follow `hok-web/docs/design-system.md`.

### Tasks page and detail (`modules/staff-tasks/*`, `app/(main)/app/tasks/*`)
- Replace every `isAdmin` decision with the capability or row flag:
  - "New task" button and form: `hasCapability(role, "staff_tasks:assign")`.
  - Edit, reassign, reopen and delete on a task: `task.canManage`.
  - The board view and the assignee filter: Admin and level 2.
- **Header for managers:** "Tasks". Subtitle "Tasks assigned to you, tasks you've given, and your clients' tasks."
- Segmented filter for managers: **All · Assigned to me · I assigned · My clients** (maps to `relation`). The Admin keeps today's view; task-only staff keep "My tasks".
- `TaskFormModal`:
  - The assignee picker uses `teamMembersApi.searchOptions(q, { assignable: true })`. Add the param in `teamMembersApi`.
  - Remove the "raw files link required for editors" validation (decision 4). Keep the editor fields shown only for editors, as today.
- Task detail: show "Assigned by <name>".
- Comment box: for the assignee, the creator and the Admin. Team managers see the task read-only with no actions, and the page tells them "View only: you're on this client's team."

### To-dos page (`app/(main)/app/todos/page.tsx`, `modules/todos/*`)
- A list with **Open / Done** segments.
- Add a to-do with an inline title box. "More" opens `TodoFormModal` for notes, due date and time, and urgency.
- Each row: checkbox, title, urgency pill (urgent = alert colour, high = warning, medium = neutral, low = muted), due label ("Today 5:00 PM", "Overdue · 2 days"), and edit/delete actions.
- Pagination as on other lists (50 per page). An empty state, matching the house `EmptyState` style.
- The subtitle says: "Private to you. Reminders follow urgency: urgent 1 day, 1 hour and at the due time; high 1 hour and at due; medium at due; low none."

### Dashboard
- A **"My to-dos"** card on all three views (Admin, Manager, Staff):
  - open count, plus the overdue count in the alert colour;
  - the next 5, each with a tick-to-complete;
  - a "View all" link to `/app/todos`;
  - an "Add" button that opens `TodoFormModal`.
- Fit it into the existing widget grid without breaking the layout fixed on 2026-11-01 (`HeroBand`, `TeamRows`). Check phone (390 px), tablet (820 px) and desktop.

### Notifications
- The profile notification settings list `todo_reminder` once the API marks it live. Check the web doesn't hard-code the type list; if it does, add the type there.
- Clicking a `todo_reminder` goes to `/app/todos`.

### In-app guide (`modules/guide/guideContent.ts`)
- Calendar entry: change `requires` and update the text.
- Add a to-dos entry.
- Tasks entry: managers can now assign downwards.

### Tests
- Unit tests for every new pure helper: counts per day, ladder, due labels.
- Playwright: extend the existing e2e suite with:
  1. an editor opens the calendar, sees a task on its due day, opens the day pop-up and sees "New to-do" but not "New task" or "New event";
  2. an SMM creates a task for an editor from the day pop-up;
  3. any user adds a to-do with urgency and ticks it done on the dashboard.
- Use the seeded users (`hok-api/src/db/seed.ts`). Login rate limit: restart the API with `touch hok-api/src/index.ts` if logins start failing with 429.

---

## 6. Contract between API and Web (both helpers build to this)

```
GET  /api/v1/calendar?from&to&include=all|events|personal|tasks|todos&clientId&ownerId&eventType&state
     -> { from, to, truncated, items: (Event | Personal | Task | Todo)[] }   // kinds per §3
GET  /api/v1/todos?status=open|done|all&dueFrom&dueTo&limit&offset -> { todos: Todo[], total, limit, offset }
POST /api/v1/todos { title, notes?, dueAt?, urgency? } -> 201 { todo }
PATCH /api/v1/todos/:id { version, title?, notes?, dueAt?: string|null, urgency?, done?: boolean } -> { todo }
DELETE /api/v1/todos/:id -> 204
GET  /api/v1/team-members?search&role&assignable=true -> { members: {id, fullName, role}[], ... }
GET  /api/v1/staff-tasks?...&relation=assigned|created|team -> summaries now include assignedById, assignedByName, canManage
GET  /api/v1/staff-tasks/:id -> detail includes assignedById, assignedByName, canManage
GET  /api/v1/dashboard -> adds todos: { open, overdue, next: Todo[] }
Todo = { id, title, notes: string|null, dueAt: string|null, urgency: "low"|"medium"|"high"|"urgent",
         done: boolean, doneAt: string|null, version: number, createdAt: string, updatedAt: string }
New error codes: STAFF_TASK_FORBIDDEN (403), STAFF_TASK_ASSIGNEE_NOT_ALLOWED (400), TODO_NOT_FOUND (404), TODO_MODIFIED (409)
New notification type: todo_reminder (payload link /app/todos)
```

---

## 7. Permission matrix (`hok-api/tests/rbac-matrix.mjs`): add and update rows

| Endpoint | admin | SMM/MM/PM | agent/dev/editor/writer |
|---|---|---|---|
| GET /calendar | 200 | 200 | **200** (was 403) |
| GET/POST /calendar/feed-link | 200/201 | 200/201 | 403 |
| POST /staff-tasks (to a level-3 person) | 201 | **201** | 403 |
| POST /staff-tasks (to a manager) | 201 | **400** ladder | 403 |
| PATCH/DELETE/reopen a task someone else created | 200/204 | **404** (not visible) or **403** (visible via team) | 404 |
| GET/POST/PATCH/DELETE /todos | own only | own only | own only |
| GET /todos/:otherPersonsTodo (PATCH) | **404** | 404 | 404 |
| GET /team-members?assignable=true | 200 | 200 | 403 |

The matrix runs against the local API with the seeded users. Add whatever fixtures it needs: a task created by an SMM, a to-do owned by someone else.

---

## 8. Seed and speed check (API helper)

- `src/db/seed.ts`:
  - give each seeded person 2–3 to-dos with mixed urgencies and due dates in the current month;
  - add one task created by an SMM for the editor;
  - make sure a few tasks have due dates in the current month.
- **Speed check:** a script `scripts/perf-calendar.mjs` (local only; refuses any non-local DB host, as the seed does). It:
  - creates 50 extra test users with tasks and to-dos in one month (about 10 per person);
  - times `GET /calendar` for a month for an Admin, an SMM and an editor, 20 calls each;
  - prints p50 and p95;
  - cleans up its own rows at the end.
  - Target: **p95 under 150 ms locally.** Report the numbers.

---

## 9. Gaps and doubts (helpers write here; reviewer resolves)

- …
