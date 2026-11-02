# Plan: team feedback, November 2026

Status: **draft, waiting for approval**. Nothing is built yet.
Written 2026-11-02 from the team's feedback (calendar, tasks, to-dos, task stages, approvals, parent/child work, client assets).

---

## The big picture in one paragraph

Today HOK has two separate worlds: **events** (client work with stages, managers only) and **tasks** (a simple to-do / in progress / done list, assigned by the Admin only). The feedback joins them into one workflow: everyone gets a calendar, managers can hand out tasks down the ladder, tasks get their own stages like events, any stage can need someone's approval (including the client's, from the portal), big jobs split into child events and tasks, and finished work is shared with the client as a "client asset" they can approve or send back. Plus a private to-do list for every person with reminders.

---

## 1. Calendar for everyone, tasks on the calendar, day pop-up, who can assign to whom

**Calendar for every role**
- Editors, writers, developers and agents get a Calendar too (today only managers have one).
- What each person sees on their calendar:

  | Item | Who sees it |
  |---|---|
  | Client events | Admin (all), Social Media / Marketing / Project Managers (clients whose team they're on). Same as today. |
  | Tasks (on their due date) | Admin (all), the person who created it, the person it's assigned to, and the managers on the linked client's team (decision 3) |
  | My to-dos (see §2) | Only the owner |

- **Events are client work only** (decision 6). Only Admin and the three managers create them, always for a client.
- **Personal events stay exactly as they are today** (managers only, owner-only, never shown in the client portal). The team will decide their future later. For everyone else, personal things go in My to-dos (§2).

**Month view: counts instead of chips**
- Each day shows small counts only, e.g. `2 events · 3 tasks · 1 to-do`. The broken "+2 more" goes away.
- Clicking a day opens a **pop-up** listing that day's events, tasks and to-dos, with buttons:
  - **New event** (Admin and managers), opens the event form with that date filled in.
  - **New task** (Admin and managers), same.
  - **New to-do** (everyone).
- Week and day views keep their normal layout.

**Who can create and assign tasks: the role ladder**

| Level | Roles |
|---|---|
| 1 (top) | Admin, Owner |
| 2 (middle) | Social Media Manager, Marketing Manager, Project Manager |
| 3 | Marketing Agent, Developer, Editor, Content Writer (and future roles like Lead Editor, placed where you decide) |

- Admin and level-2 roles can create tasks. Level-3 roles cannot.
- You can only assign **downwards**: level 1 → levels 2 and 3, level 2 → level 3. No same-level or upward assignment (decision 1).
- A manager can link a task only to a client or event they can already see.
- The **creator** (and the Admin) can edit, reassign, reopen or cancel a task. The **assignee** moves it along and adds their work. Today only the Admin can do these; this widens it to the creator.

---

## 2. My to-dos (private, for everyone)

- A personal to-do list for every role: title, optional notes, optional due date and time, **urgency** (low / medium / high / urgent), done tick.
- **Only the owner sees them** (open question 5; that's my default).
- Shown in three places: a **"My to-dos" card on every dashboard**, the **calendar** (on the due date), and a **To-dos page**.
- **Reminders by urgency** (in-app bell + phone/desktop push), proposed defaults:

  | Urgency | Reminders |
  |---|---|
  | Urgent | 1 day before, 1 hour before, and at the due time |
  | High | 1 hour before and at the due time |
  | Medium | At the due time |
  | Low | None (it just shows as overdue) |

  Reminders use the existing reminder job, so they can arrive up to 10 minutes late. The job runs **once for the whole company** every 10 minutes, not once per person. Each run is a single indexed database query for "what's due now", so 5 people or 50 people cost about the same (a few milliseconds, 144 times a day). The server bill doesn't change.
- Separate from today's **client to-dos** (the shared list inside each client), which stay as they are.

---

## 3. Stage templates for tasks

- Stage templates get a **type: Event or Task**. Admin makes both kinds (as today).
- **Tasks and events work the same way** (decision 7): every task is created from a task template, just as every event comes from an event template. The difference is who they're for:
  - **Event:** client work, shown in the client's portal, and its stages can need the client's approval.
  - **Task:** internal team work. The client never sees it, and its stages have **no client approval option** (decision 8).
- A task template can be marked for one or more roles, e.g. *"Reel edit"* for Editors: `Brief received → Rough cut → Internal review → Final cut → Delivered`. The task form offers the templates for the assignee's role.
- A task moves through its stages like an event does, with a history of who moved it and when. It counts as **done** when it passes its last stage.
- **No built-in template and no migration.** There are no existing tasks, and the team has paused using the portal until these changes ship. From then on, a task can only be created from a task template the Admin has made. "Blocked" stays as a flag the assignee can raise on any stage, with a reason.

---

## 4. Approvals, client portal review, client assets, parent/child work, links on tasks

### 4a. Stages that need approval (events and tasks)
- In a template, each stage can be ticked **"needs approval"** and you choose **who approves**:
  - **Client** (from the portal; **event templates only**, since tasks are internal)
  - **Admin**
  - **Manager** (a manager on that client's team)
  - **A specific role**, e.g. Lead Editor if you add that role later
- The work **cannot move past that stage** until it's approved.
- Flow:
  1. The team member clicks **Request approval**, optionally attaching the work, for example the edited reel's link.
  2. The approvers get a notification and see the request.
  3. They choose **Approve** or **Request changes**, with a comment. A comment is required when requesting changes.
  4. If changes are requested, everyone involved is notified. The team then moves the work back to whatever stage they choose (manually, as you said), fixes it, and requests approval again. Every round is kept in the history.
- If a stage lists more than one approver (for example Manager **or** Client), **one approval from any of them** unlocks it (decision 2).

### 4b. Client approval in the portal
- On the portal's event page, the client sees a **"Waiting for your approval"** box with the work shared with them (4c), and two buttons, **Approve** and **Request changes**, plus a comment box.
- The portal has no logins (it's link-based), so the record says "Approved by the client via the portal link", with the time. Anyone holding the link can approve. That's the same trust the link already has today.

### 4c. Client assets (only marked ones are shown)
- Any asset on an event can be marked **"Show to client"**, and optionally tied to a stage. Only marked assets appear in the portal. Everything else stays internal, as today.
- A task's **delivered link** (4e) gets a **"Share with client"** button. It turns the link into a client asset on that event in one step.
- These are links (Drive, Instagram and so on), so the client also needs permission on the Drive side to open them. HOK can't control that.

### 4d. Parent and child events and tasks
- From **any stage** of an event or task, you can create a **child event** or a **child task**. Example: the event "10 reels for Brand X" has stages "Reel 1" to "Reel 10". Under the "Reel 1" stage you create a child event using the "Reel production" template, and all of that reel's stages live in the child.
- **A stage with children is blocked until all of them are finished.** The same works for tasks: "from this stage, create a task for the writer; when it's done I can move on".
- Who can create which child:

  | Child | Who can create it |
  |---|---|
  | Child event | Admin and managers |
  | Child task | Admin and managers (it follows the ladder in §1) |

- "Finished" means a child event that passed its last stage (and any approvals), or a child task that is done. A **cancelled** child no longer blocks.
- The limit is 3 levels deep (parent → child → grandchild), to keep it understandable.
- The parent shows its children with their progress. Each child shows "part of: …".

### 4e. Links on every task: brief and delivered work
- Every task gets a **Links** area with two lists:
  - **Brief and inputs**: added by the creator or manager, for example the script, references, content and raw footage.
  - **Delivered work**: added by the assignee, for example the edited video and the final copy.
- Each link has a label, who added it and when, and optionally the stage it belongs to.
- This works for all roles. Today's editor-only fields (raw files link, reference link, references list) move into this area automatically, with no data lost. The script stays as a text box, renamed **Brief** and available on every task.
- No link is required on any task. The editor raw-files rule is dropped (decision 4).

---

## Proposed order of work (each step is tested and deployed on its own)

| Step | What | Size | Why this order |
|---|---|---|---|
| A | Task ladder (managers can assign) + calendar for everyone + tasks on calendar + day pop-up | Medium | Fixes the broken "+more" and is most visible to the team |
| B | My to-dos with reminders, dashboard card, calendar | Medium | Standalone, quick win for everyone |
| C | Links on tasks (brief / delivered) + "Show to client" assets in the portal | Medium | Needed before approvals make sense |
| D | Task stage templates (every task created from a template) | Medium | Needed before task approvals and task children |
| E | Stage approvals (team roles + client in portal) | Large | The core of the new workflow |
| F | Parent/child events and tasks, blocking stages | Large | Builds on D and E |

**Grouped into 4 rounds** (decided 2026-11-02). The safe steps are paired. The two risky ones run alone, so each review stays small:

| Round | Steps | Why |
|---|---|---|
| 1 | A + B: ladder, calendar for everyone, day pop-up, My to-dos | Safe pair: both are calendar and dashboard work |
| 2 | C + D: task links, client assets, task templates | Safe pair: both reshape the task page |
| 3 | E alone: approvals (team roles + client in portal) | Risky: changes how stages move and adds a public portal action |
| 4 | F alone: parent/child events and tasks | Risky: blocking logic across events and tasks |

**How each round runs (automated):**
1. Opus writes the spec, `docs/specs/round-N.md`.
2. Up to 2 Sonnet 5.5 helpers build it at high effort, split API and web by a fixed contract.
3. Opus reviews the whole change for bugs and security, fixes what it finds, and runs all tests and the permission matrix.
4. The user gets one report. Commit, push and production `db push` still each need the user's yes.

For every round:
- **Database changes** only add to what exists. Nothing is dropped, and today's data keeps working. You run `db push` on production yourself, as before.
- **Tests run locally only:** unit and integration tests, the role-permission matrix (extended to the ladder and approvals), and browser tests for the new screens. **No testing on production.**
- **Docs:** requirements updated to v0.4, plus the decision log, the summary PDF and the in-app guide.

One commit and push per round, each only after your "yes".

**After round 4:** the full Cloudflare security audit, run when the user asks.

---

## Decisions (2026-11-02)

1. **Assignment goes only downwards.** Admin → levels 2 and 3. Managers → level 3. No same-level or upward assignment.
2. **Several approvers on one stage: any one is enough.** The first approval from any ticked approver group unlocks the stage.
3. **Who sees a task:** the Admin, the creator, the assignee, **and the managers on the linked client's team**.
4. **Editor raw-files rule: dropped.** No link is required on any task. The manager decides what to attach.

5. **My to-dos are private to the owner.** Even the Admin can't see them (the default; the user didn't change it).
6. **Events are client-specific only**, created by Admin, SMM, MM and PM. Personal events stay unchanged for now; the team decides their future later.
7. **Every task uses a task template** the Admin made, the same way as events. No built-in template: there are no existing tasks to move.
8. **Client approval exists only on event stages.** Tasks are internal team work, and the client never sees them.

## Risks and notes
- **Steps E and F are the biggest change since launch.** They touch how events and tasks move, so each is its own round with extra local tests for edge cases (rejections, cancelled children, deep nesting).
- **Task assignment rights** move from Admin-only to the ladder. That's a change in who can do what, so it gets the full permission-matrix test.
- **Calendar speed:** the calendar now reads 4 kinds of items. Each read is capped and indexed, and I'll measure it locally with realistic data (50 users) in round 1.
