# Round 3 spec: stage approvals (event and task templates, client approval in the portal)

Source: [PLAN-team-feedback-2026-11.md](../PLAN-team-feedback-2026-11.md) §4a/§4b, plus the decisions of 2026-11-02 (#2, #8) and 2026-11-04 (approvals design).
Builders:
- **API-A**: migration, domain, approvals module, the gates in events and tasks, portal, notifications.
- **API-B**: integration tests, permission matrix, openapi, seed. Runs after API-A.
- **Web**: runs in parallel with API-A.

Reviewer: Opus.
Rounds 1–2 are committed (`5cb99cd`, `2d73985`).

## 0. Rules

- **All of [round-1.md §0](round-1.md)**, plus [round-2.md §0](round-2.md) (additive migrations, old API safe against the new schema).
- **Process rules:** [WORKFLOW.md "Round playbook"](../WORKFLOW.md). In short:
  - **Progress file:** append one line per finished part to `docs/specs/round-3-progress-<api-a|api-b|web>.md`. It's your only file outside your app.
  - **Test budget:** while working, only targeted test files. At the end, one full run. Playwright: only new or affected spec files, one at a time.
  - **Own scratch folder:** `<scratchpad>/round-3-<api-a|api-b|web>/`.
  - Read **only** the files listed in §8 and the files you change. Use grep to find things, not whole-module reading.

## 1. The rule in one paragraph

On any stage of **any** template (event or task), the Admin can set **approvers**. A stage with approvers is an **approval stage**: the item (event or task) **can't move past it**, forward or by completing, until that stage has an **approved** approval in the current visit. Anyone who can move the item may **request approval** while the item sits on that stage. **Any one** eligible approver can **approve** or **request changes**; requesting changes needs a comment. Moving the item **back** to that stage or earlier makes old approvals of the stages from there on no longer count, so the stage needs approving again. The **client** can be an approver **only on event templates**, and approves from the portal.

User's example (it must be a test case): editing template "Reel edit (approvals)" with 5 stages.
- Stage 4: approvers = Social Media Manager **or** Admin.
- Stage 5: approvers = Admin only.
- The item can't go from 4 to 5 until an SMM or the Admin approves stage 4. It can't be completed from 5 until the Admin approves stage 5.

## 2. Data (API-A). Migration `supabase/migrations/20261104000001_stage_approvals.sql`

```sql
-- Approver tokens: 'admin', 'team_managers', 'client', or a role name (not 'admin').
-- Allowed set as a CHECK (copy the role list from 20261101000001_content_writer_role.sql).
alter table public.stage_template_stages add column approvers text[] not null default '{}';
alter table public.event_stages          add column approvers text[] not null default '{}';
alter table public.task_stages           add column approvers text[] not null default '{}';
-- each with: check (approvers <@ array['admin','team_managers','client','social_media_manager',...]::text[] and cardinality(approvers) <= 8)

create table public.stage_approvals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete cascade,
  task_id uuid references public.staff_tasks (id) on delete cascade,
  event_stage_id uuid references public.event_stages (id) on delete cascade,
  task_stage_id uuid references public.task_stages (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','changes_requested','cancelled','superseded')),
  request_note text check (request_note is null or length(request_note) <= 2000),
  request_link text check (request_link is null or (length(request_link) <= 2000 and request_link ~* '^https?://')),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete set null,   -- null when decided by the client
  decided_via text check (decided_via in ('staff','portal')),
  decided_at timestamptz,
  decision_comment text check (decision_comment is null or length(decision_comment) <= 2000),
  version integer not null default 1,
  constraint stage_approvals_one_subject check (
    (event_id is not null and event_stage_id is not null and task_id is null and task_stage_id is null) or
    (task_id is not null and task_stage_id is not null and event_id is null and event_stage_id is null))
);
-- At most one pending request per stage:
create unique index stage_approvals_one_pending_event on public.stage_approvals (event_stage_id) where status = 'pending' and event_stage_id is not null;
create unique index stage_approvals_one_pending_task  on public.stage_approvals (task_stage_id)  where status = 'pending' and task_stage_id is not null;
create index stage_approvals_event_idx on public.stage_approvals (event_id, requested_at desc) where event_id is not null;
create index stage_approvals_task_idx  on public.stage_approvals (task_id,  requested_at desc) where task_id is not null;
create index stage_approvals_pending_idx on public.stage_approvals (requested_at desc) where status = 'pending';
-- + FK indexes for requested_by / decided_by (partial, where not null); grants, RLS on, revokes: copy staff_task_links' block from 20261103000001.
```

- **Status meanings:**
  - `approved` / `changes_requested`: decided.
  - `cancelled`: the requester or a manager withdrew it.
  - `superseded`: the item moved back to that stage or earlier, so the approval no longer counts. The row is kept for history.
- **Snapshot:** creating an event or task copies each template stage's `approvers` onto its own stages, the same way stage names are copied. Editing a template later never changes live items (FR-EVT-03). Existing items get `'{}'`, so nothing changes for them.
- **Old API during the deploy window:** it doesn't know the new columns, which all have defaults. It can move stages without the gate, but no stage has approvers yet at that point, so that's safe.

## 3. Rules (API-A, pure functions in `src/modules/approvals/domain/approval.rules.ts`, unit-tested)

```ts
type ApproverToken = "admin" | "team_managers" | "client" | Exclude<Role, "admin">;

/** Template validation: tokens valid; 'client' only when template kind = 'event' (else 400 STAGE_TEMPLATE_APPROVERS_INVALID); no duplicates. */
assertApproversValid(kind, approvers)

/** The highest position the item may move to from `currentPosition`: stops AT the first stage at/after current that has approvers and no approved approval (it can be entered, not passed). */
maxReachablePosition(stages: {position, approvers, approved: boolean}[], currentPosition): number

/** Forward move or complete past an unapproved approval stage -> 409 STAGE_APPROVAL_REQUIRED (message names the stage). Back moves always allowed. */
assertCanPass(...)

/** Can this person decide this approval? */
canDecide(caller: {userId, role}, approvers, ctx: { teamIds: string[]; canSeeItem: boolean; requestedBy: string|null }): boolean
```

**Who can decide (staff):** the caller must be able to **see the item** under the existing visibility rules, **and** match one token:
- `admin`: the caller's role is admin.
- `<role>`: the caller's role equals it.
- `team_managers`: a client-manager role on the item's client team. For events, the event's client. For tasks, the task's client; a task with no client has no team managers.
- `client`: never a staff member.
- **No self-approval:** the person who requested can't decide their own request, **except the Admin**. Otherwise 403 `STAGE_APPROVAL_SELF`.

### Move gate (wire into the existing transactions, on the locked row)

- `EventsService.moveStage` and `StaffTasksService.moveStage` (including `complete`) call `assertCanPass` with the item's stages, their approvers, and which approval stages have an **approved** row.
- The approved-row read is one query inside the same transaction: `select distinct event_stage_id ... where event_id=$1 and status='approved'`.
- On a **back move** to position p, in the same transaction:
  - mark `approved` rows of stages with position ≥ p as `superseded`;
  - mark any `pending` rows of those stages as `cancelled`.
- Task **reopen** to a stage counts as a back move, with the same superseding.

## 4. API-A: the approvals module (`src/modules/approvals/`)

Layering as other modules. Routes are mounted at `/api/v1/approvals`, behind `requireAuth` + `requireCapability("staff_tasks:read")` (every staff role). The service enforces everything else.

| Method | Path | Body / query | Who | Errors |
|---|---|---|---|---|
| POST | `/approvals` | `{ subject: "event"\|"task", subjectId, note?, link? }` | anyone who may **move** the item (events: Admin or a manager on the team; tasks: assignee, creator, Admin) | 404 item not visible; 403 `STAFF_TASK_FORBIDDEN`/`FORBIDDEN` (visible but can't move); 409 `STAGE_APPROVAL_NOT_NEEDED` (current stage has no approvers); 409 `STAGE_APPROVAL_ALREADY_APPROVED`; 409 `STAGE_APPROVAL_PENDING` (one already pending; the unique index is the backstop, so map a unique violation to this too); 409 `EVENT_NOT_ACTIVE` for a cancelled or postponed event; 409 `STAFF_TASK_DONE`. The stage is the item's **current** stage. |
| POST | `/approvals/:id/decision` | `{ version, decision: "approve"\|"changes", comment? }` | `canDecide` | 404 not visible; 403 `STAGE_APPROVAL_NOT_APPROVER`; 403 `STAGE_APPROVAL_SELF`; 409 `STAGE_APPROVAL_NOT_PENDING`; 400 `STAGE_APPROVAL_COMMENT_REQUIRED` (changes without a comment); 409 `STAGE_APPROVAL_MODIFIED` (version) |
| POST | `/approvals/:id/cancel` | `{ version }` | the requester, or whoever can manage the item (Admin; the task creator; managers on the event's team) | 409 `STAGE_APPROVAL_NOT_PENDING` |
| GET | `/approvals` | `view=to_decide\|requested\|all_visible` (default `to_decide`), `status`, `limit` ≤100, `offset` | everyone | `to_decide` = pending ones the caller may decide, worked out in **SQL** (no in-memory filtering after paging) |
| GET | `/approvals/count` | – | everyone | `{ toDecide: number }`, for the badge and dashboard (one query) |

- **Approval response:** `{ id, subject: "event"|"task", subjectId, subjectTitle, clientName|null, stageId, stageName, stagePosition, approvers: ApproverToken[], status, requestNote, requestLink, requestedById, requestedByName, requestedAt, decidedById, decidedByName, decidedVia, decidedAt, decisionComment, version, canDecide: boolean, canCancel: boolean }`.
- **Event detail and task detail** responses add:
  - `stages[].approvers`;
  - `approvals: Approval[]`, all rounds for this item, newest first, max 100, one query;
  - `nextBlockedBy: { stageId, stageName } | null`, the approval stage that currently stops forward moves, so the web can explain a disabled button.
- **Stage templates:** create and update take `stages: { name, approvers? }[]`. Keep accepting plain strings for compatibility: a string means no approvers. Validate with `assertApproversValid` against the template's kind. The template detail returns `stages[].approvers`.
- **Notifications:** add two types to `NOTIFICATION_TYPES`/`INFO`, live:
  - `approval_requested` ("Approval requests"): to every **staff** person who could decide it, worked out in one SQL query. Admins: all active admins, but only when `admin` is a token. Role tokens and team managers: only people who can see the item. Never the requester. Cap at 50 recipients.
  - `approval_decided` ("Approval decisions"): to the requester, plus the task's assignee and creator, or the event's notified team. The actor is skipped, as the dispatcher already does.
  - Payload link: the item's page.
- **Audit:** `approval.requested`, `approval.decided`, `approval.cancelled`, `approval.superseded`. The superseded entry is one per back move, with the count in its metadata.

## 5. API-A: the client approves in the portal

- The portal event detail (`GET /portal/:token/events/:eventId`) adds:
  - `pendingApproval: { id, version, stageName, requestNote, requestLink, requestedAt } | null`: only if the pending row's stage approvers include `client`;
  - `approvalHistory: { stageName, status, decidedVia, decidedAt, decisionComment }[]`: only rows whose stage approvers include `client`, and that are decided (approved or changes_requested). Max 20.
  - **No staff names.**
- The portal dashboard's `current` event gets `awaitingYourApproval: boolean`.
- **New** `POST /portal/:token/approvals/:approvalId` with body `{ version, decision: "approve"|"changes", comment? }`:
  - Mount it like portal comments: after `requirePortalLink`, behind **`portalCommentLimiters`** (reuse them), with the small JSON body limit.
  - The approval must belong to an event of `req.portal.clientId`, its stage approvers must include `client`, and it must be `pending`. Otherwise **404** `PORTAL_APPROVAL_NOT_FOUND` for every case, so nothing leaks.
  - Changes need a comment (400). The comment is plain text, ≤2000 characters, rendered as text, never HTML.
  - Sets `decided_via='portal'` and `decided_by=null`. Notifies `approval_decided` to the requester and the event's notified team. Audits with actor null and metadata `{ via: "portal", linkId }`.
- Update `portal.entity.ts` (client-safe shapes) and its comment.

## 6. Web

### Templates editor (`modules/stage-templates/components/TemplatesClient.tsx`)
- Each stage row gets a **"Needs approval"** switch (reuse `components/ui/Switch.tsx`).
- When it's on, show approver chips (multi-select):
  - **Admin**;
  - **Client's team managers**;
  - one chip per role except Admin (`ROLE_LABELS`);
  - **Client**, shown **only for Event templates**.
- At least one chip must be picked while the switch is on (client-side check plus the API's 400).
- In the list, show a small lock icon and a count, e.g. "2 approval stages".

### Event detail and task detail (`EventDetailClient.tsx`, `TaskDetailClient.tsx`, generic `StageTracker.tsx`)
- In the tracker, approval stages show a small seal or lock icon, and an approved stage a tick.
- An **approval card** for the current stage when it has approvers:
  - **No request yet:** "Needs approval from: Social Media Manager or Admin". The button **Request approval** opens a modal with an optional note and an optional link (for the work).
  - **Pending:** "Waiting for approval since …" with the note and link.
    - Approvers (`canDecide`) see **Approve** and **Request changes**. Changes needs a comment.
    - The requester and managers (`canCancel`) see **Cancel request**.
  - **Approved:** "Approved by <name>" (or "by the client") with the time.
  - **Changes requested:** the comment, plus "Move the work back to fix it, then request approval again."
- The forward and complete buttons are **disabled** while `nextBlockedBy` is set, with the reason "Needs approval at <stage>". Never hide the reason.
- An **approval history** list, in the timeline area: every round with who, when, decision and comment.

### Approvals page (`app/(main)/app/approvals/page.tsx`, `modules/approvals/*`)
- Nav item **Approvals** for every role, with a count badge from `GET /approvals/count`. Check how the bell badge polls, and don't add a second poll if you can piggy-back on it; otherwise refresh on navigation only. On phones it sits in More.
- Tabs: **To decide** · **I requested**.
- Each row: item title (link), client, stage, requested by, when, note, link, and inline **Approve** / **Request changes**.

### Dashboard
- A **"Waiting for your approval"** item for every role: count plus the 3 oldest, linking to `/app/approvals`. Hide it when the count is 0.
- Fit it into the existing layout without breaking HeroBand or TeamRows.

### Portal (`modules/client-portal/*`)
- **Event page:** when `pendingApproval` is set, show a prominent box, "Your approval is needed: <stage>", with:
  - the note, and the link (new tab, `rel="noopener noreferrer"`);
  - the stage's "Shared with you" assets just below;
  - **Approve** and **Request changes**, where changes needs a comment.
  - After a decision: a thank-you state, then refresh.
- The approval history is listed under the event's updates.
- **Dashboard:** the current event shows a badge "Needs your approval" when `awaitingYourApproval`.
- Keep the plain portal style. Every text renders as text.

### Guide
- Add an "Approvals" entry.
- Update the templates entry with the approvers per stage.

### Tests (web)
- Unit tests for the helpers (approver labels, the blocked reason).
- Playwright (new `e2e/approvals.spec.ts`):
  1. The user's example. The Admin creates task template "Reel edit (approvals) <ts>" with 5 stages: stage 4 by SMM or Admin, stage 5 by Admin.
     - The SMM assigns the task to the editor.
     - The editor moves 1 → 4; the forward button is disabled at 4 with the reason shown.
     - The editor requests approval; the SMM approves from the Approvals page.
     - The editor moves to 5 and requests again; the SMM sees no Approve button (not an approver of stage 5); the Admin approves.
     - The editor completes it.
  2. An event template with a client-approved stage. The manager requests approval. In the portal, the client requests changes, with the comment required. The manager moves back and requests again; the client approves in the portal; the manager can move on.
  3. An editor can't approve their own request (no button), and the API returns 403. The API matrix covers this too.

## 7. API-B: tests, matrix, openapi, seed (after API-A reports done)

- **Integration tests** (`tests/integration/approvals.integration.test.ts`, plus additions to the events, staff-tasks and portal tests):
  - the user's 5-stage example, end to end;
  - the gate blocks forward jumps over an unapproved stage (2 → 5 refused, 2 → 4 allowed);
  - complete is blocked on an unapproved last stage;
  - a back move supersedes approvals and cancels pending ones;
  - a task reopen supersedes;
  - one pending per stage, including two simultaneous requests: one 201 and one 409;
  - no self-approval, with the Admin exception;
  - `team_managers` on a task without a client: nobody;
  - role approvers must see the item (an SMM not on the team gets 404);
  - in the portal: approve and changes, the comment required, another client's approval returns 404, a non-client stage returns 404, an already-decided one returns 404, and the limiter is applied;
  - notifications recipients;
  - `GET /approvals?view=to_decide` correct per role, with paging totals;
  - the query budget for event detail, task detail and `/approvals` (fixed query counts).
- **RBAC matrix:** rows for every endpoint in §4 and §5, per role, including the self-approval 403 and a stranger's 404.
- **openapi.yaml** and the drift test.
- **Seed:**
  - one event template "Shoot with client sign-off" whose "Client Review" stage is approved by `client`, and one seeded event sitting on that stage with a pending client approval;
  - one task template "Reel edit (approvals)" from the user's example, and one seeded task on stage 4 with a pending request;
  - re-runs reuse rows.

## 8. Read these files (and grep for anything else)

**API-A:**
- `events/domain/event.rules.ts` (`assertStageMove`) and `events/application/events.service.ts` (`moveStage`)
- `events/infrastructure/drizzle-events.repository.ts` (`moveStage` at about line 306)
- `staff-tasks/application/staff-tasks.service.ts` (`moveStage`, `reopen`) and `staff-tasks/domain/staff-task.rules.ts`
- `staff-tasks/infrastructure/drizzle-staff-tasks.repository.ts` (`update`, `create`, `findTemplate`)
- `stage-templates/*` (DTO, service, repo)
- `supabase/migrations/20261103000001_task_stages_links_client_assets.sql` (the pattern for this migration)
- `portal/api/portal-public.routes.ts`, `client-comments/api/client-comments.routes.ts` (the portal POST and limiter pattern), `app.ts` around lines 90–105
- `notifications/domain/notification.entity.ts`, `notification.messages.ts`
- `clients/infrastructure/client-team.sql.ts`

**API-B:**
- `tests/integration/helpers.ts` and `staff-tasks.integration.test.ts` (the pattern)
- `tests/rbac-matrix.mjs` (the staff-tasks section)
- `openapi.yaml` (the staff-tasks paths)
- `src/db/seed.ts`

**Web:**
- `modules/stage-templates/components/TemplatesClient.tsx`
- `modules/events/components/{EventDetailClient,StageTracker}.tsx`
- `modules/staff-tasks/components/TaskDetailClient.tsx`
- `modules/client-portal/components/{PortalEventModal,PortalApp}.tsx`
- `components/shell/nav-config.ts`
- `modules/dashboard/components/DashboardClient.tsx`
- `modules/notifications/components/NotificationBell.tsx` (badge polling)
- `docs/design-system.md`

## 9. Impact list (existing behaviour this round changes)

- Event and task stage moves can now return **409 `STAGE_APPROVAL_REQUIRED`**. Existing tests and seeds never set approvers, so they're unaffected, but the web must show the error message if it ever appears.
- The template create and update body changes from `stages: string[]` to `stages: (string | {name, approvers})[]`. The old shape keeps working.
- **Portal POST surface grows** (approvals). It must reuse the comment limiters and the body limit. This is the security-sensitive part, so keep it minimal.
- The nav gains "Approvals". On phones it goes in More; don't push the existing tabs out.
- Dashboard response: add `approvals: { toDecide: number, oldest: Approval[] }`, using 2 queries at most. Update the dashboard query budget.
- Unique template names: e2e tests use a timestamp suffix (the seed owns the plain names).

## 10. Contract (all builders)

```
ApproverToken = "admin" | "team_managers" | "client" | <role except admin>
StageTemplate.stages: { id?, name, position, approvers: ApproverToken[] }[]
POST/PATCH /stage-templates  stages: (string | { name, approvers?: ApproverToken[] })[]
EventDetail / StaffTaskDetail += { stages: { id, name, position, approvers }[], approvals: Approval[], nextBlockedBy: { stageId, stageName } | null }
Approval = { id, subject, subjectId, subjectTitle, clientName, stageId, stageName, stagePosition, approvers, status,
  requestNote, requestLink, requestedById, requestedByName, requestedAt, decidedById, decidedByName, decidedVia,
  decidedAt, decisionComment, version, canDecide, canCancel }
POST /approvals { subject, subjectId, note?, link? } -> 201 { approval }
POST /approvals/:id/decision { version, decision: "approve"|"changes", comment? } -> { approval }
POST /approvals/:id/cancel { version } -> { approval }
GET  /approvals?view=to_decide|requested|all_visible&status&limit&offset -> { approvals, total, limit, offset }
GET  /approvals/count -> { toDecide }
GET  /dashboard += approvals: { toDecide, oldest: Approval[] (≤3) }
Portal event detail += pendingApproval: { id, version, stageName, requestNote, requestLink, requestedAt } | null,
                       approvalHistory: { stageName, status, decidedVia, decidedAt, decisionComment }[]
Portal dashboard current += awaitingYourApproval: boolean
POST /portal/:token/approvals/:approvalId { version, decision, comment? } -> { ok: true }
Notification types: approval_requested, approval_decided
Errors: STAGE_APPROVAL_REQUIRED (409), STAGE_APPROVAL_NOT_NEEDED (409), STAGE_APPROVAL_ALREADY_APPROVED (409),
  STAGE_APPROVAL_PENDING (409), STAGE_APPROVAL_NOT_PENDING (409), STAGE_APPROVAL_MODIFIED (409),
  STAGE_APPROVAL_NOT_APPROVER (403), STAGE_APPROVAL_SELF (403), STAGE_APPROVAL_COMMENT_REQUIRED (400),
  STAGE_APPROVAL_NOT_FOUND (404), STAGE_TEMPLATE_APPROVERS_INVALID (400), PORTAL_APPROVAL_NOT_FOUND (404)
```
