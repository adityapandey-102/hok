# HOK API

Express + TypeScript backend for **HOK**, a marketing firm's
agency-management platform: staff accounts and roles, client portfolios
owned by managers, stage templates and client events, calendars across time
zones, an asset link library, a client portal, client comments and staff
tasks. Developed and deployed independently from
[hok-web](../hok-web) (the Next.js portfolio site + staff app + client
portal) -- **the two repos share no code and have no dependency on each
other; they only talk over HTTP**, each versioned on its own schedule.

Built on the architecture, conventions and tooling of `needleye-api`
(read-only reference in `../../needleye-pilot`). Engineering charter:
[`CLAUDE.md`](CLAUDE.md). Rules and reasons: [`docs/engineering-practices.md`](docs/engineering-practices.md).
Decisions: [`docs/adr/`](docs/adr).

> **Maintainers: keep this file current.** Whenever a change touches
> architecture, schema, RBAC, ports, env vars, routes or the dev workflow,
> update the relevant section here in the same change.

**Status (2026-10-13):** M0 (foundation), the API side of M2 (login,
users & roles), of M3 (clients: ownership, row scope, archive, reassign)
and of M4 (stage templates; events with copied stages, stage moves + history,
calendar range query) are in place. Calendars UI, assets, portal, comments,
tasks, notifications and dashboards arrive in M5-M10
(`../docs/DEVELOPMENT-PLAN.md`). Local machine only -- no production yet.

## Stack

- Express 4 + TypeScript (Node 22, ESM, `tsx` in dev, `tsup` build), **Feature-Based Modular Monolith** -- one deployable process, internally partitioned into modules with enforced internal layering (see Architecture below)
- **Provider-agnostic infrastructure**: every repository talks to PostgreSQL through **Drizzle ORM** over a plain `DATABASE_URL`; every identity operation goes through an `AuthProvider` interface. Supabase is today's database host and auth provider, both swappable without touching a service, controller or DTO. See "Infrastructure & providers".
- PostgreSQL. Local: the Supabase CLI's Dockerized stack. Schema changes are hand-written SQL in `supabase/migrations/` (ADR 0004); each module's Drizzle `infrastructure/*.schema.ts` mirrors its tables for typed queries.
- Supabase Auth behind this API -- `hok-web` never talks to Supabase directly, only to `/api/v1/auth/*`. See "Authentication".
- Stateless REST: every request carries its own bearer token and is independently verified; nothing about a session is stored on the server between requests. The API never sets or reads cookies.
- zod validation at the edge, a typed error hierarchy with stable codes, structured logging (`pino`/`pino-http`), `helmet`, CORS allow-list, in-memory rate limiting on `/auth/*`, an audit log, OpenAPI + Swagger UI.
- Vitest (unit + integration), supertest, a per-role RBAC matrix script.
- `src/domain/` -- this repo's **own** copy of the six roles, the RBAC capability matrix, the `Profile` type and the time-zone / contact validation. `hok-web` keeps an equivalent copy; neither imports from the other. See "No shared package, on purpose".

Planned with later milestones (not installed yet): `web-push` (M9), `@date-fns/tz` (M5).

## Prerequisites

- Node.js 22+ (`@supabase/supabase-js` needs the native `WebSocket` from Node 22; the Dockerfile pins `node:22-alpine`)
- Docker Desktop, running (the local Supabase stack is Dockerized)

## Quick start

```bash
npm install
npx supabase@2.119.0 start -x imgproxy,edge-runtime,logflare,vector
# ⤷ prints the anon + service_role keys
# The version is pinned and four unused containers excluded -- see
# "Local stack maintenance" below for why.

cp .env.example .env
# Fill in SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY from the output above.
# SUPABASE_URL (http://127.0.0.1:54421) and DATABASE_URL (127.0.0.1:54422)
# already match HOK's local stack.

npx supabase@2.119.0 migration up    # apply supabase/migrations/*.sql
npm run seed                          # one staff account per role (password Hok@2026)
npm run dev
# ⤷ http://localhost:4100 -- liveness /health, readiness (DB-checked) /health/ready,
#   interactive API docs /api-docs, every module under /api/v1
```

Stop the stack with `npx supabase@2.119.0 stop` (data persists);
`npx supabase@2.119.0 db reset` wipes and re-applies every migration.
**Always include the version** -- see "Local stack maintenance".

Or, once `.env` is filled in, **one command** does the backend bring-up
(start Postgres/Auth, apply pending migrations, seed, start the API):
`npm run dev:up`.

To start **everything at once -- Supabase + this API + hok-web** -- run the
workspace launcher from `HOK/` (one directory up): `.\start-dev.ps1`. It
starts Supabase, applies migrations, and opens the API (`:4100`) and web
(`:3400`) dev servers in their own windows; `-Seed` also seeds demo data,
`-Reset` wipes and re-applies the DB first. See its header comment.

### Ports (offset from needleye, so both run at once)

| Service | HOK | needleye |
| --- | --- | --- |
| Supabase API (Kong) | 54421 | 54321 |
| Postgres | 54422 | 54322 |
| Studio | 54423 | 54323 |
| Local mail-testing UI | 54424 | 54324 |
| Shadow DB / pooler | 54420 / 54429 | 54320 / 54329 |
| hok-api | **4100** | 4000 |
| hok-web | **3400** | 3000 |

### Local stack maintenance

**The Supabase CLI version is pinned, everywhere, on purpose** (`supabase@2.119.0`,
the same as needleye). A bare `npx supabase` resolves whatever is newest that
day, and each CLI release pins its *own* Docker image tags, so a newer CLI
re-downloads the whole multi-GB image set. Pinned, Docker reuses what's on
disk -- including the images needleye already pulled.

The pin lives in **one** place -- `$SupabaseCli` at the top of
`../start-dev.ps1`. `package.json`'s `dev:up`, the CI workflow and the
commands in this README quote the same version; keep them in step.

Four containers are excluded (`-x imgproxy,edge-runtime,logflare,vector`)
because nothing here uses them. Storage and Realtime are disabled in
`supabase/config.toml` (HOK stores links, never files; no realtime feature),
and so is analytics. See ADR 0004.

`.\start-dev.ps1` checks for a newer CLI on each run and only *offers* it;
`-NoUpdateCheck` skips the check. Upgrade only when something asks for it.

> **Never `docker system prune -a`.** It deletes every image not used by a
> *running* container -- with the stack stopped, the whole Supabase image set
> goes. Plain `docker image prune` (dangling layers only) is safe.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | API with `tsx watch` on :4100 (restarts on save; `touch src/index.ts` forces a restart, which also clears the in-memory rate limiter) |
| `npm run dev:up` | Supabase start + `migration up` + seed + dev |
| `npm run lint` / `typecheck` / `build` | ESLint (type-aware flat config), `tsc --noEmit`, `tsup` bundle to `dist/` |
| `npm run test:unit` | Domain rules, services against in-memory fakes, the OpenAPI drift check. No database (placeholder env in `vitest.config.ts`) |
| `npm run test:integration` | Real Postgres + GoTrue + the Express app in-process (`tests/integration/`, see its README). Includes the query budget |
| `npm run test:rbac` | `tests/rbac-matrix.mjs`: every endpoint × six roles against the **running** API. Needs `SEED_ADMIN_PASSWORD` (local: `Hok@2026`); creates and then deactivates its own fixture accounts |
| `npm run seed` | `src/db/seed.ts`: one staff account per role (`admin@hok.test`, `rohan.smm@hok.test`, `sara.smm@hok.test`, `vikram.mm@hok.test`, `neha.agent@hok.test`, `arjun.dev@hok.test`, `meera.editor@hok.test`; password `Hok@2026`), with mixed time zones; 8 clients across Rohan, Sara, Vikram and the Admin (one paused, one archived); 3 stage templates (Photo Shoot, Reel Production, Campaign Launch); 3 events per client (3 weeks ago and finished, tomorrow mid-way, in 12 days just planned) in each client's time zone, with stage history. Safe to re-run; never deletes. **Local only** |
| `npm run db:studio` | Drizzle Studio against `DATABASE_URL` |
| `npm run db:generate` | drizzle-kit diff of the `*.schema.ts` files -- a drafting aid only. Migrations are hand-written SQL in `supabase/migrations/` (ADR 0004); never commit its `drizzle/` output |
| `npm run docker:build` | Builds the production image |

`npm run lint`, `typecheck` and `test:unit` should be clean before pushing --
CI runs them on every push/PR (see "Deployment").

### Docker

`Dockerfile` (multi-stage: `npm run build` in `node:22-alpine`, then only
production dependencies + `dist/` + `openapi.yaml`, running as the non-root
`node` user) builds the API into one image -- `npm run docker:build`.
Verified in CI (build only). To run it against the local stack, point the URLs
at `host.docker.internal`:

```bash
docker build -t hok-api .
docker run --rm -p 4100:4100 --add-host=host.docker.internal:host-gateway \
  -e SUPABASE_URL=http://host.docker.internal:54421 \
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:54422/postgres \
  -e SUPABASE_SERVICE_ROLE_KEY=... -e SUPABASE_ANON_KEY=... \
  -e CORS_ALLOWED_ORIGIN=http://localhost:3400 -e WEB_APP_URL=http://localhost:3400 \
  hok-api
```

## Architecture

A **Feature-Based Modular Monolith**: one process, one deployable, split into
business-capability modules (`src/modules/*`). Every module is built to four
internal layers, dependencies always pointing inward:

```
api/            controllers (*.routes.ts, also the composition root), request/response DTOs, presenters (entity -> DTO)
application/    use-case services, repository ports (interfaces)
domain/         entities, pure business-rule functions -- zero framework/persistence knowledge
infrastructure/ concrete Drizzle adapters, this module's own *.schema.ts, persistence mappers
```

Domain depends on nothing. Application depends on Domain and declares the
ports Infrastructure must satisfy -- never imports Drizzle. Infrastructure
depends on Domain and Application's ports. API depends on Application only.
Layers are never merged for convenience: every module has the same shape
regardless of size. Decisions: `docs/adr/0001` (the modular monolith),
`0002` (port/implementation split; domain rules throw `AppError`), `0003`
(per-module schema ownership; cross-module reads only Infrastructure to
Infrastructure), `0004` (HOK's foundations: ports, SQL migrations, sign-up
off, storage/realtime off, least-privileged trigger default, per-user time
zones, account rules), `0005` (clients: single owner, 404 row scope, archive,
optimistic lock), `0006` (stage templates and events: copied stages, free stage
moves, range-bounded calendars).

### Directory tree (today)

```
src/
  index.ts                 process entry: listen, graceful shutdown, crash net
  app.ts                   composition root: middleware order, health, /api-docs, /api/v1 routers
  config/env.ts            zod-validated environment (fails fast on a bad .env)
  domain/                  shared kernel: roles, capability matrix, Profile, time-zone + contact validation (+ tests)
  common/
    audit/                 AuditLogger interface, DrizzleAuditLogger, AUDIT_ACTIONS, audit_log schema
    auth/                  AuthProvider interface + SupabaseAuthProvider (the only Supabase Auth importer)
    context/               AsyncLocalStorage request context (requestId, userId, role)
    crypto/credentials.ts  generated passwords, opaque tokens, SHA-256 token hashing
    database/              Drizzle client + pool, slow-query timing, DB-error logging, fetchActiveProfile, LIKE escaping
    errors/                AppError hierarchy + ERROR_CODES registry
    http/                  asyncHandler, validateBody/validateQuery, uuidParam
    logger/                pino logger + pino-http request logger (redacts auth/cookie headers)
    middleware/            requireAuth, requireCapability, error + 404 handlers, auth rate limiter
  modules/
    auth/                  login, refresh, logout, password reset/update, exchange-code, /me (+ self-edit), bootstrap
    users/                 Admin-managed staff accounts; owns the `profiles` schema
    clients/               client profiles, owner row scope, archive, reassign; owns the `clients` schema
    stage-templates/       Admin-made templates (name + ordered stages); owns `stage_templates`, `stage_template_stages`
    assets/                asset link library: links + tags + search; owns `assets`, `tags`, `asset_tags`
    client-todos/          client to-do lists (Phase 2): a manager's internal to-dos per client; owns `client_todos`
    events/                client events: copied stages, stage moves + history, state, range query; owns `events`, `event_stages`, `event_stage_history`
    reports/               Admin reports (team status, staff month, client month): read-only aggregates, owns no table
    staff-tasks/           Admin-assigned staff tasks: assignee row scope, status + timeline, editor brief, reopen; owns `staff_tasks`, `staff_task_updates`
  docs/openapi.ts          loads openapi.yaml once for /api-docs (+ drift test)
  db/seed.ts               local dev seed
supabase/
  config.toml              project `hok`, ports 544xx, sign-up off, storage/realtime/analytics off
  migrations/              hand-written SQL: 20261013000001_profiles.sql, 20261013000002_audit_log.sql,
                           20261013000003_clients.sql, 20261013000004_stage_templates_events.sql,
                           20261014100001_assets.sql, 20261014200001_staff_tasks.sql
tests/
  integration/             real-stack tests (foundation, auth, users, clients, events, query budget) + helpers
  rbac-matrix.mjs          per-role HTTP check against the running API
openapi.yaml               hand-maintained API contract, served at /api-docs
```

### Layer responsibilities (why each one exists, not just what it's called)

- **Controller** (`api/*.routes.ts`) -- HTTP only: read `req`, call the service, shape `res`. Never touches Drizzle or a vendor SDK, never contains a business rule. Also the module's composition root: wires the concrete adapter into the service.
- **Validation** (`common/http/validate.middleware.ts`, per route) -- parses the body/query against a DTO's zod schema *before* the controller runs. A service can assume its input is well-formed.
- **Service** (`application/*.service.ts`) -- business rules and orchestration: "what has to be true for this to be allowed", calling domain rule functions and the repository port. Never imports Drizzle or a provider.
- **Repository port** (`application/ports/*.port.ts`) -- what the service needs from persistence, in domain terms.
- **Repository implementation** (`infrastructure/drizzle-*.repository.ts`) -- persistence only, built on Drizzle + the module's `*.schema.ts`. Row-level scoping by owner belongs here (a data-visibility concern); *whether the caller may attempt the operation* is the service's job. Auth and Users also hold an `AuthProvider` for identity operations.
- **Mapper** (`infrastructure/*.mapper.ts`) -- Drizzle row → domain entity, sync, no logic (e.g. `Date` → ISO string).
- **Presenter** (`api/*.presenter.ts`) -- domain entity → response DTO. Kept explicit even where the shapes are identical, so they can diverge later.
- **Entity** (`domain/*.entity.ts`) -- the in-memory business object a service operates on.
- **Domain rules** (`domain/*.rules.ts`) -- pure functions that throw `AppError` with a registered code (ADR 0002), each with a unit test file beside it.
- **DTO** (`api/dto/*.ts`) -- zod schemas for requests (validation + type via `z.infer`), interfaces for responses.

### Infrastructure & providers

Nothing in `modules/*` knows the app runs on Supabase. Two swap points today
(needleye's third, storage, doesn't exist in HOK: assets are links):

**1. Database host.** Every repository queries through Drizzle
(`common/database/drizzle-client.ts`) against a plain `DATABASE_URL`. Moving
Postgres hosts is an env-var change plus `pg_dump`/restore -- no repository
imports the Supabase SDK for data access. What is genuinely Supabase-specific
lives in the SQL migrations: the `handle_new_user()` trigger on `auth.users`,
RLS policies that call `auth.uid()`, and the `anon`/`authenticated`/`service_role`
grants. The API connects directly to Postgres, so RLS is defence in depth for
the Data-API path the app never uses.

**2. Auth provider.** `common/auth/auth-provider.ts` declares `AuthProvider`,
named around what the business needs (`signInWithPassword`, `refreshSession`,
`signOut`, `verifyAccessToken`, `requestPasswordReset`, `setPassword`,
`exchangeCodeForSession`, `createUser`, `banUser`, `unbanUser`).
`SupabaseAuthProvider` is the only implementation and the only file that
imports the Supabase Auth clients (two clients: service-role for admin
operations, anon-key for what a public client would do; both with
`persistSession`/`autoRefreshToken` off). It also maps GoTrue's duplicate-email
error to `409 USER_EMAIL_TAKEN`. `requireAuth`, `DrizzleAuthRepository` and
`DrizzleUsersRepository` depend on the interface, injected at each module's
composition root. **Honest caveat:** `handle_new_user()` is Supabase glue;
moving off Supabase Auth means replacing that one trigger too.

Every list does its work in one round trip per concern: `GET /users` is one
page query plus one `count(*)`, run in parallel, sharing one `listConditions`
builder so the page and its total can never disagree.

### No shared package, on purpose

`hok-web` and `hok-api` are separate repos and **nothing is imported across
them** -- the only connection is HTTP against this API's documented endpoints.
`src/domain/` (roles, capability matrix, `Profile`, validation) is this repo's
own copy of rules that also exist, independently, in `hok-web/lib/domain/`.
The accepted cost: a change to roles or the capability matrix is made in both
by hand. The guard is `openapi.yaml` as the contract, with
`src/docs/openapi.test.ts` failing if its `Role` enum drifts from `ROLES` or
a mounted route is undocumented.

### Error handling

Every layer throws a typed `AppError` subclass (`common/errors/app-error.ts`)
instead of calling `res.status().json()`. `common/middleware/error.middleware.ts`
is the single place that turns any thrown error -- an `AppError`, a zod
error, a body-parser failure, a Postgres error, anything unexpected -- into a
consistent `{ error, code, details?, requestId }` response, and the **only**
place errors are logged (no log-and-rethrow). `asyncHandler` wraps every async
handler so a rejected promise reaches it (Express 4 doesn't). Stack traces
and raw causes go to the logs only (the stack is echoed in the body in
development).

**Stable error codes.** Every error carries a `code` from the single registry
in `common/errors/error-codes.ts`. **Clients branch on the code, never on the
message.** Codes in use today:

| Area | Codes |
| --- | --- |
| Generic | `VALIDATION_ERROR` (400, with zod `details`), `VALIDATION_NO_FIELDS` (400), `MALFORMED_REQUEST` (400), `PAYLOAD_TOO_LARGE` (413), `ROUTE_NOT_FOUND` (404), `RATE_LIMITED` (429), `FORBIDDEN` (403, role lacks the capability), `DATABASE_ERROR` / `INTERNAL` (500); the `AppError` subclasses' fallbacks `BAD_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT` when a throw site has nothing more specific (e.g. GoTrue rejecting a weak password is `400 BAD_REQUEST`) |
| Auth | `AUTH_TOKEN_MISSING`, `AUTH_SESSION_INVALID`, `AUTH_INVALID_CREDENTIALS`, `AUTH_LINK_INVALID` (401); `AUTH_PROFILE_MISSING`, `AUTH_ACCOUNT_DEACTIVATED`, `AUTH_BOOTSTRAP_ALREADY_DONE` (403) |
| Users | `USER_NOT_FOUND` (404), `USER_CANNOT_DEACTIVATE_SELF`, `USER_CANNOT_CHANGE_OWN_ROLE` (400), `USER_PASSWORD_SELF_MANAGED` (403), `USER_EMAIL_TAKEN` (409) |
| Stage templates | `STAGE_TEMPLATE_NOT_FOUND` (404), `STAGE_TEMPLATE_STAGES_INVALID` (400), `STAGE_TEMPLATE_NAME_TAKEN`, `STAGE_TEMPLATE_MODIFIED` (409) |
| Events | `EVENT_NOT_FOUND` (404, also for another manager's), `EVENT_TIMES_INVALID`, `EVENT_TEMPLATE_INVALID`, `EVENT_TEAM_INVALID`, `EVENT_STAGE_INVALID`, `EVENT_RANGE_INVALID` (400), `EVENT_MODIFIED`, `EVENT_STAGE_UNCHANGED`, `EVENT_NOT_ACTIVE` (409); `CLIENT_ARCHIVED` (409) for any write under an archived client |
| Assets | `ASSET_NOT_FOUND` (404, also for another manager's), `ASSET_EVENT_INVALID`, `ASSET_RANGE_INVALID` (400), `ASSET_MODIFIED` (409); `CLIENT_ARCHIVED` (409) for any write under an archived client |
| Client to-dos | `CLIENT_TODO_NOT_FOUND` (404, also for another manager's), `CLIENT_TODO_EVENT_INVALID`, `CLIENT_TODO_RANGE_INVALID` (400), `CLIENT_TODO_MODIFIED` (409); `CLIENT_NOT_FOUND` (404) on the list/create routes for a client you cannot see; `CLIENT_ARCHIVED` (409) for any write under an archived client |
| Clients | `CLIENT_NOT_FOUND` (404, also for another manager's client), `CLIENT_OWNER_INVALID`, `CLIENT_CONTRACT_DATES_INVALID` (400), `CLIENT_OWNER_FORBIDDEN` (403), `CLIENT_MODIFIED`, `CLIENT_ARCHIVED`, `CLIENT_NOT_ARCHIVED` (409) |

Adding an error means adding its code to the registry first, then
referencing it -- never an inline literal. Repositories wrap persistence
failures in `InternalError` with the original as `cause`; the error
middleware logs the cause's safe fields on every 5xx, never in `details`.

### Logging

`common/logger/logger.ts` exports one `pino` instance (`LOG_LEVEL`, default
`info`); `request-logger.middleware.ts` wraps it with `pino-http`, mounted
first, so every request is logged with method, path, status, duration and a
generated or propagated `x-request-id`, and `req.log` is a child logger that
already carries the id.

- **Levels**: 2xx/3xx → `info`, 4xx → `warn`, 5xx → `error`.
- **stdout only**: JSON in production, pretty in development. No log files.
- **Request context on every line**: an AsyncLocalStorage context (`common/context/`) carries the request id (and, after `requireAuth`, `userId`/`role`) into code without `req` -- the audit logger and the slow-query logger -- so **one request id ties together the access log, app logs, slow-query logs, audit rows and the error response**.
- **Slow queries**: statements over `SLOW_QUERY_MS` (250) are logged at `warn` with parameter-free SQL.
- **DB errors**: every failed query is logged where it happens with SQLSTATE, a readable label, constraint and table -- never pg's `detail`/`where`, which carry row values.
- **Redaction**: `authorization` and `cookie` headers are `[redacted]`. Passwords and tokens never reach a log line.

### Operational concerns (health, pool, shutdown)

- **Health**: `GET /health` (liveness, touches nothing) and `GET /health/ready` (readiness, `select 1`, 503 when the DB is down).
- **Pool**: explicit bounds (`DB_POOL_MAX`, default 10; 30 s idle; 5 s connect timeout so a request fails fast instead of hanging). An idle-client `error` listener keeps a DB blip from crashing the process.
- **Graceful shutdown**: `SIGTERM`/`SIGINT` close the server, drain the pool, exit; hard cap 10 s. Uncaught exceptions are logged then exit; unhandled rejections are logged and serving continues.

### Security

- **Secure headers**: `helmet()` on every response (CSP off: a JSON API whose only HTML is Swagger UI).
- **CORS**: exact allow-list from `CORS_ALLOWED_ORIGIN` (comma-separated), never a wildcard, no credentials.
- **CSRF**: not applicable -- stateless, bearer-token-only, no cookies.
- **SQL injection**: Drizzle's builder or `sql\`\`` with bound values only; `LIKE` input escaped (`containsPattern`).
- **Auth/authz**: every protected route runs `requireAuth` (token verified with the provider, then the `profiles` row loaded -- missing or inactive is a 403) and `requireCapability`; `profiles.role` is the source of truth, never the JWT. See "RBAC".
- **Input validation**: every body/query is parsed by zod before a controller runs. Time zones must be named IANA zones; phones and photo URLs are validated (`src/domain/contact.ts`: http(s) only, so no `javascript:` links).
- **Auth rate limiting**: `common/middleware/rate-limit.middleware.ts` (`express-rate-limit`, in-memory) on bootstrap, login, refresh, password-reset-request, password-update and exchange-code: `AUTH_RATE_LIMIT_MAX` (30) per `AUTH_RATE_LIMIT_WINDOW_MS` (15 min) per IP → `429 RATE_LIMITED`. In-memory is right for one process; a shared store later is a one-line `store:` change. `TRUST_PROXY` (default `loopback`, for the Next.js session proxy in dev) makes it key on the real client IP.
- **No public sign-up** (`enable_signup = false`); the profiles trigger defaults a missing role to the least-privileged `editor` (ADR 0004).
- **Audit log** (`audit_log`, written by `DrizzleAuditLogger`, best-effort, never breaks the action): sign-ins, sign-outs, password changes, bootstrap, account create/update/deactivate/reactivate/password-regenerate, self profile edits; client create/update (field names only, never values)/archive/unarchive/reassign (`{ from, to }`); stage template create/update; event create/update. Stage moves are recorded in `event_stage_history`, not here. No Data-API grant.

### RBAC

Six roles (`src/domain/roles.ts`, REQUIREMENTS §3):

| Role | Access |
| --- | --- |
| `admin` | Everything, all data. Manages users and stage templates. The only role that assigns staff tasks. Can own clients like a manager |
| `social_media_manager` | Their own clients, events, assets, calendars, portal, comments. Receives staff tasks |
| `marketing_manager` | Same as Social Media Manager |
| `marketing_agent`, `developer`, `editor` | Staff tasks assigned to them only |

`profiles.role` is the authorization source of truth. `requireCapability(cap)`
gates each route against the flat capability matrix in
`src/domain/capabilities.ts`, where each role's scope is `true` (any record),
`"own"` (only the caller's records: clients they own and everything under
them, their personal events, tasks assigned to them) or `false`. The middleware
records the scope on `req.capabilityScope`; repositories apply the row filter.

| Capability | admin | SMM / MM | agent / developer / editor |
| --- | --- | --- | --- |
| `users:manage`, `stage_templates:manage`, `clients:reassign`, `staff_tasks:assign`, `dashboard:global` | ✓ | -- | -- |
| `clients:read/write`, `events:read/write`, `personal_events:manage`, `assets:read/write`, `portal:manage`, `comments:read/manage` | ✓ | own | -- |
| `staff_tasks:read/update` | ✓ | own | own |

In use today: `users:manage` (all of `/users`); `clients:read` (every
`/clients` route), `clients:write` (create, edit, archive, unarchive) and
`clients:reassign` (Admin only); `events:read` / `events:write` (`/events`,
and reading `/stage-templates`, active only for managers) and
`stage_templates:manage` (template writes, Admin only); `staff_tasks:read` (every `/staff-tasks`
route; own tasks for non-admins), `staff_tasks:update` (status, comments) and
`staff_tasks:assign` (create, edit, reassign, reopen, delete; Admin only). Every authenticated role may read and edit its
own profile (`/auth/me`). `npm run test:rbac` proves it over HTTP for all six
roles (74 checks at M2, 124 at M3; M4 adds the template and event cases).

**Row scope (clients).** The capability says *whether* a role may touch
clients; the scope says *which*. `ClientsService` turns `"own"` into
`owner_id = caller`: a manager's list is pinned to their own clients (their
`ownerId` filter is ignored), and reading or writing another manager's client
is **404 `CLIENT_NOT_FOUND`**, the same answer as for a missing id, so
existence never leaks (needleye's leads pattern). Writes re-check the scope
on the locked row, before the version check, so even a stale version on
someone else's client is a 404.

**Account rules** (`users/domain/account-admin.rules.ts`, ADR 0004): an Admin
can't change their own role or deactivate themselves (so an Admin always
remains); the Admin can regenerate any staff password except their own and
except another Admin's once that Admin has signed in.

### Authentication

`hok-web` holds **no Supabase SDK** -- every auth operation goes through this
API's `modules/auth` endpoints, thin stateless wrappers around the
`AuthProvider`. Tokens come back in JSON only; session persistence
(httpOnly refresh cookie, refresh-on-expiry) is entirely hok-web's concern.

| Endpoint | What it does |
| --- | --- |
| `POST /auth/login` | email + password → `{ accessToken, refreshToken, expiresAt, profile }`; records `last_login_at`, audits `auth.login` |
| `POST /auth/refresh` | rotates a refresh token for a new pair (not a "login") |
| `POST /auth/logout` | revokes this session server-side (`admin.signOut(token, "local")`; other devices stay signed in) |
| `POST /auth/password-reset-request` | always 204, whether or not the email has an account |
| `POST /auth/password-update` | bearer; sets the caller's own password |
| `POST /auth/exchange-code` | exchanges a PKCE `?code=` from an email link for a session |
| `GET /auth/me` | bearer; `{ profile }` (incl. `timeZone`, `phone`, `avatarUrl`) |
| `PATCH /auth/me` | bearer; the caller edits their own `fullName`, `phone`, `timeZone`, `avatarUrl` → `{ profile }` |
| `GET /auth/bootstrap-status`, `POST /auth/bootstrap` | one-time first-Admin setup: `{ adminExists }`; bootstrap refused once any admin exists |

A deactivated account never keeps a session: login/refresh/exchange revoke
the fresh session if the profile is inactive, the Supabase ban blocks
sign-in and refresh, and GoTrue refuses a banned user's live access token
(so `requireAuth` answers 401 even before the profile check).

**Self-service profile, naming.** The caller's own profile is the `/auth/me`
resource (read with `GET`, edited with `PATCH`), because that's where the web
already reads it and it needs no capability. `/users/:id` stays Admin-only.

### Account creation and passwords

No invite email: the Admin creates every account directly (`POST /users`)
with a password generated on the spot and returned once.

- **Password scheme** (`common/crypto/credentials.ts`'s `generatePassword`): first name + `-` + 8 random characters from a 57-symbol alphabet without look-alikes (`0/O`, `1/l/I`), e.g. `Priya-9kQ2Xf7q` (~47 bits).
- **Time zone and phone at creation**: optional; the zone defaults to `DEFAULT_TIMEZONE`. The trigger copies name/role/time zone from the auth metadata; the phone is written to `profiles` right after.
- **Listing & lifecycle**: `GET /users` is searchable (name or email), role-filterable and offset-paginated (`{ users, total, limit, offset }`, limit clamped 1–100). Deactivation is reversible (`POST /users/:id/reactivate` lifts the ban; same password as before). `PATCH /users/:id { active }` does the same as the two endpoints.

### Clients (M3, ADR 0005)

REQUIREMENTS §5.2. One table, `clients` (`supabase/migrations/20261013000003_clients.sql`),
owned by the Clients module.

- **Ownership.** Exactly one owner, a client manager (admin, social_media_manager, marketing_manager). The creator owns a new client; only the Admin may pass `ownerId` to create for someone else. `owner_id` is `ON DELETE RESTRICT`: staff are deactivated, never deleted, and a client never disappears with a person. Everything later modules hang off a client (events, assets, portal links, comments) references `client_id`, so a reassign moves "the client and all its data" in one update.
- **Status.** `active <-> paused` through `PATCH`; `archive` (status `archived` + `archived_at`, hidden from the default list, data kept) and `unarchive` (back to `active`) are their own actions. An archived client is read-only until unarchived; reassign still works on it. A CHECK keeps `status = archived` and `archived_at` in step. (From M8, archiving also disables the portal link.)
- **Optimistic lock.** `version` (needleye's pattern): every write bumps it; `PATCH` **requires** the version the form loaded, archive / unarchive / reassign accept it optionally; a stale one is `409 CLIENT_MODIFIED`. Every write is one transaction: `SELECT … FOR UPDATE OF clients`, then the service's guard callback (scope, version, state, contract dates against the stored values), then the update.
- **Fields.** `social_handles` is a `jsonb` object keyed by a fixed platform list (instagram, facebook, tiktok, youtube, linkedin, x, threads, pinterest, snapchat); each value is a handle or an http(s) link. `services` is `text[]`, a flat list of labels (trimmed, case-insensitive de-duplicated, max 20 × 60 chars): no structure to model, and `= any(services)` or a GIN index work on it directly if it's ever filtered on. Websites are stored with a scheme (`acme.com` → `https://acme.com`); logo URLs must be full http(s) links; `timeZone` is a named IANA zone (default `DEFAULT_TIMEZONE`); contract dates are `YYYY-MM-DD` and the end can't precede the start (API rule + DB CHECK). `notes` are internal and will never reach the portal.
- **Lists.** `GET /clients` returns a summary row (no notes, address, handles, services), newest first, one page query (joined to the owner's name) + one `count(*)`. Filters: `search` (business name, trigram-indexed), `status`, `industry` (case-insensitive exact), `ownerId` (Admin only). Indexes: `(owner_id, created_at desc, id desc)`, `(status, created_at desc, id desc)`, `lower(industry)`, a GIN trigram index on `business_name`.

### Stage templates and events (M4, ADR 0006)

REQUIREMENTS §5.3. Migration `20261013000004_stage_templates_events.sql`.

- **Templates** (Admin): a name (unique, ignoring case) and 1-20 ordered stages. A PATCH replaces the whole stage list (rename / reorder / add / remove) and/or sets `active`; `version` required. Managers read active templates only (to pick one); an inactive template is a 404 for them.
- **Events** go under one of the caller's clients (`events:write` + the client's owner; a client that isn't yours is `404 CLIENT_NOT_FOUND`), from an **active** template whose stages are **copied** onto the event (`event_stages`); the first becomes current and a first history entry is written. Later template edits never reach existing events. A composite FK keeps the current stage one of the event's own.
- **Stage moves** (`POST /events/:id/stage`): any stage of the event, forward or back, with an optional note and `visibleToClient` (for the M8 portal); the move and its `event_stage_history` row are one transaction with the version check. Not to the current stage, not on a cancelled/postponed event.
- **State**: active / cancelled / postponed, any change, through PATCH (with title, type, reschedule, location, description, team). `version` required on every write (`409 EVENT_MODIFIED`).
- **Archived client** → its events are read-only (`409 CLIENT_ARCHIVED` on every write).
- **Time**: instants with an offset in, UTC ISO out; `timeZone` is the event's IANA zone (defaults to the client's). Ends on/after start, at most 31 days.
- **Lists**: `GET /events` serves the client's Events tab (`clientId`) and the calendars (`from` + `to`, ≤ 92 days, overlapping events, earliest first; the 31-day max length bounds the `starts_at` index scan). Rows carry the client name and current stage (name, position, stage count); page cap 200. Detail: the event + stages + last 100 history entries + team names (three parallel queries).

### Asset links (M6)

REQUIREMENTS §5.5. Migration `20261014100001_assets.sql` (tables `assets`, `tags`, `asset_tags`).

- **Links only, never files.** `url` must be http(s) (zod `isValidHttpUrl` + a DB CHECK backstop, so a `javascript:` / `data:` URL can never be stored). Type: photo / video / document / design / audio / other. Comment up to 2000 characters.
- **Row scope through the client**: an asset belongs to a client; the Admin sees all, a Social Media / Marketing Manager only assets of clients they own (anything else is `404 ASSET_NOT_FOUND`), task-only staff `403`. Capabilities `assets:read` / `assets:write`. Never shown on the portal.
- **Tags** are per client and matched ignoring case (unique index on `(client_id, lower(name))`; the first spelling is kept). Up to 10 per asset, 30 characters each; a PATCH `tags` replaces the whole set. `GET /assets/tags` auto-suggests tags in use by live assets (with counts), for one client or the caller's whole scope.
- **Event link**: optional `eventId` must be one of the asset's own client's events (`400 ASSET_EVENT_INVALID`; checked in the API because events never change client). FK `ON DELETE SET NULL`.
- **Writes**: `version` required on PATCH (`409 ASSET_MODIFIED`); DELETE is a **soft delete** (`deleted_at`, version bumped) with an optional `?version=`. An archived client's assets are read-only (`409 CLIENT_ARCHIVED`) but still readable. Create locks the client row FOR SHARE and re-checks scope and status there.
- **Lists**: `GET /assets` (all caller-scope assets, or one client via `clientId`), newest first, page cap 100. Filters: `search` (title, comment or tag; trigram-indexed), `type`, `tag` (exact, case-insensitive), `eventId`, `from`/`to` (instants, the web sends the viewer's day boundaries; `from` inclusive, `to` exclusive), `ownerId` (Admin). Queries: one page query (joined to client, event title and creator), one `count(*)`, one tags query for the whole page -- constant, never per row. Partial indexes (`where deleted_at is null`): `(client_id, created_at desc, id desc)`, `(client_id, type, created_at desc)`, `(created_at desc, id desc)`, `(event_id)`, trigram on `title` and `comment`; trigram on `tags.name`.
- Audit: `asset.created`, `asset.updated` (field names), `asset.deleted` -- never the URL.

### Staff tasks (M7)

REQUIREMENTS §5.9 (FR-TSK-01..10; reminders FR-TSK-11 are Phase 2). Migration `20261014200001_staff_tasks.sql` (tables `staff_tasks`, `staff_task_updates`).

- **Who does what.** Only the Admin creates, edits, reassigns, reopens and deletes (`staff_tasks:assign`). Exactly one assignee, any **active** staff member of any role (`400 STAFF_TASK_ASSIGNEE_INVALID`); `assignee_id` is `ON DELETE RESTRICT`. Everyone else has `staff_tasks:read/update = own`: they see only tasks assigned to them (anyone else's is **404 `STAFF_TASK_NOT_FOUND`**, also with a stale version) and work on them. A Social Media / Marketing Manager receives tasks the same way.
- **Status.** `todo`, `in_progress`, `blocked`, `done`. The assignee (or the Admin) moves an open task to any other status, done included, with an optional comment (`POST /:id/status`). A done task is closed (`409 STAFF_TASK_DONE`) until the Admin reopens it (`POST /:id/reopen`, to todo / in_progress / blocked). `completed_at` follows the status (DB CHECK).
- **Timeline.** Every status change, comment, reassign and reopen appends a `staff_task_updates` row **in the same transaction** as the change (append-only; kinds `created`, `status`, `comment`, `reassigned`, `reopened`). Detail returns the newest 100. Comments (`POST /:id/comments`, assignee or Admin, any time) don't bump the task's `version`, so an open edit form isn't invalidated by a discussion.
- **Editor tasks (decision).** When the assignee is an **editor**, `rawFilesUrl` (the Drive folder) is **required** (`400 STAFF_TASK_EDITOR_FIELDS_REQUIRED`); `referenceUrl` and `script` (up to 20 000 characters) are optional, because not every edit has an example or a script. For every other role the three fields stay empty: sending one is `400 STAFF_TASK_EDITOR_FIELDS_INVALID`, and reassigning a task from an editor to someone else **clears** them (the web warns first). All links must be http(s). Any task may also carry up to 10 `referenceLinks` (`{ url, label }`).
- **Links.** Optional `clientId` / `eventId` (`ON DELETE SET NULL`). An event must belong to the named client; an event alone links its client; changing the client without an event unlinks the old event (`400 STAFF_TASK_CLIENT_INVALID` / `STAFF_TASK_EVENT_INVALID`). The assignee sees the client's name and the event's title on the task even without client access -- that's the task's context, nothing more. **Events safety:** the migration adds the `event_id` FK only if `public.events` exists (it does whenever `migration up` runs, because 20261013000004 sorts first); the repository treats a missing events table (SQLSTATE 42P01) as "no such event", so tasks keep working and `eventId` is refused with 400 instead of a 500.
- **Optimistic lock.** `version` required on PATCH, status and reopen (`409 STAFF_TASK_MODIFIED`); every write is `SELECT … FOR UPDATE OF staff_tasks` + the service's guard callback + the update + the timeline row. Delete is a hard delete (timeline cascades; `staff_task.deleted` stays in the audit log).
- **Lists.** `GET /staff-tasks`: page cap 100, one page query (joined to the assignee's profile and the client) + one `count(*)`. Filters: `status`, `open=true` (not done), `priority`, `overdue=true` (due before now and not done), `dueFrom`/`dueTo` (instants; the web sends the viewer's day boundaries), `search` (title), and for the Admin `assigneeId`, `role` (the assignee's) and `clientId`. Order: open before done, soonest due first (no due date last), newest; with `status=done`, latest completed first (one Kanban column = one `status` query).
- **Notifications (M9).** `StaffTasksService` calls a `StaffTaskNotifier` (`application/ports/staff-task-notifier.port.ts`) after commit: `taskAssigned` (create, reassign), `statusChanged` (status, reopen) and `commentAdded`, each with the actor. `staff-tasks.routes.ts` wires the real one: it notifies the other side (the assignee when the Admin acts, the assigner when the assignee acts).
- Audit: `staff_task.created`, `staff_task.updated` (field names only), `staff_task.reassigned` (`{ from, to }`), `staff_task.deleted`. Status changes and comments live in the timeline instead.

### Client to-dos (Phase 2)
REQUIREMENTS §5.4 (FR-CTSK-01..04). Migration `20261017000003_client_todos.sql` (table `client_todos`).

- **What**: a manager's internal to-dos for one client, optionally about one of the client's events. Separate from staff tasks (which the Admin assigns to people). **Never on the portal**: no portal route, nothing in the portal presenters.
- **RBAC**: reuses `clients:read` (list) and `clients:write` (create / edit / delete). Row scope is the client's owner: the Admin sees all, a Social Media / Marketing Manager only their own clients' (the list/create routes answer `404 CLIENT_NOT_FOUND` for a client they cannot see, the `/client-todos/:id` routes `404 CLIENT_TODO_NOT_FOUND`; visibility is checked before the version), task-only staff `403`.
- **Status** `todo` / `in_progress` / `done`; `done` stamps `completed_at` and reopening clears it (the DB CHECK ties them together). Priority `low`/`medium`/`high`/`urgent`. `dueAt` is an instant with an offset.
- **Writes**: `version` required on PATCH (`409 CLIENT_TODO_MODIFIED`), locked FOR UPDATE with the guard-callback pattern; DELETE is a **hard delete** with an optional `?version=` (the audit entry `client_todo.deleted` is the trace). An archived client's to-dos are readable but read-only (`409 CLIENT_ARCHIVED`). `eventId` must be one of the same client's events (`400 CLIENT_TODO_EVENT_INVALID`). Audit: `client_todo.created/updated/deleted`, ids and field names only.
- **List**: `GET /clients/:clientId/todos`, page cap 100 with `total`. No `status` = the open list (not done); `status=all` = every status. Filters `status`, `priority`, `overdue=true`, `dueFrom`/`dueTo` (inclusive/exclusive instants), `search` (title, escaped ILIKE). Order: open before done, soonest due first (no due date last), newest; `status=done` is most recently completed first. Queries: client lookup + one page query (joined to client, event title, creator) + one `count(*)`.

### Calendars and personal events (M5)

REQUIREMENTS §5.6. Migration `20261014300001_personal_events.sql`. `personal-events` owns a manager's own entries (`personal_events:manage`, owner-only; anyone else's is 404). `calendar` owns no table: `GET /calendar?from&to` (≤ 92 days) merges client events and personal entries overlapping the range, in **two** parallel queries (one per kind, each capped at 500, `truncated: true` if hit). A manager gets their clients' events plus their own entries; the Admin gets every event (or one `ownerId`'s). Times are UTC; the web shows them in the viewer's zone.

### Client portal and comments (M8)

REQUIREMENTS §5.7–5.8. Migration `20261014400001_portal_comments.sql` (`portal_links`, `client_comments`, `client_comment_history`).

- **The link is the only credential.** 32 random bytes, base64url; only its **SHA-256 hash** is stored, and the token is shown once (on generate / regenerate). At most one active link per client (partial unique index). Regenerate replaces it, disable switches it off, and **archiving a client revokes it for good** (inside the archive transaction).
- **Public routes** (`/api/v1/portal/:token`, `/events`, `/events/:id`, `/comments`) are mounted **before** the global JSON parser with a 4 kb body limit. `requirePortalLink` answers **the same 404 `PORTAL_LINK_INVALID`** for every bad, disabled or revoked link. Rate limits: reads per IP; comments per IP, per link and globally. The token is redacted from logs. Responses are `Cache-Control: no-store`, and the presenters list client-safe fields explicitly (no staff names, ids or versions; only stage notes marked visible to the client).
- **Comments.** The client posts (1–2000 characters, optionally about one of their events); the owning manager is notified (push + bell, never email). Staff inbox `GET /client-comments` (page cap 100; filters `status`, `clientId`, `search` on comment text or client name; + `/counts`), `PATCH /:id` to change status and reply (`version` required, `409` on a stale one). Lifecycle: received → in progress → solved, solved can reopen to in progress, never back to received. Status changes are appended to `client_comment_history` in the same transaction.

### Notifications (M9)

`notifier.notify({ type, recipientIds, actorId, payload })` writes the bell row and sends web push in the background (VAPID keys in `.env`; dead subscriptions are pruned). Five triggers, all live: client comment, task assigned, task status changed, task commented, client reassigned. Each user can mute push and/or the bell per trigger. **No email, ever** (the user's decision).

### Dashboards (M10)

REQUIREMENTS §5.11. The module owns no table.
- `GET /api/v1/dashboard?view=overview|mine`, every staff role. `overview` (default): everyone gets their own work (`tasks`, plus `clients` for SMM / MM), except the **Admin, whose overview is the firm alone** (`firm`: totals incl. overdue, this week's events and team size; tasks by status; the 5 most overdue tasks; this week's events; the 5 newest unresolved comments; the 5 busiest people). `mine`: the caller's own clients and tasks -- the Admin's "My clients" page; the same as `overview` for other roles.
- Every list is a **preview of at most 5** with a total, so the web links "View all N" to the full, paged page.
- `GET /api/v1/dashboard/team` (`dashboard:global`): the whole team's workload, busiest first; name `search`, `role` (never admin), paged (≤ 50). Two queries.
- Figures are `count(*) filter (…)` aggregates; the query count is **fixed per role and view** (task-only staff 3, managers 7, the Admin's overview 5 and "My clients" 7, plus the auth lookup), whatever the data size (query-budget test). "Today" and "this week" are the caller's own time zone (`src/domain/zoned-day.ts`, DST-safe).

### Activity log (Phase 2)

FR-SYS-02 / FR-RPT-05. The module owns no table.
- `GET /api/v1/activity` (`dashboard:global`, Admin only; others 403): who did what, newest first, as plain-English sentences. Query: `from`/`to` instants (default the last 7 days; `from` after `to` or a span over 31 days is a 400 `ACTIVITY_RANGE_INVALID`), `kind` (all | clients | events | tasks | comments | assets | accounts), `actorId`, `limit` (default and max 50), `offset`. Response `{ items: [{ id, at, kind, actor, summary, url }], total, limit, offset }`.
- Sources, as **one UNION ALL query**, each bounded by the range and filtered by kind and person *before* the union, ordered by `at desc, id`, limited, with names joined by primary key only for the page's rows: `audit_log` (action prefixes map to kinds), `event_stage_history` (moves, not the initial stage), `staff_task_updates` (status, comment, reassigned, reopened), `client_comments` (actor null) and `client_comment_history`. Audit twins of those typed histories are skipped, so nothing shows twice. Plus one count over the same union: **two queries** whatever the page size (query-budget test). Indexed by `created_at desc` on each source (migration 20261021000001).
- Sentences are built in the domain layer from structured fields (`in_progress` reads "In progress"). Comment bodies, tokens and contact details are never selected.

### Reports (Phase 2)

FR-RPT-01..04. The module owns no table; every endpoint is `dashboard:global` (Admin only, others 403).
- `GET /api/v1/reports/team-status`: active non-admin staff, paged (default 20, max 50), busiest first. Filters `search` (name), `role`, `status=working|idle`, all in SQL. **Working** = has open tasks AND (was seen OR acted in the last 24 h); everyone else idle. `activityLast24h` = their task updates + stage moves + audit actions in the window. The response carries the rule (`rule.windowHours`, `rule.asOf`) so the screen can explain it. **Two queries** (rows, total) whatever the page size: each activity source is aggregated once over the last 24 h (`created_at` / actor indexes), never a subquery per row.
- `GET /api/v1/reports/staff?userId&month=YYYY-MM`: assigned and completed in the month, of the completed on time (no due date counts as on time) vs late, average days to complete, open and overdue now, a weekly series (Monday-start weeks clipped to the month), plus the person's name, role and last seen. **Two queries** (person, then one aggregate with a `count(*) filter` pair per week).
- `GET /api/v1/reports/client?clientId&month=YYYY-MM`: events that started in the month (total, by state, by type), stage moves made, comments received / solved / replied with the average first-reply hours, to-dos finished in the month vs open now, assets added, plus the client and its owner. **Six queries** (client, then five aggregates in parallel). Admin only, so every client is visible.
- **Months** are calendar months in the *viewer's* time zone (`src/domain/zoned-day.ts`). Only the current month and the 5 before it are allowed; a future, older or malformed-but-shaped month is a 400 `REPORT_MONTH_OUT_OF_RANGE` (a month that isn't `YYYY-MM` is the usual 400 `VALIDATION_ERROR`). An unknown person or client is a 404.
- Indexes used: `staff_tasks (assignee_id, created_at)` and `(assignee_id, completed_at) where completed_at is not null`, `events (client_id, starts_at)`, `event_stage_history (created_at desc)`, `client_comments (client_id, created_at desc)`, `client_todos (client_id, …)`, `assets (client_id, created_at desc)`, `staff_task_updates (author_id, created_at desc)`, `audit_log (actor_id, created_at desc)`.

### Reminders and last seen (Phase 2)

- **Reminders** (`src/modules/reminders`): one per active event (to the client's owner) and per open task with a due time (to the assignee), about **2 hours** ahead. An in-process runner (started in `src/index.ts`, never in tests) checks **every 10 minutes**: one transaction claims due rows through partial "still waiting" indexes with `FOR UPDATE SKIP LOCKED`, stamps `events.reminded_at` / `staff_tasks.due_reminded_at` and writes the bell rows; pushes go out after the commit. Two API instances never send the same reminder; moments already past are skipped; a new start/due time, a reassignment or a reopen clears the stamp. Types `event_reminder`, `task_due_reminder` (mutable in preferences); `GET /notifications/unread-count` also returns `reminders` (the bell's alert animation).
- **Last seen**: `requireAuth` writes `profiles.last_seen_at` at most every 5 minutes per person (in-memory note + the same condition in SQL), fire-and-forget. Exposed on users and the team workload; the web reads anything older than 45 days as "not seen".

### Global search (Phase 2)

`GET /api/v1/search?q=` (2-80 chars), every role: up to 5 hits each for clients, events, staff tasks, client to-dos and asset links, scoped exactly like their pages (a group the role can't see is `null`). One trigram-indexed, escaped `ILIKE` query per group, in parallel: 5 queries + auth whatever matches (query-budget test).

### Link previews (Phase 2)

After an asset is saved (or its URL changes), `HttpLinkPreviewer` fetches the page in the background and stores `preview_*` (title, description, image URL, site). Guarded against SSRF: http(s) on standard ports only, every DNS answer checked at connect time (private, loopback, link-local/metadata, CGNAT, multicast, reserved and IPv4-mapped forms refused; literal IPs checked too), redirects re-checked (max 3), 4 s and 512 KB limits, HTML only. YouTube uses its oEmbed JSON. Off in tests and with `LINK_PREVIEWS=off`.

### Calendar subscribe link (FR-CAL-08)

Anyone with a calendar (`events:read`: Admin, SMM, MM) can make one secret link to add their HOK calendar to Google Calendar, Apple Calendar or Outlook ("subscribe from URL"). `GET|POST|DELETE /api/v1/calendar/feed-link` shows, makes (a new one replaces the old one at once) and turns off the caller's own link; the token and the full link (`PUBLIC_API_URL` + `/api/v1/calendar-feed/<token>.ics`) are returned once and only its SHA-256 is stored (`profiles.calendar_feed_token_hash`, migration `20261022000001`). The public `GET /api/v1/calendar-feed/<token>.ics` (no login, rate-limited, token redacted from logs) returns the same items as the person's calendar in HOK: the next 180 days (up to 500 per kind) and the last 30 (up to 100 per kind), read separately so a busy past never pushes upcoming items out, in UTC: 1 lookup + 4 queries. Every bad link (malformed, unknown, replaced, off, deactivated person, role without a calendar) is the same 404 `CALENDAR_FEED_INVALID`. Calendar apps fetch it from their own servers, so it only works once the API is on a public https address; Google re-fetches subscribed calendars on its own schedule (typically every 8-24 hours) and ignores the feed's refresh hint; Apple and Outlook let the user choose the interval.

### Dependency injection

No container -- manual constructor injection at each module's composition
root (`new UsersService(new DrizzleUsersRepository(authProvider))`). Services
depend on interfaces (`UsersRepositoryPort`, `AuditLogger`), so unit tests pass
in-memory fakes.

## API documentation (Swagger / OpenAPI)

`openapi.yaml` (repo root) is the hand-maintained request/response contract
for every route, served at **`GET /api-docs`** (Swagger UI). Update it in the
same change as any route; `src/docs/openapi.test.ts` fails when a mounted
route is missing or the `Role` enum drifts.

## Flow map

How a request moves through the layers -- the OpenAPI doc covers *what* each
endpoint accepts and returns.

### Every request, generically

```mermaid
flowchart TD
    Client(["Client (hok-web)"]) -->|"HTTP + Bearer token"| Router["Controller<br/>*.routes.ts"]
    Router --> Auth{"requireAuth"}
    Auth -->|"401 missing/invalid token<br/>403 inactive profile"| ErrorMW["error.middleware.ts"]
    Auth --> Cap{"requireCapability(cap)"}
    Cap -->|"403 role lacks it"| ErrorMW
    Cap --> Validate["validateBody / validateQuery"]
    Validate -->|"400 malformed"| ErrorMW
    Validate --> Service["Service<br/>*.service.ts<br/>(domain rules)"]
    Service --> Repository["Repository<br/>drizzle-*.repository.ts"]
    Repository -->|"Drizzle"| DB[("Postgres")]
    Repository -->|"AuthProvider"| SB[("Supabase Auth")]
    Repository -->|"row"| Mapper["Mapper"]
    Mapper -->|"entity"| Service
    Service -->|"presenter -> DTO"| Router
    Router -->|"JSON response"| Client
    Service -.->|"throws AppError"| ErrorMW
    Repository -.->|"throws AppError"| ErrorMW
    ErrorMW -->|"{ error, code, details?, requestId }"| Client
```

### Login

```mermaid
sequenceDiagram
    participant FE as hok-web (/api/session/login)
    participant API as auth.routes.ts
    participant Svc as AuthService
    participant Repo as DrizzleAuthRepository
    participant AuthP as AuthProvider (Supabase)
    participant DB as Postgres

    FE->>API: POST /auth/login { email, password }
    API->>Svc: login(dto)
    Svc->>Repo: signInWithPassword
    Repo->>AuthP: signInWithPassword [anon client]
    AuthP-->>Svc: tokens (401 AUTH_INVALID_CREDENTIALS if wrong or banned)
    Svc->>Repo: getProfile(userId)
    Repo->>DB: fetchActiveProfile
    alt profile missing or inactive
        Svc->>Repo: signOut(accessToken)
        Svc-->>FE: 403 AUTH_ACCOUNT_DEACTIVATED
    else active
        Svc->>Repo: recordLogin (profiles.last_login_at)
        Svc->>DB: audit auth.login
        API-->>FE: 200 { accessToken, refreshToken, expiresAt, profile }
        FE->>FE: sets session cookies (httpOnly refresh)
    end
```

### Bootstrap (first Admin)

```mermaid
sequenceDiagram
    participant FE as hok-web (/setup)
    participant API as auth.routes.ts
    participant Svc as AuthService
    participant Repo as DrizzleAuthRepository

    FE->>API: GET /auth/bootstrap-status
    Svc->>Repo: countAdmins()
    API-->>FE: { adminExists }
    opt adminExists === false
        FE->>API: POST /auth/bootstrap { email, password, fullName, timeZone? }
        Svc->>Repo: countAdmins() [re-checked]
        alt count > 0
            API-->>FE: 403 AUTH_BOOTSTRAP_ALREADY_DONE
        else count === 0
            Repo->>Repo: authProvider.createUser({ role: admin, timeZone })
            Note over Repo: handle_new_user() creates the profiles row
            API-->>FE: 201 { ok: true }
            FE->>API: POST /auth/login (same credentials)
        end
    end
```

### Create a staff account

```mermaid
sequenceDiagram
    participant Admin as hok-web (Admin, signed in)
    participant API as users.routes.ts
    participant Svc as UsersService
    participant Repo as DrizzleUsersRepository

    Admin->>API: POST /users { email, fullName, role, timeZone?, phone? }
    Note over API: requireAuth + requireCapability(users:manage) + zod
    Svc->>Svc: generatePassword(fullName) -> "Priya-9kQ2Xf7q"
    Svc->>Repo: createUser (authProvider.createUser, email_confirm)
    Note over Repo: trigger copies name / role / time zone into profiles<br/>(duplicate email -> 409 USER_EMAIL_TAKEN)
    opt phone given
        Svc->>Repo: updateProfile({ phone })
    end
    API-->>Admin: 201 { userId, password }
    Note over Admin: password shown once; the Admin passes it on
```

### Regenerate a password

```mermaid
sequenceDiagram
    participant Admin as hok-web (Admin)
    participant API as users.routes.ts
    participant Svc as UsersService
    participant Repo as DrizzleUsersRepository

    Admin->>API: POST /users/:id/generate-password
    Svc->>Repo: findById(id)
    alt target is the caller, or an admin who has signed in
        API-->>Admin: 403 USER_PASSWORD_SELF_MANAGED
    else any other account
        Svc->>Repo: setPassword(id, generated)
        API-->>Admin: 201 { password }
    end
```

### Deactivate / reactivate

```mermaid
sequenceDiagram
    participant Admin as hok-web (Admin)
    participant API as users.routes.ts
    participant Svc as UsersService
    participant Repo as DrizzleUsersRepository

    Admin->>API: POST /users/:id/deactivate
    alt id is the caller
        API-->>Admin: 400 USER_CANNOT_DEACTIVATE_SELF
    else
        Svc->>Repo: updateProfile({ active: false })
        Svc->>Repo: banAuthUser (sign-in, refresh and live tokens refused)
        API-->>Admin: 204
    end
    Admin->>API: POST /users/:id/reactivate
    Svc->>Repo: updateProfile({ active: true }) + unbanAuthUser
    API-->>Admin: 204
```

### Edit a client (optimistic lock + row scope)

```mermaid
sequenceDiagram
    participant FE as hok-web (manager or Admin)
    participant API as clients.routes.ts
    participant Svc as ClientsService
    participant Repo as DrizzleClientsRepository
    participant DB as Postgres

    FE->>API: PATCH /clients/:id { fields…, version }
    Note over API: requireAuth + requireCapability(clients:write) + zod
    API->>Svc: update(caller, id, dto)
    Svc->>Repo: update(id, guard)
    Repo->>DB: BEGIN; SELECT … FOR UPDATE OF clients
    alt no row, or another manager's client
        Repo-->>FE: 404 CLIENT_NOT_FOUND
    else version differs
        Repo-->>FE: 409 CLIENT_MODIFIED (reload)
    else archived
        Repo-->>FE: 409 CLIENT_ARCHIVED
    else contract end before start (merged with stored dates)
        Repo-->>FE: 400 CLIENT_CONTRACT_DATES_INVALID
    else ok
        Repo->>DB: UPDATE … version = version + 1; COMMIT
        Svc->>DB: audit client.updated { fields }
        API-->>FE: 200 { client } (new version)
    end
```

### Reassign a client (Admin)

```mermaid
sequenceDiagram
    participant Admin as hok-web (Admin)
    participant API as clients.routes.ts
    participant Svc as ClientsService
    participant Repo as DrizzleClientsRepository

    Admin->>API: POST /clients/:id/reassign { ownerId, version? }
    Note over API: requireCapability(clients:reassign) -- managers 403
    Svc->>Repo: findOwnerCandidate(ownerId)
    alt not an active admin / SMM / MM
        API-->>Admin: 400 CLIENT_OWNER_INVALID
    else valid
        Svc->>Repo: update(id, guard) [FOR UPDATE; version check]
        alt already the owner
            API-->>Admin: 200 { client } (unchanged, no audit)
        else
            Repo->>Repo: owner_id = new owner, version + 1
            Svc->>Svc: audit client.reassigned { from, to }
            API-->>Admin: 200 { client }
            Note over Admin: the old owner now gets 404 on this client
        end
    end
```

### Move an event's stage

```mermaid
sequenceDiagram
    participant FE as hok-web (manager or Admin)
    participant API as events.routes.ts
    participant Svc as EventsService
    participant Repo as DrizzleEventsRepository
    participant DB as Postgres

    FE->>API: POST /events/:id/stage { stageId, note?, visibleToClient?, version }
    Note over API: requireAuth + requireCapability(events:write) + zod
    Svc->>Repo: moveStage(id, guard, entry)
    Repo->>DB: BEGIN; SELECT event + client FOR UPDATE OF events; SELECT its stages
    alt not visible (another manager's client)
        Repo-->>FE: 404 EVENT_NOT_FOUND
    else stale version / client archived / not active / same stage
        Repo-->>FE: 409 EVENT_MODIFIED / CLIENT_ARCHIVED / EVENT_NOT_ACTIVE / EVENT_STAGE_UNCHANGED
    else stage of another event
        Repo-->>FE: 400 EVENT_STAGE_INVALID
    else ok
        Repo->>DB: UPDATE events SET current_stage_id, version + 1
        Repo->>DB: INSERT event_stage_history (from, to, note, visible_to_client, changed_by); COMMIT
        API-->>FE: 200 { event } (stages, history, new version)
    end
```

### Password reset

```mermaid
sequenceDiagram
    participant FE as hok-web
    participant API as auth.routes.ts
    participant SB as Supabase Auth

    FE->>API: POST /auth/password-reset-request { email }
    API->>SB: resetPasswordForEmail(email, redirectTo=WEB_APP_URL/auth/callback?next=/update-password)
    API-->>FE: 204 (always)
    SB-->>FE: reset email (local: the mail-testing UI on :54424)
    FE->>API: POST /auth/exchange-code { code } (PKCE) -> session
    FE->>API: POST /auth/password-update { newPassword }
    API-->>FE: 204
```

### Route map -- every endpoint, at a glance

All paths are under `/api/v1`.

| Method & path | Auth | Capability | Controller | Service method | Repository method |
| --- | --- | --- | --- | --- | --- |
| GET `/auth/me` | bearer | -- | auth.routes.ts | (none -- `req.profile` from middleware) | -- |
| PATCH `/auth/me` | bearer | -- (own profile) | auth.routes.ts | `updateOwnProfile` | `updateOwnProfile`, `getProfile` |
| GET `/auth/bootstrap-status` | none | -- | auth.routes.ts | `getBootstrapStatus` | `countAdmins` |
| POST `/auth/bootstrap` | none (rate-limited) | -- | auth.routes.ts | `bootstrap` | `countAdmins`, `createAdminUser` |
| POST `/auth/login` | none (rate-limited) | -- | auth.routes.ts | `login` | `signInWithPassword`, `getProfile`, `recordLogin` |
| POST `/auth/refresh` | none (rate-limited) | -- | auth.routes.ts | `refresh` | `refreshSession`, `getProfile` |
| POST `/auth/logout` | bearer | -- | auth.routes.ts | `logout` | `signOut` |
| POST `/auth/password-reset-request` | none (rate-limited) | -- | auth.routes.ts | `requestPasswordReset` | `requestPasswordReset` |
| POST `/auth/password-update` | bearer (rate-limited) | -- | auth.routes.ts | `updatePassword` | `updatePassword` |
| POST `/auth/exchange-code` | none (rate-limited) | -- | auth.routes.ts | `exchangeCode` | `exchangeCodeForSession`, `getProfile` |
| GET `/users` | bearer | `users:manage` | users.routes.ts | `listUsers` | `findMany`, `countMany` (search, role, paged, max 100) |
| GET `/users/:id` | bearer | `users:manage` | users.routes.ts | `getUser` | `findById` |
| POST `/users` | bearer | `users:manage` | users.routes.ts | `createUser` | `createUser`, `updateProfile` (phone) |
| PATCH `/users/:id` | bearer | `users:manage` | users.routes.ts | `updateUser` | `findById`, `updateProfile`, `banAuthUser`/`unbanAuthUser` (when `active` flips) |
| POST `/users/:id/generate-password` | bearer | `users:manage` | users.routes.ts | `generatePassword` | `findById`, `setPassword` |
| POST `/users/:id/deactivate` | bearer | `users:manage` | users.routes.ts | `deactivateUser` | `findById`, `updateProfile`, `banAuthUser` |
| POST `/users/:id/reactivate` | bearer | `users:manage` | users.routes.ts | `reactivateUser` | `findById`, `updateProfile`, `unbanAuthUser` |
| GET `/clients` | bearer | `clients:read` (own for SMM/MM) | clients.routes.ts | `list` | `findMany`, `countMany` (search, status, industry, ownerId; paged, max 100) |
| GET `/clients/:id` | bearer | `clients:read` (own; else 404) | clients.routes.ts | `get` | `findById` |
| POST `/clients` | bearer | `clients:write` (`ownerId` Admin only) | clients.routes.ts | `create` | `findOwnerCandidate` (if `ownerId`), `create` |
| PATCH `/clients/:id` | bearer | `clients:write` (own; else 404) | clients.routes.ts | `update` | `update` (locked, guarded) |
| POST `/clients/:id/archive` | bearer | `clients:write` (own; else 404) | clients.routes.ts | `archive` | `update` (locked, guarded) |
| POST `/clients/:id/unarchive` | bearer | `clients:write` (own; else 404) | clients.routes.ts | `unarchive` | `update` (locked, guarded) |
| POST `/clients/:id/reassign` | bearer | `clients:reassign` (Admin) | clients.routes.ts | `reassign` | `findOwnerCandidate`, `update` (locked, guarded) |
| GET `/stage-templates` | bearer | `events:read` (managers: active only) | stage-templates.routes.ts | `list` | `findMany` (+ batched stages), `countMany` (max 100) |
| GET `/stage-templates/:id` | bearer | `events:read` (inactive → 404 for managers) | stage-templates.routes.ts | `get` | `findById` |
| POST `/stage-templates` | bearer | `stage_templates:manage` | stage-templates.routes.ts | `create` | `create` |
| PATCH `/stage-templates/:id` | bearer | `stage_templates:manage` | stage-templates.routes.ts | `update` | `update` (locked, guarded; replaces stages) |
| GET `/events` | bearer | `events:read` (own clients for SMM/MM) | events.routes.ts | `list` | `findMany`, `countMany` (clientId, ownerId, from/to, state, type, search; max 200) |
| GET `/events/:id` | bearer | `events:read` (own; else 404) | events.routes.ts | `get` | `findDetail` |
| POST `/events` | bearer | `events:write` (own client; else 404) | events.routes.ts | `create` | `findClient`, `findTemplate`, `findActiveProfileIds`, `create` (client locked FOR SHARE) |
| PATCH `/events/:id` | bearer | `events:write` (own; else 404) | events.routes.ts | `update` | `findActiveProfileIds`, `update` (locked, guarded) |
| POST `/events/:id/stage` | bearer | `events:write` (own; else 404) | events.routes.ts | `moveStage` | `moveStage` (locked, guarded, + history) |
| GET `/assets` | bearer | `assets:read` (own clients for SMM/MM) | assets.routes.ts | `list` | `findMany` (+ page tags), `countMany` (clientId, eventId, ownerId, search, type, tag, from/to; max 100) |
| GET `/assets/tags` | bearer | `assets:read` | assets.routes.ts | `suggestTags` | `suggestTags` |
| GET `/assets/:id` | bearer | `assets:read` (own; else 404) | assets.routes.ts | `get` | `findById` |
| POST `/assets` | bearer | `assets:write` (own client; else 404) | assets.routes.ts | `create` | `findClient`, `findEvent`, `create` (client locked FOR SHARE) |
| PATCH `/assets/:id` | bearer | `assets:write` (own; else 404) | assets.routes.ts | `update` | `findEvent`, `update` (locked, guarded) |
| DELETE `/assets/:id` | bearer | `assets:write` (own; else 404) | assets.routes.ts | `remove` | `update` (locked, guarded; soft delete) |
| GET `/clients/:clientId/todos` | bearer | `clients:read` (own clients for SMM/MM; else 404) | client-todos.routes.ts | `list` | `findClient`, `findMany`, `countMany` (status, priority, overdue, dueFrom/dueTo, search; max 100) |
| POST `/clients/:clientId/todos` | bearer | `clients:write` (own client; else 404) | client-todos.routes.ts | `create` | `findClient`, `findEvent`, `create` (client locked FOR SHARE), `findById` |
| PATCH `/client-todos/:id` | bearer | `clients:write` (own; else 404) | client-todos.routes.ts | `update` | `findEvent`, `update` (locked, guarded) |
| DELETE `/client-todos/:id` | bearer | `clients:write` (own; else 404) | client-todos.routes.ts | `remove` | `update` (locked, guarded; hard delete) |
| GET `/staff-tasks` | bearer | `staff_tasks:read` (own for non-admins) | staff-tasks.routes.ts | `list` | `findMany`, `countMany` (status, open, priority, overdue, dueFrom/dueTo, search; Admin: assigneeId, role, clientId; max 100) |
| GET `/staff-tasks/:id` | bearer | `staff_tasks:read` (own; else 404) | staff-tasks.routes.ts | `get` | `findDetail` (+ timeline, event title) |
| POST `/staff-tasks` | bearer | `staff_tasks:assign` (Admin) | staff-tasks.routes.ts | `create` | `findAssigneeCandidate`, `findClient`, `findEvent`, `create` (+ "created" entry) |
| PATCH `/staff-tasks/:id` | bearer | `staff_tasks:assign` (Admin) | staff-tasks.routes.ts | `update` | `findAssigneeCandidate`, `findClient`, `findEvent`, `update` (locked, guarded; + "reassigned" entry) |
| DELETE `/staff-tasks/:id` | bearer | `staff_tasks:assign` (Admin) | staff-tasks.routes.ts | `delete` | `delete` (locked) |
| POST `/staff-tasks/:id/status` | bearer | `staff_tasks:update` (own; else 404) | staff-tasks.routes.ts | `changeStatus` | `update` (locked, guarded; + "status" entry) |
| POST `/staff-tasks/:id/reopen` | bearer | `staff_tasks:assign` (Admin) | staff-tasks.routes.ts | `reopen` | `update` (locked, guarded; + "reopened" entry) |
| GET `/reports/team-status` | bearer | `dashboard:global` (Admin) | reports.routes.ts | `teamStatusPage` | `teamStatus`, `teamStatusCount` (search, role, status, paged max 50) |
| GET `/reports/staff` | bearer | `dashboard:global` (Admin) | reports.routes.ts | `staffReport` | `person`, `staffFigures` (month in the viewer's zone, last 6 only) |
| GET `/reports/client` | bearer | `dashboard:global` (Admin) | reports.routes.ts | `clientReport` | `client`, `clientFigures` (month in the viewer's zone, last 6 only) |
| POST `/staff-tasks/:id/comments` | bearer | `staff_tasks:update` (own; else 404) | staff-tasks.routes.ts | `comment` | `addComment` |

Not in the API (outside `/api/v1`): `GET /health`, `GET /health/ready`, `GET /api-docs`.

## Keeping this documentation in sync

When any change touches a route, DTO, auth flow, RBAC rule or module
boundary, update **all** of these together:

1. **This README** -- directory tree, layer notes, RBAC, the Flow Map and route map, env vars.
2. **`openapi.yaml`** -- the path, request/response schema and description (the drift test catches a missing route, not a wrong shape).
3. **`tests/rbac-matrix.mjs`** and the query-budget test, for new endpoints and lists.
4. **hok-web's README** (owned by the web side) -- if the change affects how the frontend calls this API.

None of these is generated from the others -- the same accepted trade-off as
"No shared package, on purpose".

## Environment variables

See `.env.example` (every variable is commented there). Validated at startup
by `src/config/env.ts`; a bad value stops the process with a clear message.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `API_PORT` | `4100` | Listen port (needleye uses 4000) |
| `DATABASE_URL` | -- (required) | Plain Postgres connection string; the real DB seam. Local: `postgres://postgres:postgres@127.0.0.1:54422/postgres` |
| `SUPABASE_URL` | -- (required) | Local: `http://127.0.0.1:54421`. Read only by `SupabaseAuthProvider` |
| `SUPABASE_SERVICE_ROLE_KEY` | -- (required) | Server-only, never exposed |
| `SUPABASE_ANON_KEY` | -- (required) | Also server-only here (hok-web never sees a Supabase key) |
| `CORS_ALLOWED_ORIGIN` | `http://localhost:3400` | Exact allow-list, comma-separated |
| `WEB_APP_URL` | `http://localhost:3400` | Builds the password-reset link (and, from M8, portal links) |
| `LOG_LEVEL` | `info` | `fatal` `error` `warn` `info` `debug` `trace` |
| `SLOW_QUERY_MS` | `250` | Slow-query warning threshold |
| `DB_POOL_MAX` | `10` | Postgres pool size |
| `AUTH_RATE_LIMIT_WINDOW_MS` / `AUTH_RATE_LIMIT_MAX` | `900000` / `30` | `/auth/*` brute-force limiter |
| `TRUST_PROXY` | `loopback` | Express `trust proxy`; in production the exact hop count |
| `DEFAULT_TIMEZONE` | `Asia/Kolkata` | Default IANA zone for new users (and, later, clients) |

Planned: `PORTAL_RATE_LIMIT_*` (M8), `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (M9).

## Deployment

**Local machine only for now** -- production (Railway for this API, hosted
Supabase, Vercel for hok-web) is deferred until Phase 1 runs locally
(`../docs/ARCHITECTURE.md` §16). No production action is taken without the
user asking for it.

`.github/workflows/ci.yml` runs two jobs on every push/PR:

- **`build`**: install, lint, typecheck, unit tests, `npm run build`, and a Docker image build (verification only).
- **`integration`**: starts the same local Supabase stack with the pinned CLI (`supabase start` applies `supabase/migrations/`), writes `.env` from `supabase status`, and runs `npm run test:integration`.

When production is planned, it follows needleye's path: the least-privileged
runtime DB role, the Session-mode pooler, `TRUST_PROXY` set to the platform's
hop count, `db push --dry-run` before `db push`, and `npm run test:rbac`
against the deployed API as proof.
