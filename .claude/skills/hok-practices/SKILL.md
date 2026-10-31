---
name: hok-practices
description: HOK engineering and performance rules (agent working rules, pagination caps, no N+1, indexing, RBAC capability + manager row scope, time-zone correctness, stable error codes, audit log, debounced search, server-side paging, bundle budget, needleye design system) plus the pre-release check commands. Use whenever adding or changing an API endpoint, a SQL query or repository method, a migration or index, a list, search box, calendar or report page in hok-api or hok-web, or when asked to review performance, security or prepare a release.
---

# HOK engineering practices

HOK copies needleye-pilot's architecture, conventions and design system
(`D:\Code Space\WorkSpace\needleye-pilot` is a **read-only** reference: read
it for a pattern, never modify it). The full rules and their reasons live in
the repos. Read the relevant one before changing code:

- Agent working rules (asking first, git, production): `HOK/CLAUDE.md` §0. **Read first, every session.**
- API and database: `hok-api/docs/engineering-practices.md`, `hok-api/CLAUDE.md` (charter + definition of done), `hok-api/README.md` (architecture, RBAC, flow map, route map), `hok-api/docs/adr/`
- Web: `hok-web/docs/engineering-practices.md`, `hok-web/AGENTS.md`
- Product: `HOK/docs/REQUIREMENTS.md`, `HOK/docs/ARCHITECTURE.md`, `HOK/docs/DEVELOPMENT-PLAN.md`

## Working rules (short form of `HOK/CLAUDE.md` §0)
- Ask before anything outside the HOK folders: Docker Desktop, containers, `supabase start/stop/db reset/migration up`, other people's processes, credentials, any non-fixture DB write. A helper agent that can't ask doesn't do it; it reports it as "needs approval".
- Never touch other projects in `D:\Code Space\WorkSpace` (needleye-pilot, buyer-file, delight-caters, …), their ports or containers.
- Git: an explicit "yes" right before **every** commit and **every** push. No `Co-Authored-By: Claude` trailer.
- Production (hosted Supabase, Railway, Vercel, `db push`) only when the user asks for that specific action.

## Non-negotiables (check every change against these)

**API and database**
1. Every list endpoint paginates, with a **capped** `limit` (≤ 100), and returns `total`. Parse queries strictly: a bad enum or non-numeric limit is a 400, never a silent default.
2. **No N+1.** A page of 50 must use the same number of queries as a page of 5: batch with `inArray(ids)`, relational `with:`, or a single grouped query.
3. Aggregate **in SQL** (`count(*) filter`, `group by`), never by fetching rows into Node.
4. Every new filter, join or sort column has an index, listed in the engineering-practices index inventory. Queries over tables that grow forever (events, stage moves, tasks, comments, notifications, audit) are bounded by the *live* set: partial indexes (open tasks, upcoming events, unsolved comments), or `LATERAL … LIMIT 1` for "latest per X".
5. No correlated subquery per output row when one grouped pass works.
6. User input is always a bound parameter. `ILIKE` search uses `containsPattern()` (escapes `%` and `_`); a trigram index only where the table is big enough to need one.
7. Instants are `timestamptz` (UTC). Every user, client and event carries an IANA time zone validated by `isValidTimeZone` (named zones only, no raw offsets). A "day" is always someone's day: the viewer's on calendars, the client's on the portal.
8. Rules that must hold under concurrency run inside the transaction, after the lock (guard-callback pattern). Records two people edit (clients, events) get a `version` column → 409.
9. RBAC is enforced in the API: `requireCapability(cap)` **and** the row scope. A Social Media / Marketing Manager only sees their own clients and everything under them; a scope miss is a **404**, never a 403. Marketing Agent, Developer and Editor get staff tasks only. Add every new endpoint to `tests/rbac-matrix.mjs` (all six roles).
10. Errors: throw an `AppError` subclass with a code from `common/errors/error-codes.ts` (add it there first). Clients branch on `code`, never the message. Only the error middleware logs errors.
11. Account and business events go through `AUDIT_ACTIONS` (`common/audit/audit-actions.ts`); never log passwords, tokens, portal tokens or client contact details.
12. Migrations: hand-written SQL in `hok-api/supabase/migrations/`, new timestamped files only, never edit an applied one. **Writing** the file is fine; **applying** it (`npx supabase@2.119.0 migration up`, `db reset`) needs the user's go-ahead. Production only when the user asks, via `db push --dry-run`, then `db push`.
13. Every route change updates `openapi.yaml` (the drift test fails on an undocumented route) and the README's route map in the same change.

**Web**
1. hok-web never calls Supabase directly. It calls hok-api only, and session cookies are set by its own route handlers.
2. Every search box uses `useDebouncedValue(value, SEARCH_DEBOUNCE_MS)` (`lib/hooks/useDebouncedValue.ts`). Debounce the typing only; clicks fetch immediately. Every dropdown over growing data (clients, events, people, templates) is a `SearchSelect` (`components/ui/SearchSelect.tsx`): server search, ≤ 20 rows, never a preloaded list filtered in the browser.
3. Lists are paginated **by the server**, with the shared `Pager`. Never load everything and filter in the browser.
4. Every filter change resets to page 1 in the same event handler, and every fetch effect ignores stale responses (a `cancelled` flag).
5. Load on demand: a calendar range when it's shown, a client when it's opened, an inbox page when it's asked for.
6. Keep first-load JS per page ≤ 300 KB gzipped (`npm run check:bundle`). Think before adding a dependency.
7. Every data view has loading, empty and error states with a retry. Reuse `components/ui/*` (`Modal`, `Pager`, `Card`, `Button`, …) and `components/shell/*`; don't copy-paste.
8. Staff app (`/app`) and portal (`/p/[token]`) use needleye-web's design system **exactly** (`app/globals.css`, Playfair Display + Plus Jakarta Sans, Tailwind v4, lucide-react). The public portfolio (`/`) keeps the ported template's Bootstrap styles in its own `(site)` root layout; the two style worlds never mix. For new UI, also see the `frontend-design` skill.
9. The UI only hides what a role can't do. The API is the security boundary.

## When adding a list, search, calendar or report
- API: add the endpoint to `lists` in `hok-api/tests/integration/query-budget.integration.test.ts`, state its page cap and indexes in `hok-api/docs/engineering-practices.md` §1, and add its RBAC cases. (A volume-based query audit like needleye's `npm run test:perf` arrives in M11.)
- Web: use the debounce hook, the server-side page and `Pager`, and add an e2e step if it's a critical flow (login, create client, create event and move a stage, assign and close a staff task, client portal comment).

## Local environment
HOK's ports are offset from needleye's so both can run: Supabase 54420–54429 (API 54421, Postgres 54422, Studio 54423, mail UI 54424), hok-api **4100**, hok-web **3400**. The Supabase CLI is pinned: always `npx supabase@2.119.0 … -x imgproxy,edge-runtime,logflare,vector`, never a bare `npx supabase`. Seeded logins: `admin@hok.test` and one account per role (see `hok-api/src/db/seed.ts`, local password `Hok@2026`).

## Pre-release checklist (all local)
```bash
# hok-api (local Supabase stack up; API on :4100 for test:rbac)
npm run typecheck && npm run lint && npm run build
npm run test:unit && npm run test:integration          # includes the query budget
SEED_ADMIN_PASSWORD='<local admin password>' npm run test:rbac

# hok-web
npm run typecheck && npm run lint && npm run test:unit
npm run build && npm run check:bundle                   # per-page JS budget
npm run test:e2e                                        # critical flows (see hok-web's README for its env)
```
`test:rbac` signs in several times; `/auth/*` is rate-limited. On a 429 locally, restart the API you started (`touch src/index.ts`) to clear the in-memory counter.

Report results faithfully, with the real pass/fail counts. If a budget or check fails, fix the query or import, or document an intentional exception with its reason. Never raise a budget silently.
