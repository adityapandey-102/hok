# HOK — Architecture & Tooling (Draft for review)

| | |
|---|---|
| **Version** | 0.3 — 2026-10-13 (portfolio site added; needleye design system adopted exactly) |
| **Basis** | Mirrors the **needleye-pilot** project (`D:\Code Space\WorkSpace\needleye-pilot`): same architecture, stack, tooling, dev environment, engineering standards and **design system**. That project is a **read-only reference**: never modify it. |
| **Portfolio source** | `D:\Code Space\WorkSpace\buyer-file` (HTML template), ported into hok-web as the public site (§11b). Read-only source. |
| **Requirements** | [REQUIREMENTS.md](REQUIREMENTS.md) v0.2 |
| **Environment focus** | **Local machine only for now** (Supabase via Docker, exactly like needleye). Production (Railway / Supabase hosted / Vercel) is decided later. |
| **GitHub** | Account `adityapandey-102`, repos `hok-api` and `hok-web` |

---

## 1. System overview

```
 Public visitors (portfolio)   Staff (PWA)   Client (portal link)
            │                      │                 │
            ▼                      ▼                 ▼
 ┌──────────────────────────────────────────────────────────┐
 │  hok-web — Next.js 16 (App Router)  local :3400 / Vercel │
 │  (site) portfolio /  ·  /app staff  ·  /p/[token] portal │
 │  session cookies via same-origin route handlers          │
 │  service worker + manifest (PWA, web push)               │
 └──────────────────────────────┬───────────────────────────┘
                                │ HTTPS + Bearer token (staff) / portal token (client)
                                ▼
 ┌──────────────────────────────────────────────────────────┐
 │  hok-api — Express + TS   local :4100 / Railway (Docker) │
 │  Feature-based modular monolith, 4 layers per module     │
 │  RBAC capability matrix · zod validation · pino logging  │
 │  web-push sender · in-process job runner (reminders)     │
 └───────────────┬─────────────────────────┬────────────────┘
                 │ Drizzle (DATABASE_URL)  │ AuthProvider (supabase-js)
                 ▼                         ▼
 ┌──────────────────────────────────────────────────────────┐
 │  Supabase — Postgres + Auth  (local: Docker via CLI)     │
 └──────────────────────────────────────────────────────────┘
```

**Same rule as needleye:** the web app never talks to Supabase. Everything goes through the API. The two apps are separate repositories that share no code and talk only over HTTP.

---

## 2. Workspace & repositories

```
D:\Code Space\WorkSpace\HOK\        (workspace folder, not a git repo — like needleye-pilot)
├── CLAUDE.md                        project context for the agent (this project's memory)
├── docs\                            requirements, architecture, summary PDF
├── .claude\                         settings + skills (hok-practices, frontend-design)
├── start-dev.ps1                    one-command local launcher (Supabase + API + web)
├── hok-api\                         git repo #1 — backend
└── hok-web\                         git repo #2 — frontend
```

Each repo gets its own `CLAUDE.md`, `README.md` (kept current), `docs/engineering-practices.md`, `docs/adr/`, and GitHub Actions CI, exactly like needleye-api / needleye-web.

---

## 3. Tech stack

### Backend — `hok-api` (same as needleye-api)
| Concern | Choice |
|---|---|
| Runtime | Node.js 22 (`node:22-alpine` Docker image) |
| Framework | Express 4 + TypeScript 5 (strict, `noUncheckedIndexedAccess`), ESM |
| Database access | Drizzle ORM + `pg` against a plain `DATABASE_URL` |
| Migrations | **Hand-written, timestamped SQL files in `supabase/migrations/`**, applied with the **pinned** Supabase CLI (`migration up` / `db reset`), the same as needleye in practice. Each module's Drizzle `infrastructure/*.schema.ts` mirrors its tables for typed queries; `drizzle-kit` is configured but not used to generate migrations. Never edit an applied migration; add a new file. |
| Auth | Supabase Auth behind an `AuthProvider` interface (`SupabaseAuthProvider` is the only file importing `@supabase/supabase-js`) |
| Validation | zod DTOs + `validateBody` middleware |
| Errors | Typed `AppError` subclasses + stable error-code registry + single error middleware |
| Logging | pino / pino-http, request IDs, AsyncLocalStorage request context, slow-query + DB-error logging, header redaction |
| Security | helmet, exact-origin CORS, express-rate-limit (auth + public portal), least-privilege DB role in prod |
| API docs | `openapi.yaml` + Swagger UI at `/api-docs` |
| Build | tsup → `dist/`, multi-stage Dockerfile, non-root user |
| Tests | Vitest (unit + integration against local Supabase), `tests/rbac-matrix.mjs`, query budget + perf audit scripts |
| Lint | ESLint 9 flat config + typescript-eslint (type-aware) |
| **New for HOK** | `web-push` (VAPID push sending) · `@date-fns/tz` + `date-fns` (time-zone maths) |

### Frontend — `hok-web` (same as needleye-web)
| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Design system | **needleye-web's design system, copied exactly**: `globals.css` tokens (palette, radii, shadows, gradients), Playfair Display + Plus Jakarta Sans via `next/font`, the motion system (`stagger-in`, `rise`, `skeleton`, reduced-motion guard), `.page-title` / `.stitch-rule` / `.figure` / hero band, `components/ui/*` and `components/shell/*`, plus its responsive rules (sidebar drawer below `xl`, cards below `lg`, no sideways scroll). Only names and the brand mark change. A palette retune later is a one-file change (`globals.css`). |
| Styling | Tailwind CSS v4, design tokens in `app/globals.css` (`@theme inline`) |
| Icons | lucide-react via a single `Icon` wrapper (tree-shaken) |
| Validation | zod (own copy of domain rules in `lib/domain/`) |
| Data | Plain typed `apiFetch` wrappers per module (`modules/*/api/*.ts`) — no extra state/data library |
| Drag & drop | @dnd-kit/core (Kanban for staff tasks) |
| Tests | Vitest (unit on `lib/domain`), Playwright (critical flows only) |
| Performance | Bundle budget script (≤ 300 KB first-load JS per page) |
| **New for HOK** | PWA: `app/manifest.ts` + `public/sw.js` service worker (push + notification click) · `@date-fns/tz` |

### Environments
**Now — local machine (same as needleye):**

| Piece | Local |
|---|---|
| Database + Auth | Supabase CLI stack in Docker (Postgres 17, GoTrue, Studio, local mail catcher). CLI version **pinned to the same version needleye uses** (`supabase@2.119.0`), so the Docker images already on disk are reused and nothing is downloaded again |
| hok-api | `npm run dev` (tsx watch) on **http://localhost:4100** |
| hok-web | `npm run dev` on **http://localhost:3400** |
| Launcher | `HOK\start-dev.ps1` starts Supabase, applies migrations, optional `-Seed` / `-Reset`, and opens the API + web windows |

**Ports are offset from needleye** so both projects can run at the same time on this machine without clashing:

| Service | needleye | **HOK** |
|---|---|---|
| Supabase API (Kong) | 54321 | **54421** |
| Postgres | 54322 | **54422** |
| Shadow DB | 54320 | **54420** |
| Studio | 54323 | **54423** |
| Mail catcher (Inbucket/Mailpit) | 54324 | **54424** |
| Pooler | 54329 | **54429** |
| API | 4000 | **4100** |
| Web | 3000 | **3400** |

**Later — production (to be decided after Phase 1 runs locally):** Railway (API, Docker image), hosted Supabase (DB + auth), Vercel (web).

---

## 4. Backend architecture (copied from needleye-api)

Feature-based modular monolith. Every module has the same four layers, dependencies pointing inward:

```
src/modules/<name>/
  api/             *.routes.ts (controller + composition root), dto/, *.presenter.ts
  application/     *.service.ts (use cases, RBAC checks), ports/*.port.ts (repository interfaces)
  domain/          *.entity.ts, *.rules.ts (pure business rules + unit tests)
  infrastructure/  drizzle-*.repository.ts, *.schema.ts (module owns its tables), *.mapper.ts
src/common/        auth, audit, context, database, errors, http, logger, middleware, time
src/domain/        roles.ts, capabilities.ts (RBAC matrix), shared vocabulary
src/config/env.ts  zod-validated environment
```

### HOK modules
| Module | Responsibility | Phase |
|---|---|---|
| `auth` | login, refresh, logout, password reset, first-admin bootstrap | 1 |
| `users` | admin-managed staff accounts, roles, profile (incl. time zone) | 1 |
| `clients` | client profiles, ownership, reassignment, archive | 1 |
| `stage-templates` | admin CRUD of templates + ordered stages | 1 |
| `events` | client events, stage snapshot from template, stage moves + history | 1 |
| `calendar` | personal events + calendar feed endpoints (client / personal / admin ranges) | 1 |
| `assets` | link library, tags, search | 1 |
| `portal` | portal link generate/regenerate/disable (staff side) + public read endpoints | 1 |
| `client-comments` | public comment posting, staff inbox, status + replies | 1 |
| `staff-tasks` | admin-assigned tasks, updates timeline, editor fields, Kanban | 1 |
| `notifications` | in-app notifications, push subscriptions, push delivery | 1 |
| `dashboard` | per-role dashboard: SQL aggregates + capped lists, a fixed query count per role (no table of its own) | 1 |
| `client-tasks` | per-client to-dos | 2 |
| `jobs` | reminders runner (events, due dates) | 2 |
| `search`, activity log | global search, admin activity view | 2 |

**Decision:** client tasks and staff tasks are **two separate modules**. They have different owners, permissions and fields, so keeping them apart keeps the RBAC rules simple.

---

## 5. RBAC

Same pattern as needleye: `profiles.role` is the source of truth, a flat **capability matrix** in `src/domain/capabilities.ts` (mirrored in `hok-web/lib/domain`), `requireCapability()` on routes, and row scoping inside repositories.

- Roles: `admin`, `social_media_manager`, `marketing_manager`, `marketing_agent`, `developer`, `editor`.
- Scope values: `true` (all rows) · `"own"` (rows where `owner_id = me`, or `assignee_id = me` for tasks) · `false`.
- Example capabilities: `users:manage`, `stage_templates:manage`, `clients:read|write|reassign`, `events:read|write`, `assets:read|write`, `portal:manage`, `comments:read|manage`, `personal_events:manage`, `staff_tasks:assign`, `staff_tasks:read|update`, `dashboard:global`.
- Every new endpoint gets a row in `tests/rbac-matrix.mjs` (200/403 per role).

---

## 6. Data model (first cut)

All instants are `timestamptz` (UTC). Time-zone columns hold IANA names (e.g. `Asia/Kolkata`, `Europe/London`).

| Table | Key columns |
|---|---|
| `profiles` | id (= auth user id), full_name, email, role, time_zone, phone, avatar_url, is_active |
| `clients` | id, owner_id → profiles, business_name, logo_url, industry, contact fields, social_handles (jsonb), services, contract_start/end, time_zone, notes, status, archived_at |
| `stage_templates` | id, name, is_active, created_by |
| `stage_template_stages` | id, template_id, position, name |
| `events` | id, client_id, title, type, starts_at, ends_at, time_zone, location, description, template_id, current_stage_id, state (active/cancelled/postponed), version |
| `event_stages` | id, event_id, position, name — **copied from the template at creation** (so later template edits never change existing events) |
| `event_stage_history` | id, event_id, from_stage_id, to_stage_id, note, visible_to_client, changed_by, created_at (append-only) |
| `assets` | id, client_id, event_id?, title, url, type, comment, created_by, deleted_at |
| `tags`, `asset_tags` | tag name per client scope; many-to-many |
| `personal_events` | id, owner_id, client_id?, title, starts_at, ends_at, time_zone, description |
| `portal_links` | id, client_id, token_hash (sha-256), is_active, created_by, created_at, revoked_at |
| `client_comments` | id, client_id, event_id?, body, status, reply, replied_by, created_at |
| `client_comment_history` | id, comment_id, from_status, to_status, changed_by, created_at |
| `staff_tasks` | id, title, description, assignee_id, assigned_by, client_id?, event_id?, due_at, priority, status, raw_files_url, reference_url, script, reference_links (jsonb), version |
| `staff_task_updates` | id, task_id, author_id, from_status?, to_status?, comment, created_at (append-only) |
| `notifications` | id, user_id, type, payload (jsonb), read_at, created_at |
| `push_subscriptions` | id, user_id, endpoint (unique), p256dh, auth, user_agent, created_at, last_used_at |
| `audit_log` | as needleye (sign-ins, account events) |

Indexes follow needleye's rules: every filter/sort/join column indexed, partial indexes on live sets (e.g. open tasks, active events), trigram index for search on large tables.

---

## 7. Client portal (public, no login)

- **Link**: `https://<web>/p/<token>`; token = 32 random bytes, base64url. The DB stores only its **SHA-256 hash**, so a database leak does not reveal working links. Regenerate = new token + old row revoked; disable = `is_active=false`.
- **API**: `/api/v1/portal/:token/...` mounted *before* the global JSON parser with a small body limit (needleye's public-enquiry pattern), per-IP and global rate limits, constant-time token lookup by hash.
- **Exposure**: dedicated portal presenters return only client-safe fields (event title, dates, stages, current stage, client-visible notes, own comments). Never assets, internal notes, tasks, or staff details.
- **Comments**: size-limited body, rate-limited; on insert, a notification + push to the owning manager is sent **after commit**.
- Optional later hardening (not v1): Cloudflare Turnstile, as needleye already supports for its public form.

---

## 8. Notifications & web push

- **In-app**: `notifications` table written in the same transaction as the triggering change; bell icon polls a lightweight unread-count endpoint (no WebSocket server needed at this scale).
- **Push**: standard Web Push with VAPID keys (`web-push` npm). The browser subscribes through the service worker and the subscription is saved via `POST /notifications/push-subscriptions`. Sending happens **after commit** and is best-effort: failures are logged, and `404/410 Gone` responses delete the dead subscription.
- **PWA**: `app/manifest.ts`, icons, `public/sw.js` (handles `push` + `notificationclick` → opens the relevant page). On iPhone, push works only after "Add to Home Screen" (iOS 16.4+). The app shows an install hint there.

---

## 9. Scheduled jobs (Phase 2 reminders)

needleye uses `pg_cron` for a database-only nightly job. HOK reminders must send pushes over HTTP, so `pg_cron` alone does not fit. **Decided (2026-10-17):** an in-process job runner inside hok-api that wakes **every 10 minutes** and claims due reminders (stored when an event or due date is set: one per event 2 h before start, one per task 2 h before due) with `SELECT … FOR UPDATE SKIP LOCKED LIMIT 50`, marking them sent in the same transaction, so it stays safe if Railway ever runs more than one instance. Reminders whose moment has passed (the event already started) are skipped, not sent late. Partial index on unsent reminders by due time keeps each check a tiny index scan. No Redis or queue (same "keep it simple" rule as needleye). Cost on Railway: negligible (one small query per 10 min inside the always-on API).

---

## 10. Time zones

- Store instants in UTC (`timestamptz`) plus the IANA zone the event was planned in.
- Each **user** has a profile time zone, each **client** has one, and each **event** has one (where it happens).
- Staff UI shows the viewer's zone. Event detail also shows the event's local time when it differs. The portal shows the client's zone.
- Calendar range queries take `from`/`to` instants computed from the viewer's zone.
- Conversion via `@date-fns/tz` on both sides; unit-tested around DST changes.

---

## 11. Frontend structure (copied from needleye-web, plus the portfolio)

**One website = public portfolio + agency management.** hok-web serves the firm's public portfolio at the root URL and the staff app, login and client portal beside it. There's a precedent: needleye-web also hosts a public marketing page (`/enquiry`) next to its staff app.

### URL map
| Area | URLs | Root layout |
|---|---|---|
| **Portfolio** (public) | `/`, `/about`, `/services`, `/services/details`, `/case-studies`, `/case-studies/details`, `/team`, `/team/details`, `/blog`, `/blog/list`, `/blog/details`, `/pricing`, `/faq`, `/contact` | `(site)`: template CSS/JS |
| Staff sign-in | `/login`, `/reset-password`, `/update-password`, `/auth/callback`, `/setup` (first-admin bootstrap) | `(main)`: needleye design system |
| **Staff app** | `/app/...`: dashboard, clients, events, calendar, assets, tasks, comments, admin | `(main)` + sidebar shell |
| **Client portal** | `/p/[token]` | `(main)` with plain portal chrome |

The portfolio owns `/`, so `proxy.ts` **protects only `/app/*`**. This is the inverse of needleye, which protects everything except a list of public paths. Logged-in users who open `/login` are sent to `/app`.

### Folder layout
```
app/
  (site)/            ROOT LAYOUT #1: portfolio. Loads the template's Bootstrap/CSS + jQuery plugins
    layout.tsx         <html> with template stylesheets + next/script for the plugins
    page.tsx, about/, services/, case-studies/, team/, blog/, pricing/, faq/, contact/
  (main)/            ROOT LAYOUT #2: needleye design system (globals.css, fonts, Toast/Confirm providers)
    layout.tsx
    (auth)/          login, reset/update password, setup: no sidebar
    app/             staff app behind auth: sidebar shell (AppShell)
    p/[token]/       client portal: public, plain
  api/session/*      route handlers owning session cookies (access readable, refresh httpOnly)
  manifest.ts        PWA manifest
proxy.ts             session refresh + guards /app/* (Next 16 replacement for middleware.ts)
modules/<feature>/   components/ + api/<feature>Api.ts (one per module; components never call apiFetch directly)
modules/site/        portfolio: SiteHeader, SiteFooter, Preloader, page sections
components/ui/       needleye's primitives: Button, Card, Field, Modal, ConfirmDialog, Toast, Pager, StatusPill, Select, RadioGroup, Icon, ProgressRing, CountUp, Portal
components/shell/    AppShell, Sidebar, BrandMark, nav-config (role-based nav)
lib/domain/          own copy of roles, capabilities, statuses, zod validation + unit tests
lib/session/, lib/api/   same session + fetch helpers as needleye-web
public/site/assets/  the template's css / js / img / webfonts, copied unchanged
public/sw.js         service worker
```

**Why two root layouts:** Bootstrap's global CSS and Tailwind's preflight would fight if loaded together. Next.js lets each route group have its own `<html>` root layout, and navigating between different root layouts is a full page load. So the portfolio never loads Tailwind, and the app never loads Bootstrap. Once the portfolio is redesigned in Tailwind (below), `(site)` can move under the main layout and the split goes away.

Rules carried over: thin pages, server-side pagination with the shared `Pager`, debounced search, loading/empty/error states with retry, mobile-first layouts with no sideways scroll at 360/768/1024/1280 px.

### 11b. Portfolio website: port now, redesign later
- **Source:** `D:\Code Space\WorkSpace\buyer-file`, the HOK digital-agency HTML template: 14 static pages, Bootstrap 5.2, jQuery + Swiper, AOS, Magnific Popup, Nice Select, CounterUp, Waypoints, Vanilla Tilt, SCSS, Font Awesome 6. Treated as a **read-only source**: files are copied out, never edited in place.
- **Now (port as-is):** each HTML page becomes a page component (JSX) under `(site)`. The repeated header, footer and preloader are extracted into `modules/site/components`. Assets are copied unchanged to `public/site/assets`. Template text and images stay as they are. Links inside the portfolio stay plain `<a>` tags (full page loads), so the template's jQuery plugins initialise on every page. The portfolio is a documented exception to the 300 KB bundle budget until the redesign.
- **Later (separate phase, with the firm's real data):** rebuild the portfolio the needleye way: Tailwind with a site theme section in `globals.css` (like needleye's `.lux` enquiry page), words in `modules/site/content/hok.ts`, Lucide icons, no jQuery or Bootstrap. The contact form could then feed the agency app.
- **Licence check:** the template ships **Font Awesome 6 Pro** (commercial licence) and demo stock images. Before the site goes public, confirm the firm owns a Font Awesome Pro licence or swap to free icons, and replace the demo images.

---

## 12. Dev environment & quality gates (copied from needleye)

- **Local**: Docker Desktop + Supabase CLI (version **pinned**, unused containers excluded). `start-dev.ps1` brings up Supabase, applies migrations, optionally seeds, and opens API (`:4100`) and web (`:3400`) windows. `npm run dev:up` in hok-api does the backend-only bring-up.
- **Seed data**: realistic demo clients, templates, events, tasks and comments for every role.
- **CI (GitHub Actions)**:
  - API: install → lint → typecheck → unit tests → build → Docker build; plus an integration job against a local Supabase stack.
  - Web: install → lint → typecheck → unit tests → build.
- **Definition of done** (needleye's): works, tests added, docs current, logging/errors/security/performance reviewed, migrations + seed updated, build/typecheck/lint/CI green.
- **Claude Code setup**: workspace `.claude/skills/hok-practices` (adapted from needleye-practices) + `frontend-design`; a `CLAUDE.md` per repo.

---

## 13. Environment variables (planned)

**hok-api**: `NODE_ENV`, `API_PORT`, `CORS_ALLOWED_ORIGIN`, `WEB_APP_URL`, `LOG_LEVEL`, `SLOW_QUERY_MS`, `DB_POOL_MAX`, `TRUST_PROXY`, `AUTH_RATE_LIMIT_*`, `PORTAL_RATE_LIMIT_*`, `DEFAULT_TIMEZONE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

**hok-web**: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_WEB_APP_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

---

## 14. Deliberately not doing (same "keep it simple" charter)

No microservices, Kubernetes, Redis, message queues, CQRS/event sourcing, distributed tracing, complex caching, multi-region, WebSocket server, or file storage (assets are links). Revisit only if a real requirement appears.

---

## 15. Differences from needleye (summary)

| Area | needleye | HOK |
|---|---|---|
| File storage | Supabase Storage (order images) | **None**: links only, so no `StorageProvider` in v1 |
| Public surface | Public enquiry page (`/enquiry`) | **Portfolio website at `/`** (ported template, own root layout) + **client portal** (token links) + comment posting |
| Design system | needleye's own | **The same, copied exactly** (staff app + portal) |
| Route guard | everything protected except listed public paths | only `/app/*` protected (the portfolio is the default) |
| Notifications | none | **In-app + Web Push (PWA)** |
| Scheduling | `pg_cron` nightly DB job | In-process job runner (Phase 2 reminders) |
| Time | single business time zone | **Multiple time zones** (user / client / event) |
| QR login | yes | not needed |

---

## 16. Deferred until production is planned

1. Hosted Supabase project and its region.
2. Railway + Vercel projects, domain names, production env vars, least-privilege DB role, deploy steps in CI.
