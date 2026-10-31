# HOK: status snapshot (handoff)

> Updated 2026-10-22. **No agents running.** Resume from here.

## Where we are
- **Phase 1 (M0–M11), the redesign and Phase 2 are done, verified and committed locally** (Phase 2: hok-api ee86dc1, hok-web fa92fc1, 2026-10-21). Nothing is pushed.
- Commits: hok-api 8e1b23a, hok-web 6a68be2 (M5/M8/M9/M10). **M11 work is uncommitted** until the user says yes. Nothing is pushed.
- Gates (2026-10-17): API lint/tsc clean, unit 446, integration 155, RBAC 369/369. Web lint/tsc clean, unit 103, build ok, all 23 app pages within the bundle budget. e2e: all 10 specs (59 tests) green; affected specs re-run after the picker change.

## M11 (hardening) done
- Every page swept at 375px and 1440px: one overflow (client workspace tabs on phones) fixed; no console errors.
- **Pagination / search audit (user rule):** every API list is paged, capped and in the query-budget test (comments search + notifications added). All ~12 "load 100 then filter" dropdowns replaced by `components/ui/SearchSelect.tsx` (server search, ≤ 20 rows, debounced); people pickers use `/team-members`. New debounced search on the comments inbox (API `search` on comment text or client name) and the client Events tab.
- Test data: leftover RBAC / IT / E2E rows deleted from the local DB with the user's OK; reusable script `hok-api/tests/cleanup-test-data.sql` (ask before each run). Integration tests clean up after themselves; the RBAC script and e2e specs do not (no delete API).

## Done since the earlier commit
- **M8:** `client-comments` module, public portal API (token hash only, uniform 404, 4 kb body limit, rate limits), archive revokes the link, `/p/[token]` page (dashboard, stage track, calendar, comments), staff inbox `/app/comments` + sidebar badge, Portal tab in the client workspace.
- **M9:** all 5 triggers live, bell (header on mobile, top bar on desktop), `/app/notifications`, mutes in My profile.
- **M5:** personal events in the calendar.
- **M10:** `GET /api/v1/dashboard` (`hok-api/src/modules/dashboard`, role-shaped: tasks for all, own clients for Admin/SMM/MM, firm for Admin; fixed query count 3/7/12 + auth, query-budget test), `src/domain/zoned-day.ts` (viewer's "today", DST-safe), web dashboard `hok-web/modules/dashboard` (Sonnet helper; reviewed).
- e2e fixes: comments spec API default port 4102 → 4100; calendar spec now uses a random 2027 day (client events can't be deleted, so old runs crowded 20 Nov).

## Redesign done and committed (2026-10-17): hok-api 5d3a794, hok-web 9c6c65c (local, not pushed)
User feedback round 2 addressed: real HOK logo (public/brand), warm premium palette + ink hero band, Jost + Plus Jakarta Sans, tablet icon rail, every screen polished and overflow-free at 375/768/1024; dashboard rebuilt (role views, 5-row previews + "View all", status breakdown chart validated for colour-blind readers, /app/team with server search/paging, Admin overview = firm only, admin's own work on /app/my-clients via `?view=mine`).
- API: `GET /dashboard?view=overview|mine`, `GET /dashboard/team`, new counts; task-status notifications say "In progress" not `in_progress`.
- Checks (2026-10-17): API lint/tsc clean, unit 451, integration 162, RBAC 376/376. Web lint/tsc clean, unit 106, build ok, all 25 app pages within the bundle budget, e2e all 10 specs / 61 tests green.
- Rules for future screens: `hok-web/docs/design-system.md`.

## Phase 2 done and committed (2026-10-21): hok-api ee86dc1, hok-web fa92fc1 (local, not pushed)
- Done: client to-dos (helper), reminders (2 h, every 10 min, bell swing) + last seen (min/hours/days/weeks, 45-day rule), FK-index audit (every link indexed + schema test), global search (`GET /search`, Ctrl+K palette), link previews (SSRF-guarded server fetch, YouTube oEmbed, thumbnails on the asset list), activity log (helper, `GET /activity`, shown as Reports → Daily activity; old /app/activity redirects there), reports (helper, `GET /reports/team-status|staff|client`, /app/reports), **Guide me** (modules/guide, button in the top bar, page-topic pre-search, role-aware).
- Checks (2026-10-21): API lint/tsc clean, unit 540, integration 218, RBAC 451/451. Web lint/tsc clean, unit 136, build ok, bundle budget ok, e2e all 15 specs / 70 tests green (run one spec at a time).
- Migrations applied (with the user's OK): 20261017000001 (FK indexes), …000002 (reminders + last seen), …000003 (client to-dos), 20261021000001 (search / activity / reports indexes + asset preview fields).
- Skills: ponytail (+review/audit/debt/gain/help) installed in .claude/skills (2026-10-21); working in ponytail full mode within hok-practices.

## Google Calendar subscribe link (2026-10-22): committed hok-api 58e2485, hok-web ba665ca (local, not pushed)
- FR-CAL-08 brought back by the user. API: `GET|POST|DELETE /calendar/feed-link` (own link, `events:read`), public `GET /calendar-feed/<token>.ics` (hash-only, rate-limited, redacted from logs, uniform 404). Web: "Add to Google Calendar" button + dialog on /app/calendar (link shown once, Google pre-filled subscribe, copy, turn off). Migration 20261022000001 applied with the user's OK.
- Checks (2026-10-22): API lint/tsc clean, unit 555, integration 218, RBAC 470/470. Web lint/tsc clean, unit 139, build ok, bundle ok (27 pages), e2e calendar (3) + guide (2) green; phone/desktop screenshots checked.
- Only works for Google once the API is on a public https address (local copy: the dialog says so).

## Client lists + pickers (2026-10-22/23): committed on main (hok-api 25d6e9d, hok-web f52c272), local only
- Clients: several websites, phones, contact people (mobile / email optional), social accounts (platform drop-down, may repeat). Migration 20261022000002 applied with the user’s OK. Time zone picker searches city / country / offset. Every phone field has a country-code picker. Checks: API unit 565, integration 218, RBAC 471/471; web unit 155, build + bundle ok, e2e 15 specs green.
- **Branch `ui-improved` created in hok-web** (from f52c272) for the Apple-style redesign of the staff app + portal (current colours, better icons). `main` stays untouched; hok-api has no branch (UI only).
- **Client teams + Project Manager role (2026-10-23)** built on main, uncommitted: migration 20261023000001 applied with the user's OK; seed adds kiran.pm@hok.test on Chai Point Cafe's team.

## UI redesign (2026-10-23): committed b1003e3 on `ui-improved`, then main fast-forwarded to it at the user's request (main = redesign now; local only)
- Apple-style foundation + pages: dashboard, clients list + client page, event, tasks, calendar, reports, comments, activity, to-dos, forms, sign-in checked (light, dark, phone, desktop). Remaining polish ideas: users / templates / team lists as tappable rows instead of "Manage" buttons; the client portal not screenshot-checked (needs a portal link = a DB write).
- Also fixed there: a hydration mismatch in `PhoneInput` (country names differ between Node and the browser); main has it through the merge.

## Pre-launch review (2026-10-24): uncommitted, awaiting the user's yes
- Code review items 2–5 fixed, security + production review done; Next 16.2.11 → 16.4.3 (critical RCE advisories), body-parser patched, push endpoints allowlisted, security headers, production env guard, 15s statement timeout. Report: [PRODUCTION-READINESS.md](PRODUCTION-READINESS.md) (~85% ready; before-launch checklist there).
- Gates: API unit 576, integration 220, RBAC 547/547; web unit 155, build + bundle ok; e2e 71/71 (in 3 batches: the full suite needs more than 30 logins per 15 min).
- Review item #1 fixed too (comments and reminders notify only active client managers on the team); zod 3 → 4.6.7, so 0 known vulnerabilities in both apps.
- Graphify (structure-only map) installed as the project skill `.claude/skills/graphify`; map in `graphify-out/` (not in git).

## Security audit run 2 fixes (2026-10-31): uncommitted, awaiting the user's yes
- All 8 run-2 leads + the 2 deferred areas fixed (DECISIONS 2026-10-31). Reports: security-audit/run-2/.
- **Production config before launch:** `INTERNAL_PROXY_SECRET` (same long random value in hok-api AND hok-web, server-only), `TRUST_PROXY` = Railway edge hops (expected 1; verify with the junk-token test in hok-api/.env.example).

## Next actions (in order)
- **Deploy (2026-10-31):** follow [DEPLOY-GUIDE.md](DEPLOY-GUIDE.md): Supabase (new project, Mumbai) + DigitalOcean App Platform (API, /hok-api) + Vercel (web, /hok-web), free addresses first. User wants ONE GitHub repo for both apps (monorepo at HOK root, histories kept); DONE 2026-10-31: run-2 fixes committed (api 0a181f6, web 4aa64a0), monorepo built at HOK root (old .git in .repo-backups/), pushed to public github.com/adityapandey-102/hok main (b78cac6, fast-forward over the template commit). CI workflows still sit in hok-*/.github and do not run from a monorepo yet. Next: DEPLOY-GUIDE Step 0, then Step 2.
0. **Code-review findings:** [latest-code-reviews.md](latest-code-reviews.md). All 19 (10 whole-project + 9 calendar-dialog) fixed on 2026-10-22, committed locally (hok-api 92bdc44, hok-web 9570211). New API setting `PUBLIC_API_URL` (the API's public https address in production).
1. The user asked for the test-data cleanup and the Docker leftovers deletion (2026-10-22), but the permission system blocked both for the agent: the user runs them (commands in the 2026-10-22 reply) or allows them. `cleanup-test-data.sql` now also clears E2E to-dos.
2. Push only when the user asks. Then: production deploy or the portfolio redesign.

## Database (local HOK stack)
All Phase 1 migrations (`20261013000001` … `20261014500001`) and the 4 Phase 2 migrations listed above are applied. M10 added none. (M5, M7 and M8 were applied without approval by an unidentified process after the Docker move; the user decided on 2026-10-16 to keep them.)

## Environment
- Docker runs from `D:\DockerData`. Leftovers the user asked to delete on 2026-10-22 (checked unused: Docker uses D:DockerData, these unchanged since 15 Oct; deletion blocked for the agent, user to run): the old `C:\…\Docker\wsl\disk\docker_data.vhdx` (32 GB), `D:\DockerData\disk\docker_data.EMPTY-created-by-docker.vhdx`, `D:\DockerData\DockerDesktopWSL\`.
- Dev servers: API 4100, web 3400 (`npm run dev` in each). Seed logins `*@hok.test` / `Hok@2026`. The web dev server ran out of memory once with many pages compiled: start it with `NODE_OPTIONS=--max-old-space-size=6144 npm run dev` (dev only; production builds are unaffected). **Cause found 2026-10-17:** a 1.3 GB `.next/dev` cache plus leftover `.next-*` build folders inside the project (the dev server watches them). Rule: delete `.next-web` / `.next-helper` etc. right after each build or bundle check, and clear `.next` if the dev server starts bloating. After the cleanup it sat flat at ~1 GB. **Measured 2026-10-21:** browsing does not leak (40 page loads: memory went down); every file save makes the dev server recompile and keep a little (~20 MB per batch of edits), so hours of heavy editing by the lead + helpers fill it up. Production (`next build` + `next start`) is unaffected: ~100 MB at start, 250-380 MB across 240 page loads, no steady climb. Run the dev server with `NODE_OPTIONS=--max-old-space-size=8192` and restart it after big editing sessions. **Real cause found 2026-10-22:** Next 16 turns on a Turbopack on-disk cache for `next dev` (`.next/dev/cache/turbopack`, grew to 942 MB). With it, the IDLE dev server used 6-7 CPU cores and 2-6 GB until the heap ran out. Turned off in `next.config.ts` (`experimental.turbopackFileSystemCacheForDev: false`) and the cache deleted; confirmed 2026-10-22: idle 0.9 CPU-s per 15 s, no cache folder.

## Agent IDs
None running. Use fresh helpers per docs/WORKFLOW.md.
