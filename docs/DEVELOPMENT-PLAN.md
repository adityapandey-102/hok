# HOK — Development Plan (Phase 1, local machine)

| | |
|---|---|
| **Version** | 0.2 — 2026-10-13 (portfolio milestone added; needleye design system in M0) |
| **Goal** | Phase 1 (MVP) running end-to-end **on this machine**: portfolio website + agency management. Production comes later. |
| **Based on** | [REQUIREMENTS.md](REQUIREMENTS.md) v0.3 · [ARCHITECTURE.md](ARCHITECTURE.md) v0.3 · needleye-pilot (read-only template) · buyer-file (read-only portfolio source) |

---

## How every milestone is built

1. **API first**: new SQL migration → Drizzle schema → domain rules (+ unit tests) → repository → service (RBAC) → routes + DTOs → `openapi.yaml` → integration tests → `rbac-matrix` cases → seed data.
2. **Then web**: `lib/domain` mirror (+ unit tests) → `modules/<feature>/api` → components built from needleye's `components/ui` primitives → thin pages → mobile check at 360 / 768 / 1024 / 1280 px.
3. **Done means** (needleye's definition): works · tests added · lint + typecheck + build + unit + integration green · docs/README/openapi current · logging, errors, security, performance reviewed · migrations + seed updated.
4. **Demo to you** → your OK → local git commit on the milestone branch → merge to `main`.

Git: two local repos (`hok-api`, `hok-web`). Pushing to GitHub (`adityapandey-102`) happens only when you say so.

---

## Milestones

| # | Milestone | What you can do at the end |
|---|---|---|
| **M0** | **Workspace & scaffolding** | `.\start-dev.ps1` starts Supabase (Docker), API and web on this machine. API docs open; the login page shows in needleye's design system. |
| **M1** | **Portfolio website (port as-is)** | The HOK template's 14 pages run inside hok-web at `/`, `/about`, `/services` … looking exactly like the template, with a "Staff login" link. |
| **M2** | **Login, users & roles** | Create the first Admin, log in/out, reset password. Admin creates staff for all 6 roles. Each role sees its own menu. |
| **M3** | **Clients** | Managers create and see only their own clients. Admin sees all and can reassign or archive. Client workspace with tabs. |
| **M4** | **Stage templates & events** | Admin builds templates. Managers create events from a template, move stages, and add client-visible notes. Time zones work. |
| **M5** | **Calendars** | Client calendar, "My calendar" (client events + personal events) and Admin calendar, each in the viewer's time zone. |
| **M6** | **Asset links** | Paste links with type, comment and tags; search and filter; link assets to events. |
| **M7** | **Staff tasks** | Admin assigns tasks (editor tasks get Drive link, reference link and script). Assignees update, comment and close. Kanban + list. |
| **M8** | **Client portal & comments** | Generate, replace or disable a client link. The client sees dashboard, stages and calendar, and posts comments. Managers get an inbox with Received / In Progress / Solved and replies. |
| **M9** | **Notifications (in-app + push)** | Bell icon; installable PWA; push for new client comments, new tasks, task updates and client reassignment. |
| **M10** | **Dashboards** | Role-specific home screens (Admin, managers, task-only staff). |
| **M11** | **Phase 1 hardening** | E2E tests for critical flows, query budget/perf audit, bundle budget, full seed data, docs pass. Phase 1 is done on local. |

Order reasoning: M1 is independent and quick, and it puts the portfolio + app split in place early. Auth and clients come next because everything hangs off them. The portal (M8) needs events (M4) to show. Notifications (M9) come after the features that trigger them, so they can be wired in one pass.

---

## M0 in detail (the next step)

**Workspace (`HOK/`)**
- `start-dev.ps1`, adapted from needleye's: Docker check, pinned Supabase CLI `supabase@2.119.0` (reuses needleye's images, no download), `-Seed`, `-Reset`, LAN-IP sync, and the API + web in their own windows.
- `.claude/skills/hok-practices/SKILL.md` (adapted from needleye-practices) and `frontend-design`.

**hok-api**
- Config copied in shape from needleye-api: `package.json` scripts, `tsconfig`, ESLint flat config, Vitest (unit + integration configs), `tsup`, multi-stage `Dockerfile`, `.env.example`, GitHub Actions `ci.yml`.
- `src/common/`: errors + error-code registry, pino logger + request logger, request context, Drizzle client with slow-query/DB-error logging, `validate` middleware, `asyncHandler`, error middleware, auth-provider interface + Supabase implementation, rate limit, audit logger.
- `src/config/env.ts` (zod), `src/app.ts`, `src/index.ts` (graceful shutdown), `/health` + `/health/ready`, `openapi.yaml` + `/api-docs`.
- `supabase/config.toml` (project `hok`, ports 54421–54429, auth redirect to `:3400`) and the first migration: `profiles` (6 roles + time zone) + `handle_new_user` trigger + grants.
- `CLAUDE.md`, `README.md`, `docs/engineering-practices.md`, `docs/adr/0001…` (decisions inherited from needleye, recorded for HOK).

**hok-web**
- Next.js 16 + React 19 + Tailwind v4 with needleye-web's structure, plus the two root layouts: `app/(site)` (portfolio, empty until M1) and `app/(main)` (`(auth)`, `app/`, `p/[token]`), `app/api/session/*`, `proxy.ts` guarding `/app/*`, `lib/session`, `lib/api`, `lib/domain`.
- **Design system copied exactly from needleye-web:** `globals.css`, fonts via `next/font`, `components/ui/*`, `components/shell/*` (names and brand mark changed to HOK).
- ESLint, Vitest, Playwright config, bundle-budget script, `ci.yml`, `CLAUDE.md` (+ `AGENTS.md` Next.js note), `README.md`, `docs/engineering-practices.md`.

**M0 is done when:** `.\start-dev.ps1` runs clean, `http://localhost:4100/health/ready` returns OK, `http://localhost:4100/api-docs` opens, `http://localhost:3400/login` shows the login page in needleye's design, both repos pass lint + typecheck + unit tests + build, and needleye still runs untouched.

## M1 in detail

- Copy `buyer-file/assets` → `hok-web/public/site/assets` (unchanged).
- `(site)/layout.tsx`: the template's `<head>` stylesheets and `next/script` for jQuery and the plugins, in the template's order.
- Convert the 14 HTML pages to JSX page components; extract the shared header, footer and preloader into `modules/site/components`; rewrite `*.html` links to the new routes; `oops.html` → the site's not-found page.
- Add the "Staff login" link. Check every page at 390 / 768 / 1280 px against the original template side by side.
- buyer-file itself is not modified.

---

## After Phase 1

- **Phase 2** (Phases 2 and 3 merged, 2026-10-17): client to-do lists · reminders (2 h before; in-process runner every 10 min; bell waving animation) · global search · activity log · last seen (on the profile row; 45-day rule) · link previews · reports (needleye-style: team status, staff report, client report, daily activity) · **Guide me** (last: a global, searchable help modal on every page, pre-filled with the page's topic). Google Calendar export is dropped for now; email notifications were dropped earlier (push + bell only).
- **Portfolio redesign**: when the firm's content is ready (Tailwind + design system, real data, no jQuery/Bootstrap, Font Awesome licence resolved).
- **Production setup** (when you decide): hosted Supabase, Railway, Vercel, domains, least-privilege DB role, deploy steps in CI.
