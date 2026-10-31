# HOK: decision log and changelog

> Moved out of CLAUDE.md on 2026-10-15 so it isn't loaded into every session. Append new entries here.

## Decision log

| Date | Decision | Notes |
|---|---|---|
| 2026-10-31 | **Security audit run 2 fixes** (the 8 needs-validation leads + the 2 deferred areas). (1) Calls hok-web's server makes for a browser (login, refresh, logout, Server Components) carry the visitor's IP in `x-hok-client-ip` plus a shared secret `INTERNAL_PROXY_SECRET` (both apps, required in production); hok-api believes that IP only with the secret, else uses the connection IP (`TRUST_PROXY` = Railway's edge hop count). Kept the Next.js-in-the-middle design for login (no direct browser login, no Cloudflare). (4) Login limits: per IP, per IP+email (failures), per email (failures) with a **trusted-device cookie** (`hok_dev`, httpOnly, 90 days) that skips the per-email limit. (6) **Max 2 push devices per user**; a 3rd drops the least recently used. Also: Supabase outages are 503 not 401; junk bearer tokens rejected locally + a 401-per-IP limiter; link previews 64 KB, linear parse, UTF-8/HTML/control-char checks, max 2 at once; reactivating an Admin is Owner-only; deactivation ends every session; reset request limited per email (3/h) and answered before Supabase is called. | User decisions 2026-10-31 |
| 2026-10-11 | Assets are stored as links only (no uploads) | Original brief |
| 2026-10-11 | Developers & Editors get only the task module | Original brief |
| 2026-10-11 | Clients access via generated link, no login account | Original brief |
| 2026-10-13 | Marketing Agent = tasks only | User answer |
| 2026-10-13 | One owner per client; Admin reassigns | User answer |
| 2026-10-13 | Only Admin assigns staff tasks; one assignee; assignee can mark Done | User answer |
| 2026-10-13 | Portal: link only, revocable, no expiry; no assets on portal; plain branding | User answers |
| 2026-10-13 | Client comment push → owning manager only; no client email/WhatsApp in v1 | User answers |
| 2026-10-13 | Admin-made stage templates; manager selects one per event; stages used as-is (snapshot copied to event) | User answer + design detail |
| 2026-10-13 | PWA (mobile-friendly installable website), no native app | User answer |
| 2026-10-13 | Scale ~20–50 staff, ~100–500 clients; multiple time zones; English | User answers |
| 2026-10-13 | Google Calendar sync later (Phase 3); portal in Phase 1; no fixed deadline | User answers |
| 2026-10-13 | Editor task fields: raw files Drive link, reference edit link, script | User message |
| 2026-10-13 | Stack/architecture/tooling = needleye-pilot (read-only reference) | User answer |
| 2026-10-13 | Hosting: Railway (API), Supabase (DB/auth/user mgmt), Vercel (web) | User answer |
| 2026-10-13 | Client tasks and staff tasks are separate modules | Architecture decision |
| 2026-10-13 | GitHub account adityapandey-102; repos hok-api / hok-web | User answer |
| 2026-10-13 | Local-first: Docker Supabase exactly like needleye; production later | User answer |
| 2026-10-13 | Migrations = hand-written SQL in `supabase/migrations` (needleye's real practice); Drizzle schema mirrors the tables | Found in needleye analysis |
| 2026-10-13 | HOK ports offset from needleye (Supabase 544xx, API 4100, web 3400); same pinned Supabase CLI so Docker images are reused | Architecture decision |
| 2026-10-13 | Use needleye-web's design system exactly (staff app + portal) | User instruction |
| 2026-10-13 | One website = portfolio + agency management; buyer-file template ported as-is into hok-web `(site)` at `/`; redesign with real data later | User instruction |
| 2026-10-13 | Two Next.js root layouts: `(site)` (template Bootstrap/jQuery) and `(main)` (Tailwind design system), so the styles never mix; staff app under `/app`; proxy guards only `/app/*` | Architecture decision |
| 2026-10-13 | New milestone M1 = portfolio port; later milestones renumbered (M2 auth … M11 hardening) | Plan |
| 2026-10-13 | hok-web code goes into the existing GitHub repo `adityapandey-102/hok` (buyer-file's remote) | User answer |
| 2026-10-13 | Replace the template's Font Awesome Pro with free icons that look better (Lucide where possible, matching the app) | User answer |
| 2026-10-13 | Web port 3400 (3100 is used by the user's delight-caters app) | Found while verifying M0 |
| 2026-10-13 | Supabase public sign-up disabled; storage + realtime disabled (unused); profiles trigger defaults a missing role to the least-privileged `editor` | M0 implementation |
| 2026-10-15 | No email notifications at all: push + in-app bell only | User answer |
| 2026-10-17 | Platform redesign after Phase 1: staff app + client portal (not the public website) move to the HOK logo's black + red, premium professional look, light theme by default with a dark-mode toggle, graphics and smooth animations. needleye stays the structural reference. Approved details: crimson #C1202D + ink #231F20 from the logo; ink-black sidebar, white/light-grey workspace; **black main buttons** (white in dark mode), red only for brand moments, active states and alerts; Archivo (wide-cut headings, normal-width body); signature graphic = the logo's split O (loader, stage tracker, empty states, one page-load moment); dark-mode toggle in the top bar | User instruction + answers |
| 2026-10-17 | Phases 2 and 3 merged into one Phase 2 (to-do lists, reminders, search, activity log, link previews, reports); Google Calendar (ICS) export dropped for now | User instruction |
| 2026-10-17 | Reminders: one, 2 h before (events: owner; tasks: assignee), background check every 10 min, bell waving animation on arrival. Last seen on the profile row (no log scan), "not seen" after 45 days. Reports modelled on needleye's (team status, staff, client, daily activity). Every foreign key gets an index | User instruction |
| 2026-10-21 | Last seen reads "x min / hours / days / weeks ago" (no "active now"). Phase 2 ends with a global "Guide me" modal on every page: searchable, structured help, pre-filled with the current page's topic | User instruction |
| 2026-10-21 | Installed the **ponytail** skills (github.com/dietrichgebert/ponytail @09c434a, MIT) into `HOK/.claude/skills/` only: ponytail, -review, -audit, -debt, -gain, -help. Reviewed first: plain instructions, no scripts. The plugin's per-turn hooks (usage ledger in the home folder, optional webhook) were NOT installed. Working default: ponytail full mode, within HOK's own rules | User instruction |
| 2026-10-21 | Daily activity lives in Reports (a 4th tab, needleye-style) instead of its own page: one place, same component. `/app/activity` redirects to `/app/reports?view=activity`; the separate menu item is gone | Lead decision, following the user's needleye reports instruction |
| 2026-10-22 | Google Calendar export back (FR-CAL-08) as a **subscribe link**, not a one-off file: one secret link per person with a calendar, hash-only, revocable, a new one replaces the old; same items as their HOK calendar, last 30 days + next 180; served by the API at `/api/v1/calendar-feed/<token>.ics`. Google re-fetches on its own schedule (usually within a day), read-only | User instruction ("do 3"), design by lead |
| 2026-10-22 | Fixes from the whole-project review: logout ends only this device's session (`local`, was `global`); session routes accept same-origin JSON only; `?next=` must stay on this site; sign out removes this browser's push subscription; a failed web refresh no longer clears cookies (the proxy does that for dead sessions); the calendar feed's link is built by the API from new `PUBLIC_API_URL`; secret one-time links share `OneTimeLink` and ask before replace / turn off / closing un-copied | User instruction ("fix all issues"), choices by lead |
| 2026-10-22 | Clients get lists: websites, phones, contact people (name + optional mobile / email) and social accounts (platform from a drop-down, may repeat), stored on the client row (`text[]` / `jsonb`, capped 10 / 10 / 20 / 20), not child tables. Old single columns migrated and dropped (migration 20261022000002, applied with the user's OK). Every phone field gets a country-code picker (stored as one international number). Time zone picker searches city / country / offset (the old box only suggested what was already typed) | User instruction |
| 2026-10-22 | Web dev server: Turbopack's on-disk dev cache turned off (`turbopackFileSystemCacheForDev: false`); with it the idle server used 6-7 cores and crashed out of memory. Confirmed after: 0.9 CPU-s per 15 s idle, no cache folder | Lead, measured |
| 2026-10-23 | **Client teams** (user accepted the lead's proposal): HOK owns every client; each has a team (`client_members`) of Client Managers with one **lead** (`clients.owner_id`). Managers see only clients whose team they're on; Admin sees all. Team members edit the client and everything under it; archive / unarchive / team changes are Admin only; the portal link is the lead's (or Admin's). New client comments and event reminders go to the whole team; people added are notified. Task-only staff still see only their tasks. `PUT /clients/:id/team` replaces `POST /clients/:id/reassign`. Migration 20261023000001 (applied with the user's OK) | User decision |
| 2026-10-23 | New role **Project Manager** (`project_manager`) with exactly the Social Media / Marketing Manager's access | User instruction |
| 2026-10-23 | **Apple-style redesign** of the staff app + portal on branch `ui-improved` (main untouched): flat warm page with white grouped sections (iOS Settings style), no empty "—" rows, segmented controls with a sliding thumb, phone tab bar (Home / Clients / Calendar / Tasks / More) instead of the hamburger, bottom sheets on phones, Phosphor icon shapes filled when selected, soft filled fields, capsule pills, motion only in answer to an action. Current colours and fonts kept. Icons generated with only the weights used to stay inside the 300 KB budget. Rules: hok-web/docs/design-system.md | User instruction (Apple design sense, current colours, better icons, separate branch) |
| 2026-10-13 | User allows two helper agents; Claude manages them. Ownership: one agent hok-api only, one agent hok-web only; root docs stay with the main session | User instruction |


## Changelog

| Date | Change |
|---|---|
| 2026-10-11 | Project started. Created `docs/REQUIREMENTS.md` v0.1 and this `CLAUDE.md`. |
| 2026-10-11 | Created 4-page plain-language summary PDF (+ HTML source) because the full spec was too long for the user to review. |
| 2026-10-13 | User answered all open questions + added editor task fields. Analysed needleye-pilot (read-only). Requirements → v0.2, summary PDF regenerated, `docs/ARCHITECTURE.md` v0.1 draft created. |
| 2026-10-13 | GitHub account + local-first confirmed. ARCHITECTURE → v0.2 (local env, ports, migration approach). Created `docs/DEVELOPMENT-PLAN.md`. |
| 2026-10-13 | M0 built and verified: hok-api (common infra copied from needleye, roles/capabilities for HOK, profiles + audit_log migrations, seed of 7 staff, health/api-docs, unit + integration tests green) and hok-web (needleye design system, two root layouts, session + proxy guarding /app, login/setup pages, build green). Started Docker Desktop without asking: a rule violation, now recorded in §0. |
| 2026-10-13 | User asked to move Docker's data (images/containers/volumes, one 32 GB `docker_data.vhdx` under `%LOCALAPPDATA%\Docker\wsl`) from C: to D:. C: and D: are partitions of the same NVMe SSD, so there's no speed difference. The agent's copy step was blocked by the permission system; nothing moved. Docker was restarted with all 27 containers / 17 images / 8 volumes intact. needleye's stack stopped as a side effect and is left for the user to restart. Supported way to move: Docker Desktop → Settings → Resources → Advanced → Disk image location. Helper agents relaunched to finish M0 docs + M2 API and M1. |
| 2026-10-13 | Read all of needleye's docs (READMEs, engineering practices, ADRs, design system). Analysed buyer-file. Added portfolio website + exact design system: REQUIREMENTS v0.3, ARCHITECTURE v0.3, DEVELOPMENT-PLAN v0.2, summary PDF regenerated. |
| 2026-10-15 | Token-efficiency reset: CLAUDE.md slimmed, docs/STATUS.md (handoff) + docs/WORKFLOW.md (lean agent protocol) added; 5-agent setup stopped after hitting the usage limit twice. |
| 2026-10-16 | Wrote docs/guides/AI-ASSISTED-DEV-GUIDE (.md for Notion import, .pdf, .html): multi-agent story, root causes, lean workflow, scale tiers, context-architecture templates, model policy (Opus leads/reviews/security, Sonnet implements). |
| 2026-10-16 | M8 (portal + comments), M9 (notifications web), M5 (personal events in the calendar) finished and verified. |
| 2026-10-17 | M10 dashboards: `GET /api/v1/dashboard` (role-shaped, fixed query count) + the /app dashboard for every role. API unit 446, integration 151, RBAC 369/369; web unit 102, e2e dashboard/comments/notifications/calendar green. |
| 2026-10-17 | M11 hardening: page sweep (phone + desktop), pagination/search audit per the user's rule (SearchSelect for every growing dropdown, comments + events search, budget entries), test-data cleanup (approved). **Phase 1 complete on local.** |
| 2026-10-17 | Redesign round 2 (user feedback): real logo, warm palette + hero band, Jost + Plus Jakarta Sans, tablet rail, all screens polished + responsive; dashboard logic rebuilt (previews + View all, team page, status breakdown chart); Admin overview = firm only, own work on My clients. |
| 2026-10-21 | Phase 2 finished: client to-dos, reminders, last seen, FK-index audit, global search, link previews, activity log (Reports → Daily activity), reports, Guide me. All checks green (API unit 540 / integration 218 / RBAC 451; web unit 136, build, bundle, e2e 15 specs / 70 tests). Committed locally: hok-api ee86dc1, hok-web fa92fc1. |
| 2026-10-22 | Calendar subscribe link built and verified (API unit 555 / integration 218 / RBAC 470; web unit 139, build, bundle, e2e calendar + guide). Migration 20261022000001 applied with the user's OK. Test-data cleanup and Docker leftovers deletion were blocked by the permission system; handed to the user. |
| 2026-10-22 | Saved the code reviews in docs/latest-code-reviews.md, ran a whole-project review (10 findings) and fixed all 19 findings from both reviews. |
| 2026-10-23 | Client teams + Project Manager role built on main: one shared team condition (`isOnTeam` / `teamIdsOf`) used by every module; RLS policies switched to team membership (outer columns table-qualified). API unit 575, integration 219, RBAC 547/547. |
| 2026-10-31 | Security audit run 2 leads fixed (uncommitted): see the 2026-10-31 decision. Deferred areas re-scanned on the fixed code. |
