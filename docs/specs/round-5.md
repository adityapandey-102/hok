# Round 5 spec: copyable portal link, a clearer client portal, stage lists that scale

Rounds 1–4 are committed. Not yet committed (don't touch, don't revert): the Next 16.4.6 upgrade (`package.json`, `package-lock.json`, `next.config.ts`), the clickable "Location or link" (`LinkifiedText`, `lib/domain/utils/links.ts`), `start-dev.ps1`.

**User feedback (2026-11-18):**
1. On the client's **Portal** tab, staff must **always** be able to copy the current portal link, not only right after making it. The user chose to store the link in **plain text** (simplicity over at-rest secrecy; recorded as a decision). Making a new link must switch the old one off immediately (it already does: keep it so).
2. The client portal is confusing. Anything shared with the client (reels, designs, content) must be **noticed instantly**: shown up front, and **highlighted on its stage**, together with what is waiting for the client's approval. The portal needs a more structured, easier, more interactive UI and UX.
3. Stage lists (events and tasks, staff and portal) break with **13 or more stages**. On phones the long list must become a **dropdown**. Inspiration: needleye's `OrderStatusTracker` (summarised in §4; the needleye project is read-only and must never be opened for writing).

**Helpers (in parallel):**
- **API**: §2 and §3.
- **Web**: §4, then §5 and §6. Code against the §3 contract; before the e2e, check that `docs/specs/round-5-progress-api.md` says "done".

The main session runs the final gates, the screenshots and the e2e tests.

## 0. Rules

- **All of** [round-1.md §0](round-1.md), [round-2.md §0](round-2.md), [round-4.md §0](round-4.md) and [WORKFLOW.md](../WORKFLOW.md) ("Round playbook" and "Round 3 lessons"), plus the `hok-practices` skill (`.claude/skills/hok-practices/SKILL.md`).
- In short:
  - only your app folder, plus your progress file `docs/specs/round-5-progress-<api|web>.md` (one line per finished part);
  - no git writes; no Docker or supabase CLI; don't start or kill processes (API on 4100 and web on 3400 are running);
  - local DB only;
  - additive migrations;
  - keep line endings;
  - your own scratch folder: `<scratchpad>/round-5-<api|web>/`;
  - test budget: targeted tests while working, one full run at the end;
  - use the Edit tool, not `sed`, for code.
- **Test logins (local):** the seed accounts (`admin@hok.test`, `rohan.smm@hok.test`, … password in `hok-api/src/db/seed.ts`) are back for this round. Don't delete any data; the main session cleans up.
- **Web builds:** use `NEXT_DIST_DIR=.next-r5`, restore `tsconfig.json` byte-identical, and delete the dist folder afterwards.

## 1. Words the client sees

- Plain English, no jargon. In the portal, call stages **"steps"** ("Step 5 of 13"). Staff pages keep "stage".
- A shared link is a **"file"** in the UI ("2 new files"), whatever its type; the type label ("Video", "Design") stays as a small tag.

## 2. API: portal link stored, so it can be copied any time

- **Migration** `supabase/migrations/20261118000001_portal_link_token.sql`: `alter table public.portal_links add column token text;` (nullable). Update `portal.schema.ts` and its comment ("the token is stored in plain text so staff can copy the link again; decision 2026-11-18").
- **Generate:** store `token` alongside `token_hash`. The public lookup stays by `token_hash`, unchanged.
- **Read current link** (the staff endpoint behind `findCurrent`; find it in `portal-links.routes.ts`): also return `url` (built with the existing `portalUrl(webAppUrl, token)`) when the active link has a token, else `url: null` (a link made before this round). Same RBAC as now. **Never** return the token or the url from any public `/portal/*` route.
- **Regenerate:** keep the current behaviour (in one transaction, the old link becomes `active=false` with `revoked_at`, so the old URL gets `PORTAL_LINK_INVALID` at once). Add an integration test: generate A, generate B, A is 404/invalid and B works, and GET current returns B's url.
- OpenAPI, README and the RBAC matrix are updated if the shape changed.

## 3. API: what the portal needs to put shared files and approvals up front

Contract (add to the portal entity, presenter and DTOs; presenters copy fields explicitly, never a spread):

```ts
// Every PortalEvent in the dashboard (current, upcoming, recent) AND in the event detail gains:
awaitingYourApproval: boolean;          // a pending approval this client can decide on this event (today only the current one has it)
approvalStagePosition: number | null;   // the stage position that approval is for
fileCount: number;                      // assets shared with the client on this event
fileStages: { position: number; count: number }[]; // shared assets per stage (only stages with ≥1); assets with no stage are not listed here
latestFileAt: string | null;            // newest shared asset's createdAt

// PortalAsset (event detail) gains:
stagePosition: number | null;

// PortalDashboard gains:
attention: {
  approvals: { eventId: string; eventTitle: string; stageName: string; stagePosition: number; requestedAt: string }[]; // all pending client approvals, oldest first, max 20
  files: { id: string; title: string; url: string; type: string; eventId: string; eventTitle: string; stageName: string | null; stagePosition: number | null; createdAt: string }[]; // shared in the last 30 days, newest first, max 12
};
```

- Only data the portal may already show: assets marked "Show to client", on this client's non-hidden events. Same visibility rules as today's event detail. No staff names.
- **Query budget:** the dashboard stays a constant number of queries (grouped counts, no per-event query). Extend `query-budget.integration.test.ts`.
- Integration tests:
  - the counts and positions are correct;
  - an asset not shared with the client never shows;
  - another client's data never shows;
  - an approval for staff (not the client) does not set `awaitingYourApproval`.
- **Comments per event (added 2026-11-18):** `GET /portal/:token/comments` accepts an optional `eventId` (uuid, zod-validated). It returns only that event's comments, paged as now, and only if the event belongs to this client and is visible in the portal, else 404 `EVENT_NOT_FOUND`. `POST` with `eventId` already exists; keep it. Add integration tests: the filter works, another client's event gives 404, and an invalid uuid gives 400.
- Progress lines, then "done" in `round-5-progress-api.md`.

## 4. Web: `StageRail` that scales (one component; every stage list uses it)

File: `components/brand/StageRail.tsx`. Callers: `StageTracker` (event and task pages) and `PortalStageTrack` (portal). Keep the existing per-stage features: the approval lock or green seal, the parts badge, and the sr-only texts.

**New optional props:**
- `unit?: "Stage" | "Step"` (default "Stage");
- per stage `highlight?: "approval" | "files"` and `files?: number`;
- `onStageClick?: (key: string) => void`. When given, every stage is a `<button>`.

**Desktop and tablet (≥ 640px):**
- **≤ 6 stages:** today's horizontal rail, unchanged.
- **More than 6:** needleye's wrapping grid.
  - `grid grid-cols-4 gap-y-5 lg:grid-cols-7` (at 13 stages: 2 rows at lg, 4 rows below).
  - Each cell is a centred 28px node with the label under it: `max-w-[104px] text-center text-[11.5px] leading-tight line-clamp-2`, with `title` holding the full name.
  - Connectors are **two half-segments per cell** (incoming and outgoing, 2px), so the line continues across wrapped rows: ink when reached, `bg-border` otherwise. No horizontal scrolling and no truncated single line.
- **Node states** (unchanged look): done is ink with a tick; current is crimson with `current-pulse`; upcoming is hollow and numbered.
- **Highlights:**
  - `approval`: an amber ring (`ring-2 ring-warning ring-offset-2 ring-offset-card`) on the node, plus a small amber chip under the label, "Your approval" (portal) or "Approval" (staff).
  - `files`: a small crimson count badge on the node's top-right (`files` number, `aria-label="N files"`).
  - Both may apply.

**Phones (< 640px):**
- **≤ 4 stages:** the vertical list as today.
- **More than 4:** a dropdown, a native `<details>`, as in needleye.
  - **`<summary>`:** the current node (number, or a tick when all done), then a caption "Step 5 of 13" or "All 13 stages done", the current stage name (truncated, bold), a thin progress bar, and a chevron that rotates when open.
  - If **any** stage has a highlight, the summary also shows chips: amber "Needs your approval" / "Needs approval", and crimson "N files" (the sum).
  - **Open:** the full vertical list (today's vertical style, highlights included). The current item gets `scrollIntoView({block:"nearest"})` on open.
- **Accessibility:**
  - The wrapper is `role="group"` with `aria-label="<label>: <current name> (<unit> n of N)"`.
  - Keep `aria-current="step"`.
  - `prefers-reduced-motion` stops the pulse (it already does globally; check).
- Unit tests for any pure helper you add (e.g. the summary text, or which layout to use for a count). A component test for: 13 stages render all 13 names; the phone summary shows "Stage 5 of 13"; and the highlights appear.

## 5. Web: the client portal, restructured (`modules/client-portal/**`)

The goal: the client opens the link and knows within 3 seconds **what needs them** and **what's new**.

**Page structure (top to bottom), max-w-4xl:**
1. **Header:** keep the brand band but make it **slimmer** (py-5).
2. **Sticky segmented tabs:** **Overview · Calendar · Messages**. Use the staff app's segmented control from `components/ui/`, the same one other pages use.
   - The tabs stick under the top on scroll (`sticky top-0 z-20`, with a card background and a hairline).
   - The tab is in the URL hash (`#calendar`, `#messages`), so the back button and refresh keep it.
   - Messages shows a count badge of the client's comments with replies they haven't seen, **only** if that is already available from the comments API; otherwise no badge.
3. **Overview** (CHANGED 2026-11-18 after the user saw it: **there is no "Needs your attention" card** and no up-front list of files or approvals. Ignore 3a below. Files and approvals show **only on the event cards and rows**: see "Files tag" here and the chips in 3b/3c.)
   - **Files tag (replaces every "N files" chip and the attention card):**
     - **Text:** "1 file shared" / "N files shared". Never "Needs your attention".
     - **Colour:** green, the design system's success tokens (`bg-success-bg text-success`, a `ring-1 ring-success/30` border) and a small file icon. Use the same green for the stage-node files badge in §4 (instead of crimson) when `unit="Step"`. Staff pages may keep crimson.
     - **Motion:** a very slow ripple: one soft green ring expanding from the tag and fading, every ~4 s (`@keyframes` in globals.css, 2.4 s ripple plus a pause, `opacity .35 → 0`, scale 1 → 1.35). It's calm and doesn't move the layout (a `::after` pseudo-element). Off under `prefers-reduced-motion`. Only on tags of events whose files are newer than the last visit, if that's known; otherwise on all file tags.
     - **Where:** the current project card, the Coming up / Recently finished rows, and the event sheet header. The tag is a button that opens the event at its files.
   - **Approvals:** stay as the amber "Needs your approval" chip and the "Review and approve" button on the event card and rows (no up-front list).
   - The API's `attention` field stays unused by the UI (harmless; may be removed later).
   - **a. "Needs your attention"**: a card with an amber accent, shown only when there's something.
     - One row per `attention.approvals`: a shield icon, then "Approve **<stageName>**", a muted line with "<eventTitle> · requested <relative date>", and a primary button "Review". It opens the event at its approval.
     - One row per `attention.files`: a type icon, the file title, and a muted line with "<eventTitle> · <stageName>". A **"New"** pill appears when `createdAt` is later than this browser's last visit. Buttons: "Open" (external, `noopener noreferrer`) and "Details" (opens the event, scrolled to its files).
       - Store the last visit in `localStorage` keyed by a hash of the token (never the token itself). Wrap every read and write in try/catch. Write it on unload or after 5 s. Without storage, show no "New" pills.
     - Approvals come first. Show max 5 rows, then "Show all N".
     - **Nothing to do:** show a quiet green line instead, "You're all caught up. We'll show anything that needs you here."
   - **b. "Your current project":** today's hero card, rebuilt.
     - Its title, when, `LinkifiedText` location, and type pill.
     - A chip row: "Needs your approval" (amber) and "N files shared" (crimson outline). The chips are buttons that open the event.
     - Then the new `StageRail` with `unit="Step"`, the highlights from `approvalStagePosition` and `fileStages`, and `onStageClick` opening the event scrolled to that step.
     - The primary button is "Review and approve" when an approval is waiting, else "Open project".
   - **c. "Coming up"** and **d. "Recently finished"**: today's lists. Each row adds chips: "Needs approval" (amber) and "N files" (when `fileCount > 0`). Keep "Show all N".
4. **Calendar tab:** today's `PortalCalendar`.
5. **Messages tab:** today's `PortalComments`.
6. **Footer:** unchanged.

**Event view (`PortalEventModal`), restructured.** It's a full-screen sheet on phones and the existing modal on desktop. Its order:
1. Title, when, location (linkified), type and state pills.
2. **Your action:** today's `PortalApprovalBox` when an approval is waiting, first and unmissable.
3. **"Shared with you"** (if any files): grouped by step, **the step that's awaiting approval first, then the current step**, then the others in step order.
   - Each group's heading is "Step 3 · Edit", with a count.
   - Each file is a large tap row: type icon, title, type tag, date, and an "Open" button (external).
   - Ungrouped files (no stage) go under "Other files".
4. **"Progress":** the `StageRail` (`unit="Step"`, with highlights; a click scrolls to that step's files group, if there is one).
5. **"Updates":** today's update timeline.
6. **"Approval history":** today's, collapsed by default when it has more than 3 entries.
7. **"Comments on this event"** (added 2026-11-18, the user's request: the client comments right from the event, without going down to Messages and picking the event):
   - a compact composer at the bottom of the sheet: a textarea with "Write a comment about <event title>…" and a "Send" button. The event is fixed (no event picker). It posts with `postComment(token, body, eventId)` and reuses the `PortalComments` validation, length limit and error handling: extract the shared part into a small component or hook rather than copying it.
   - Above the composer: this event's comments (`GET /comments?eventId=`), newest first, each with its status pill (Received / In progress / Solved), the last 5 shown, then "Show more".
   - After sending: the comment appears at once, the Messages tab list refreshes, and a quiet "Sent. Your account manager has been notified." shows for 3 s.
   - Add a **"Comment"** chip button in the sheet header that scrolls to the composer and focuses it, and add `focus: "comment"` to the focus prop.
   - On phones, the sheet's composer stays reachable. A sticky bottom bar on the sheet with "Comment" (and "Review and approve" when an approval is waiting) is fine.
   - Tests: a component test that posting from the sheet sends the eventId, and an e2e step where the client comments from the event and the comment shows on the staff event's comments.
- Opening the event from "Details", a stage click, or "Review" scrolls to the right section (pass a `focus` prop: `"approval" | "files" | { step: number }`).

**Look and feel:**
- Keep the design system (`hok-web/docs/design-system.md`): Apple-style grouped sections, Phosphor icons through `Icon`, crimson for "new/files", amber for "needs you", green for "done/caught up".
- Tap targets ≥ 44px.
- No new dependencies.
- Respect reduced motion; the only motion is a short fade and lift when the attention card enters.
- **Mobile first:** at 360px nothing scrolls sideways, and buttons in rows wrap under the text.

**Tests:**
- Unit tests for the pure helpers (grouping files by step and their order, the "New" decision, the relative date).
- Component tests (mocked API) for:
  - the attention card's empty and full states;
  - the tabs switching and the hash;
  - the modal ordering.
- Update or add the **e2e** in `e2e/approvals.spec.ts` or a new `e2e/portal.spec.ts`:
  - the staff marks an asset "Show to client" on an event stage;
  - the client sees it in "Needs your attention" and as a badge on that step;
  - the client opens it in the event's "Shared with you";
  - an approval request shows first in attention, and the step has the amber ring;
  - at 390px the stage list is a dropdown, showing "Step n of N" when closed and all steps when open.

## 6. Web: the Portal tab for staff (`modules/portal/components/PortalTab.tsx`)

- **Active link with `url`:**
  - a read-only field showing the link (`data-testid="portal-url"`, as now);
  - **Copy** (copies, then shows "Copied" for 2 s; if the clipboard fails, it selects the text and says "Press Ctrl+C");
  - **Open** (new tab);
  - **Make a new link**, behind a confirm: "The current link will stop working immediately. Make a new one?";
  - **Switch off** (as now).
- **Active link without `url`** (made before this round): the text "This link was made before links could be copied again. Make a new link to get one you can copy any time." plus **Make a new link**.
- **No link:** as now.
- Update `e2e` for: copy is visible on revisit, and after "Make a new link" the old URL shows the "This link isn't active" page.

## 7. Done

- **API:** lint, typecheck, unit, integration (the full suite once), rbac matrix, openapi.
- **Web:** lint, typecheck, unit, the build plus `check:bundle` (`/p/[token]` and `/app/clients/[clientId]` within their budgets: report the numbers), and the touched e2e specs.
- **Docs:** REQUIREMENTS (FR-POR: copy link any time, attention area, highlights; FR on stage lists scaling), DECISIONS (plain-text portal token, 2026-11-18, the user's choice), and `hok-web/docs/design-system.md` (the StageRail rules).
- **Report (10 lines or fewer):** the files changed, the checks with counts, deviations, and anything undone.
