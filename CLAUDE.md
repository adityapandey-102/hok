# CLAUDE.md — HOK Project Context

> Agent context file. Read this first in every session.
> **Keep it current:** whenever a decision is made, a phase changes, or a requirement is updated, update the relevant section below and add an entry to the Decision Log / Changelog. After any requirement change, also update and regenerate the summary PDF (see §1).

## 0. Agent working rules (the user's standing rules, carried over from needleye — READ FIRST)

These apply to every session and every helper agent, without exception:

1. **Ask before ANY action outside the HOK project folders.** That includes starting or stopping apps (Docker Desktop and others), starting, stopping or resetting Docker containers (including HOK's own Supabase stack: `supabase start/stop/db reset`), killing or controlling processes that aren't a dev server you started in this session, changing credentials or passwords, and writing to any database outside a test's own fixtures. Reading is fine. *Why:* in needleye on 2026-09-02, and again in HOK on 2026-10-13, the agent started Docker Desktop without asking. The user objected both times.
2. **Never touch other projects** in `D:\Code Space\WorkSpace` (needleye-pilot, buyer-file, delight-caters, genERP1, …). They are read-only references at most. Their running servers, ports and containers are off-limits. (delight-caters' web app uses port 3100, which is why HOK's web app is on 3400.)
3. **Git: get an explicit "yes" immediately before every `git commit` and every `git push`**, separately each time, even if the user agreed earlier. Show what will be committed or pushed first. **Never add a `Co-Authored-By: Claude` trailer** to commits (the user objected to it in needleye).
4. **Production:** never touch it (no hosted Supabase, Railway or Vercel actions, no `db push`) unless the user asks for that specific action.
5. **Allowed without asking:** editing files inside `HOK/`; running `npm install`/`lint`/`typecheck`/`test`/`build`/`seed` inside `hok-api`/`hok-web` against the already-running local stack; starting and stopping the `npm run dev` servers you started yourself; restarting the local API (touch `src/index.ts`) to clear the login rate limit during testing.
6. **Report faithfully.** If something fails or a step was skipped, say so.

**Skill:** `.claude/skills/hok-practices/SKILL.md` holds HOK's engineering and performance rules plus the pre-release checklist. Use it for any API, query, migration, list or page work.

## 1. Project Summary

**HOK** is **one website = public portfolio + agency management** for a **marketing firm** that grows its clients' businesses through marketing services. The public portfolio is served at `/` (ported from the `buyer-file` HTML template now, redesigned with real data later). The staff app lives at `/app` and the client portal at `/p/[token]`.

Core capabilities of the agency-management side:
- **Client portfolio management**: HOK owns every client; the Admin gives each one a **team** of client managers, one of them the **lead** (2026-10-23). Managers see only clients whose team they're on; Admin sees all.
- **Stage templates** (Admin-made) → **client events** (e.g. social media shoots) whose stages are shown to the client.
- **Client-specific tasks** (internal to-dos per client, Phase 2).
- **Asset link library**: paste links (Drive/Dropbox/etc.) with comment + tags. No file uploads; internal only.
- **Calendars**: per-client, personal per manager (client events + own events), global for Admin. Supports multiple time zones.
- **Client portal**: shareable generated link (link only, revocable). The client sees their dashboard, current event stage and upcoming events, and can post comments. Plain design.
- **Client comments**: push notification to the client's team; status Received → In Progress → Solved.
- **Staff tasks**: only Admin assigns, one assignee, and the assignee can mark Done. Editor tasks also have a raw-files Drive link, a reference edit link and a script.
- **Role dashboards**, **web push (PWA)** and **in-app notifications**.

Docs:
- Full spec: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) (v0.3)
- Architecture & tooling: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (v0.3, local-first, portfolio + design system)
- Development plan: [docs/DEVELOPMENT-PLAN.md](docs/DEVELOPMENT-PLAN.md) (Phase 1 milestones M0–M11)
- Plain-language summary for the user: [docs/HOK-Requirements-Summary.pdf](docs/HOK-Requirements-Summary.pdf), generated from [docs/HOK-Requirements-Summary.html](docs/HOK-Requirements-Summary.html). No Python on this machine, so regenerate with headless Chrome:
  `"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --no-pdf-header-footer --print-to-pdf="D:/Code Space/WorkSpace/HOK/docs/HOK-Requirements-Summary.pdf" "file:///D:/Code%20Space/WorkSpace/HOK/docs/HOK-Requirements-Summary.html"`. Then check the page breaks by reading the PDF.

## 2. Reference sources (READ-ONLY)

**Portfolio source:** `D:\Code Space\WorkSpace\buyer-file` is the HOK digital-agency HTML template: 14 pages, Bootstrap 5.2 + jQuery plugins + SCSS + Font Awesome 6 **Pro**, with git remote `adityapandey-102/hok`. Copy files out of it into `hok-web` and never edit it in place. See ARCHITECTURE §11b.

**Engineering template:** `D:\Code Space\WorkSpace\needleye-pilot` (needleye-api + needleye-web) is the **template for architecture, stack, tooling, dev environment, engineering standards and the design system**. The staff app and portal started from needleye-web's design system (`app/globals.css`, next/font Playfair Display + Plus Jakarta Sans, `components/ui/*`, `components/shell/*`) and were redesigned Apple-style on 2026-10-23 (same colours; Phosphor icons, grouped sections, segmented controls, phone tab bar). `hok-web/docs/design-system.md` is now the rule book; don't revert to needleye's look. Read it when you need a pattern, but **never modify anything there**. Its key docs are `needleye-api/README.md` (Architecture, Infrastructure & providers, Error handling, Logging, Security, RBAC), `needleye-api/CLAUDE.md` + `needleye-web/CLAUDE.md` (engineering charter, testing pyramid, definition of done), `*/docs/engineering-practices.md`, `needleye-api/docs/adr/`, `.claude/skills/needleye-practices/SKILL.md` and `start-dev.ps1`.

## 3. Roles (quick reference)

| Role | Access |
|---|---|
| Admin | Everything, all data. Manages users, stage templates and client teams. Only role that assigns staff tasks, archives clients and sets teams. Can be on a client team like an SMM |
| Social Media Manager | Clients whose team they're on: events, assets, calendars, portal, comments, to-dos. Receives staff tasks |
| Marketing Manager | Same as SMM |
| Project Manager | Same as SMM (added 2026-10-23) |
| Marketing Agent | **Staff tasks only** |
| Developer | Staff tasks only |
| Editor | Staff tasks only (editor tasks carry raw files link, reference link, script) |
| Content Writer | Staff tasks only (writing tasks: description and reference links; added 2026-11-01) |
| Client (external) | Portal via generated link, no account |

## 4. Current status

**Read [docs/STATUS.md](docs/STATUS.md)**: the one handoff file with milestone states, DB state and next actions. Decisions and history: [docs/DECISIONS.md](docs/DECISIONS.md). How to work (lean, token-efficient): [docs/WORKFLOW.md](docs/WORKFLOW.md).

## 5. Architecture & Tech Stack (summary — details in docs/ARCHITECTURE.md)

- **hok-api**: Node 22, Express 4 + TS, feature-based modular monolith (api / application / domain / infrastructure per module), Drizzle + pg, Supabase Auth behind `AuthProvider`, zod, pino, helmet, rate limits, OpenAPI + Swagger, Vitest, Docker → Railway. New: `web-push`, `@date-fns/tz`.
- **hok-web**: Next.js 16 App Router, React 19, Tailwind v4, icons (staff app: Phosphor shapes generated into `components/ui/iconPaths.ts`; public site: lucide-react), zod, @dnd-kit, Vitest + Playwright, PWA (manifest + service worker). Never calls Supabase directly. Session cookies via route handlers.
- Public client portal at `/p/[token]`; the token is stored as a SHA-256 hash.
- Reminders (Phase 2): in-process job runner with `FOR UPDATE SKIP LOCKED`, no Redis or queues.

## 6. Repo Structure & Conventions

Planned layout: see docs/ARCHITECTURE.md §2, §4 and §11. Conventions follow needleye's CLAUDE.md files: keep it simple (no microservices, Redis, queues), use the testing pyramid, an RBAC matrix test for every endpoint, paginated lists, no N+1 queries, and a definition of done that includes docs, tests and CI.
