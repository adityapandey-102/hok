# Round 4 spec: parent and child events and tasks (stage blocked until children finish)

Source: [PLAN-team-feedback-2026-11.md](../PLAN-team-feedback-2026-11.md) §4d. Rounds 1–3 are committed (`5cb99cd`, `2d73985`, `aba488c`).

**Order (from the round 3 lessons):**
1. **API-A**, alone: migration, domain, gate, endpoints, unit tests.
2. **Web** and **API-B** (integration tests, matrix, openapi, seed), in parallel, against the working API.
3. The main session runs the final gates and the e2e tests.

## 0. Rules

- **All of** [round-1.md §0](round-1.md), [round-2.md §0](round-2.md) and [WORKFLOW.md "Round playbook" + "Round 3 lessons"](../WORKFLOW.md).
- In short:
  - only your app folder, plus your progress file `docs/specs/round-4-progress-<api-a|api-b|web>.md` (one line per finished part);
  - no git writes; no Docker or supabase CLI; don't start or kill processes;
  - local DB only, with a localhost check, and recorded in `schema_migrations`;
  - additive migrations; old API safe against the new schema;
  - keep line endings;
  - your own scratch folder: `<scratchpad>/round-4-<name>/`;
  - test budget: targeted tests while working, one full run at the end;
  - read only the §8 files and grep the rest;
  - use the Edit tool, not `sed`, for code.

## 1. The rule in one paragraph

From **any stage** of an event or a task, someone allowed to move that item can create a **child event** or a **child task**, tied to that stage. While a stage has **unfinished** children, the parent **can't move past it** (forward or completing), and can't jump over it. This is the same gate as round 3's approvals; both reasons can apply. A child is **finished** when:
- a task: its status is `done`;
- an event: it sits on its **last stage**, and that stage, if it needs approval, is **approved**.

**Cancelled events and deleted tasks don't block**, and a postponed event does. Nesting goes at most **3 levels** deep (parent → child → grandchild). The parent shows its children and their progress; each child shows "Part of: <parent> › <stage>". When the last unfinished child of a stage finishes, the parent's people are notified.

User's example: the event "10 reels for Brand X" has a stage "Production". Under it, the manager creates 10 child events "Reel 1…10", each from the "Reel production" template. "Production" can't be passed until all 10 reach their last stage.

## 2. Data (API-A). Migration `supabase/migrations/20261105000001_parent_child_work.sql`

Add the same columns to **both** `public.events` and `public.staff_tasks`, all nullable, so the old API is unaffected:

```sql
parent_event_id uuid references public.events (id) on delete set null,
parent_task_id  uuid references public.staff_tasks (id) on delete set null,
parent_event_stage_id uuid references public.event_stages (id) on delete set null,
parent_task_stage_id  uuid references public.task_stages (id) on delete set null,
depth smallint not null default 1 check (depth between 1 and 3),
-- at most one parent; its stage must be of the same kind:
check ((parent_event_id is null and parent_event_stage_id is null) or (parent_event_id is not null and parent_event_stage_id is not null and parent_task_id is null)),
check ((parent_task_id is null and parent_task_stage_id is null) or (parent_task_id is not null and parent_task_stage_id is not null and parent_event_id is null))
```

- Partial indexes for each FK, e.g. `(parent_event_stage_id) where parent_event_stage_id is not null`. These serve the gate's "open children of this stage" query.
- The API checks that the stage belongs to the parent (a composite FK isn't possible with nullable pairs; note this with a `-- shortcut:` comment).
- A parent deleted (tasks only) leaves its children as top-level, through `set null`. Depth then goes stale, which is harmless; note it.
- No other table changes.

## 3. Rules (API-A, pure, unit-tested; extend `src/domain/stage-approvals.ts` or add `src/domain/work-tree.ts`)

- `GateStage` gains `openChildren: number`. A stage **blocks** when it has unapproved approvers **or** `openChildren > 0`.
  - `blockingStage`, `maxReachablePosition`, `assertCanPass` and `nextBlockedBy` all use this.
  - `assertCanPass` throws **409 `STAGE_CHILDREN_OPEN`** ("<stage> has N unfinished parts") when children are the reason. When both reasons apply, it throws `STAGE_APPROVAL_REQUIRED`.
  - `nextBlockedBy` returns `{ stageId, stageName, reason: "approval" | "children", openChildren }`. The new fields are additions; nothing is renamed.
- `isFinishedEvent({ state, currentPosition, stageCount, lastStageNeedsApproval, lastStageApproved })` and `isFinishedTask({ status })`.
  - Open (unfinished) means: tasks, `status <> 'done'`. Events, `state <> 'cancelled'` and not finished.
- `assertDepth(parentDepth)`: creating a child of an item with depth 3 is 409 `WORK_TOO_DEEP`.
- **Who may create a child** (on top of the normal create rules):
  - The caller must be able to **move** the parent. Events: Admin, or a manager on the team (events:write). Tasks: assignee, creator or Admin.
  - **Child event:** the normal event-create rules (Admin, or a manager on the client's team). The client is **the parent's client**: an event's own, or the task's client. A parent task with no client gives 400 `WORK_CHILD_EVENT_NEEDS_CLIENT`. A different `clientId` in the body gives 400.
  - **Child task:** the normal task-create rules (the ladder, `staff_tasks:assign`, the template-role check). The parent event links to the child task as its `eventId`/`clientId` by default.
  - The stage must be one of the parent's stages (400 `WORK_PARENT_STAGE_INVALID`). The parent must not be a cancelled event (409 `EVENT_NOT_ACTIVE`) or a done task (409 `STAFF_TASK_DONE`). A parent you can't see gives 404, as usual.

## 4. API-A endpoints (extend the existing ones; no new routes)

- `POST /events` and `POST /staff-tasks` accept an optional `parent: { kind: "event"|"task", id, stageId }`. They validate it and set the columns and `depth = parent.depth + 1` inside the same transaction as the create, reading the parent row **FOR SHARE** (enough to stop a concurrent change, without blocking readers).
- **Event detail and task detail add:**
  - `parent: { kind, id, title, stageId, stageName } | null`. It's a stub only if the caller can see the parent; otherwise `{ kind, id: null, title: null, ... }`, so a parent the caller can't see never leaks. Simplest: return `null`.
  - `children: { kind, id, title, stageId, stageName (the parent's stage it hangs on), currentStageName, currentPosition, stageCount, status /* task */, state /* event */, finished: boolean, assigneeName /* task */ }[]`. Max 200, **one query per kind** (2 total), and only children the caller can see; count the hidden ones as `hiddenChildren: number`, so the UI can say "+2 you can't see". **The gate counts all children, visible or not**, so nobody can bypass it.
  - `stages[].openChildren: number`.
- **The move gate:** in `EventsService.moveStage` and `StaffTasksService.moveStage`/complete, alongside `approvedStageIds`, read open-children counts per stage in **one grouped query per child kind**, inside the same transaction. A helper in `approval-gate.ts` or a sibling `work-tree-gate.ts`.
- **Notification `stage_children_finished`** (live, label "Parts finished"): when a child **becomes** finished, check whether its parent stage now has zero open children. That covers a task reaching done, an event reaching its last stage, a final-stage approval, and a child event cancelled or a child task deleted.
  - If it has, notify the parent's movers: events, the notified team; tasks, the assignee and creator.
  - Payload: parent title, stage name and a link.
  - Best-effort, after commit; a failure never fails the child's move.
- Calendar, portal and lists are **unchanged**. A child event shows in the portal like any event; the parent/child structure is internal.
- Audit: `event.created`/`staff_task.created` metadata gains `parent: {kind, id, stageId}`.

## 5. Web

- **Create a child:** on event detail and task detail, each stage in the tracker or stage list gets "Add part…", shown when the viewer can move the item. It opens a small chooser, **Event** or **Task**, each shown only if allowed: a child event needs `events:write`, and for a task parent the task needs a client; a child task needs `staff_tasks:assign`. Then it opens the existing form (`NewEventClient` route or `TaskFormModal`) prefilled with the parent stage and the client, which is locked for a child event.
  - **"How many?"** (1–20, default 1). With N > 1 the titles get " 1…N" added and the web creates them one by one, showing progress "Creating 3 of 10…", then a summary. If one fails, stop and show which were made. This serves the user's "10 reels" example; the API stays one-per-request.
- **Parent detail:** a **"Parts"** section grouped by parent stage. Each child has a kind icon, a title link, a progress pill ("Rough cut · 2/5" or "Done"), the assignee for tasks, and a finished tick. Show "+N you can't see" from `hiddenChildren`.
  - The tracker shows a small count badge on stages with open children.
  - When `nextBlockedBy.reason === "children"`, the move control says "Waiting for N parts at <stage>" (round 3's reason line, extended).
- **Child detail:** "Part of: <parent title> › <stage>" breadcrumb at the top, linked when visible.
- **Approvals interplay:** the reason line shows the approval reason when that's what `nextBlockedBy.reason` says.
- **Guide:** add a "Parts (parent and child work)" entry.
- **Tests:**
  - Unit tests for the reason text and the bulk-title helper.
  - Playwright `e2e/parts.spec.ts`:
    1. An SMM creates an event (template with 3 stages). At stage 2 they add 3 child events with "How many = 3". The parent can't pass stage 2. Moving each child to its last stage unblocks it, and the SMM moves on.
    2. An SMM's task-parent creates a child task for an editor. The parent is blocked until the editor completes it.
    3. Depth: a grandchild of a grandchild is refused, with the message shown.
  - Use unique titles. Don't assume empty lists. `goto` saved URLs.

## 6. API-B (after API-A; parallel with Web)

- **Integration tests** (`tests/integration/parts.integration.test.ts`):
  - the user's 10-reels example (use 3 children);
  - the gate refuses passing and jumping; finished children unblock it; cancelled and deleted children don't block; a postponed child does;
  - finishing an event child needs final-stage approval;
  - both reasons at once give the approval error first;
  - depth 3 refused;
  - a child event inherits the client, a different client gives 400, and a task parent without a client gives 400;
  - a child task follows the ladder;
  - a hidden parent gives `parent: null`, and hidden children are counted, not listed;
  - the gate counts hidden children;
  - the notification fires exactly once when the last child finishes;
  - two children finishing at the same time give one notification at most, or at least one (state which, and test it);
  - the query budget for detail (children = 2 queries) and for a move (+1 grouped query per kind).
- **RBAC matrix:** child creation per role, for event and task parents, including refusals.
- **openapi.yaml:**
  - the `parent` body on both creates;
  - the `parent`, `children`, `hiddenChildren` and `stages[].openChildren` detail fields;
  - the `nextBlockedBy` additions;
  - the notification type;
  - the new error codes.
- **Seed:** one event "Brand X: 10 reels" with a "Production" stage holding 3 child events, one of them finished, plus one task with 1 child task. Re-runs reuse rows.

## 7. Impact list

- `nextBlockedBy` gains `reason` and `openChildren`. The web reason line must handle both reasons.
- Moves can now return **409 `STAGE_CHILDREN_OPEN`**.
- **Event detail and task detail get 2–3 more queries.** Update the query budgets.
- A child event counts like any event everywhere: dashboards, calendar, portal, reports. This is intended.
- **Deleting a parent task** leaves its children top-level, and the task delete confirm says "N parts will stay as separate items" (web).
- The bundle is near its limit on `/app/clients/[clientId]` (298/300 KB). Don't import the child UI into the client page; keep it on the event and task detail pages.

## 8. Read these files

**API-A:**
- `src/domain/stage-approvals.ts` (the `GateStage`, `blockingStage`, `assertCanPass` and `nextBlockedBy` gate)
- `modules/approvals/infrastructure/approval-gate.ts`
- `modules/events/application/events.service.ts` (`create`, `moveStage`, detail around line 90)
- `modules/events/infrastructure/drizzle-events.repository.ts` (`create`, `moveStage`)
- `modules/staff-tasks/application/staff-tasks.service.ts` (`create`, `moveStage`, detail around line 129)
- `modules/staff-tasks/infrastructure/drizzle-staff-tasks.repository.ts` (`create`, `update`)
- the latest migration, `20261104000001_stage_approvals.sql`, as the pattern
- `notifications/domain/notification.entity.ts` and `notification.messages.ts`

**API-B:**
- `tests/integration/approvals.integration.test.ts` (the pattern) and `helpers.ts`
- `tests/rbac-matrix.mjs` (the approvals section)
- `openapi.yaml` (events and staff-tasks)
- `src/db/seed.ts`

**Web:**
- `modules/events/components/{EventDetailClient,StageTracker,NewEventClient}.tsx`
- `modules/staff-tasks/components/{TaskDetailClient,TaskFormModal}.tsx`
- `modules/approvals/components/ApprovalCard.tsx` (the reason line)
- `lib/domain/types/{event,staffTask}.ts`
- `modules/guide/guideContent.ts`
- `docs/design-system.md`

## 9. Contract

```
POST /events       += parent?: { kind: "event"|"task", id: uuid, stageId: uuid }
POST /staff-tasks  += parent?: { kind: "event"|"task", id: uuid, stageId: uuid }
EventDetail / StaffTaskDetail += {
  parent: { kind, id, title, stageId, stageName } | null,
  children: { kind, id, title, stageId, stageName, currentStageName, currentPosition, stageCount,
              status: StaffTaskStatus | null, state: EventState | null, finished: boolean, assigneeName: string | null }[],
  hiddenChildren: number,
  stages[].openChildren: number,
  nextBlockedBy: { stageId, stageName, reason: "approval"|"children", openChildren: number } | null }
Notification type: stage_children_finished
Errors: STAGE_CHILDREN_OPEN (409), WORK_TOO_DEEP (409), WORK_PARENT_STAGE_INVALID (400),
        WORK_CHILD_EVENT_NEEDS_CLIENT (400), WORK_CHILD_CLIENT_MISMATCH (400)
```
