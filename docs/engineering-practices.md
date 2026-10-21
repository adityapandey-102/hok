# Engineering practices — hok-api

This is the rulebook for the API and database: what we do, and **why**. Each
rule is either already true everywhere in the code, or backed by a check that
fails when it is broken. The web app has its own page
(`hok-web/docs/engineering-practices.md`). Adapted from needleye-api's.

**Scale we design for:** about 20–50 staff, 100–500 clients, one firm, several
time zones. After 3 years that is roughly 500 clients, 10–20k events, 100k
event stage moves, 30k staff tasks, tens of thousands of client comments and
a few hundred thousand audit / notification rows. Every query must stay fast
at that size. (A volume-based query audit, needleye's `npm run test:perf`,
arrives in M11; until then the query budget below is the check.)

---

## 1. Database queries

| Practice | Why | Where / how it's enforced |
| --- | --- | --- |
| **Every list is paginated and the page size is capped** (users ≤ 100, clients ≤ 100, stage templates ≤ 100, assets ≤ 100, staff tasks ≤ 100, client to-dos ≤ 100, tag suggestions ≤ 50, events ≤ 200 -- a month of calendar at once; calendar ranges ≤ 92 days; every later list states its cap here). | Without a cap, one request can fetch the whole table: slow for that user, and it takes a database connection from everyone else. | Query DTOs clamp or refuse the limit; `tests/integration/query-budget.integration.test.ts` asserts that an over-large `limit` is clamped or refused. |
| **No N+1 queries.** A list page takes the same number of queries for 5 rows as for 50. | N+1 means one query per row, so a 50-row page costs 51 round trips. It looks fine in development and falls over in production. | Relational `with:` loads, `inArray(ids)` batches, one grouped query. The query-budget test counts queries at the pool for page 5 vs page 50. |
| **Aggregate in SQL, not in Node** (`count(*) filter (where …)`, `sum`, `group by`). | Fetching rows only to count them in JavaScript moves every row over the network. | Dashboards (M10), list totals (`countMany`). |
| **Index what we filter, join and sort on**, including *partial* indexes for "the small live part of a growing table". | An index turns "read every row" into "read the few rows that match". A partial index stays small as history grows. | See the index list below. |
| **Bound work by the live set, not by history.** E.g. open tasks, upcoming events, unsolved comments; "latest stage move per event" through `LATERAL … LIMIT 1`. | Done tasks, past events and old history grow forever; the live set stays small. A query that reads history gets slower every month. | Partial indexes per module, added with the module. |
| **No correlated subquery per output row when one grouped pass works.** | It rescans per row; one grouped pass is orders of magnitude cheaper at volume. | Review. |
| **`LIKE` wildcards in user input are escaped**; trigram indexes only where a table is big enough to need one. | A search for "50%" must not match everything. `profiles` (≤ 50 rows) needs no trigram index; `clients.business_name` has one (M3); assets decide when the module lands. | `common/database/like-pattern.ts` (`containsPattern`). |
| **Everything parameterised.** No user input is ever concatenated into SQL. | This prevents SQL injection. The only inlined fragments are code constants. | `sql\`…${value}…\`` binds values; review. |
| **Lazy, on-demand reads.** Load one calendar range, one client, one inbox page when it is asked for, never "everything, just in case". | Most of what a page *could* show is never looked at. | Calendar feeds take an explicit range (M5). |

### Index inventory (and what each is for)

| Index | Serves |
| --- | --- |
| `profiles (role)` | Bootstrap's "does an admin exist", the users list's role filter |
| `profiles (calendar_feed_token_hash)` unique, partial (`where … is not null`) | The public calendar feed's lookup by token hash (FR-CAL-08); only people with a link are indexed |
| `audit_log (created_at desc)`, `(entity_type, entity_id)`, `(actor_id, created_at desc)` | Activity views, an entity's history, "last seen" per person |
| `clients (owner_id, created_at desc, id desc)` | A manager's client list (newest first), the Admin's owner filter, the `owner_id` FK check |
| `clients (status, created_at desc, id desc)` | The Admin's all-clients list and the status filter (default list = `status <> 'archived'`) |
| `clients (lower(industry))` | Industry filter (case-insensitive exact match) |
| `clients using gin (business_name gin_trgm_ops)` | Client name search (`ILIKE '%term%'`, escaped by `containsPattern`) |
| `stage_templates (lower(name))` unique, `(active, lower(name))` | Name uniqueness; the managers' active-template picker |
| `stage_template_stages (template_id, position)` unique | A template's ordered stages (batched for a whole page) |
| `events (client_id, starts_at)` | A client's Events tab |
| `assets (client_id, created_at desc, id desc) where deleted_at is null` (+ `(client_id, type, created_at desc)`, `(created_at desc, id desc)`, `(event_id)`, same predicate) | A client's Assets tab, type filter, the Admin's all-assets list, assets of an event |
| `assets` GIN trigram on `title` and `comment`; `tags` GIN trigram on `name`; unique `tags (client_id, lower(name))`; `asset_tags (tag_id, asset_id)` | Asset search (title, comment, tag), reusable per-client tags, tag filter and suggestion counts |
| `client_todos (client_id, created_at desc, id desc)`, partial `(client_id, due_at) where status <> 'done'` (the live set), partial `(due_at) where status <> 'done' and due_at is not null`, partial `(event_id)`, partial `(created_by)` | A client's To-dos tab (done / all, open by due date, overdue), firm-wide due-soon for dashboards, FK indexes |
| `events (starts_at)` | Calendar ranges; bounded below by `from - 31 days` (no event lasts longer), so the scan stays the range's size |
| `event_stages (event_id, position)` unique, `(id, event_id)` unique | An event's stages in order; target of the current-stage composite FK |
| `event_stage_history (event_id, created_at desc)` | An event's history, newest first (detail shows the last 100) |
| `staff_tasks (assignee_id, created_at desc, id desc)` | "My tasks" (every assignee's whole list), the Admin's assignee filter, the RESTRICT FK check |
| `staff_tasks (assignee_id, due_at) where status <> 'done'`, `staff_tasks (due_at) where status <> 'done'` | The **live set**: an assignee's open tasks by due date, firm-wide overdue / due-soon (overdue filter, M10 dashboards). Done tasks never enter these indexes, so they stay small as history grows |
| `client_comments (client_id, created_at desc)`, `(status, created_at desc) where status <> 'solved'` | A client's comments; the open inbox and its counts (live set). Inbox `search` (comment text or client name, `ILIKE` escaped by `containsPattern`) runs inside that scope (a manager's own clients, or the open set) and has **no trigram index on purpose**: add `gin (body gin_trgm_ops)` only if the Admin's solved-history search gets slow |
| **Every foreign key** (migration `20261017000001`): partial `where … is not null` indexes on the nullable "who did it" / "came from" links (`created_by`, `assigned_by`, `template_id`, `from/to_stage_id`, `from/to_assignee_id`, `portal_link_id`, `replied_by`, `actor_id`); `(changed_by, created_at desc)` on `event_stage_history` and `(author_id, created_at desc)` on `staff_task_updates` | Parent deletes / SET NULL never scan a whole child table; Phase 2 reports and the activity log read "what did this person do, newest first" as one index range. Rule from now on: **every new foreign key ships with its index** |
| `staff_tasks (status, created_at desc, id desc)` | The Admin's status filter and each Kanban column (one query per status) |
| `staff_tasks (client_id) where client_id is not null`, `(event_id) where event_id is not null` | Client filter; the `ON DELETE SET NULL` FKs. Priority (4 values) has no index on purpose: too unselective, always combined with another filter |
| `event_stage_history`, `staff_task_updates`, `client_comment_history`, `client_comments` `(created_at desc)` (migration `20261021000001`) | The Admin activity log (`GET /activity`, page cap 50): each source of the UNION ALL is a created_at range scan, so the feed reads only the requested window |
| `staff_task_updates (task_id, created_at desc, id desc)` | A task's timeline, newest first (detail shows the last 100) |

Every later module adds its rows here in the same change as its migration.

---

## 2. Correctness and concurrency

| Practice | Why |
| --- | --- |
| **Instants are `timestamptz` (UTC); every user, client and event carries an IANA time zone** (REQUIREMENTS NFR-08). A "day" is always *someone's* day: the viewer's for calendars, the client's on the portal. Zones are validated with `isValidTimeZone` (named zones only; raw offsets like `+05:30` are refused because they carry no daylight-saving rules). | Time-zone and daylight-saving bugs shift events by hours or days. |
| **Rules that must hold under concurrency run inside the transaction, after the row lock** (guard-callback pattern; e.g. event stage moves in M4). | A check made before the lock can be stale by the time you write. |
| **Optimistic locking (`version` column → 409) on records two people edit**: clients (M3, `409 CLIENT_MODIFIED`, ADR 0005), stage templates and events (M4, `STAGE_TEMPLATE_MODIFIED` / `EVENT_MODIFIED`, ADR 0006). | Two people editing the same record can't silently overwrite each other. |
| **Critical enums are also `CHECK` constraints in the database** (roles today; event/comment/task statuses as they land). | The database is the last line of defence. |
| **Snapshot what must not change retroactively**: an event copies its stage template's stages (REQUIREMENTS: stages used as-is). | Editing a template must not rewrite live events' history. |

## 3. Security

| Practice | Why |
| --- | --- |
| **RBAC is enforced in the API** (capability matrix + row scope + RLS as defence in depth). The web only hides buttons. | Anyone can call the API directly; UI checks are not security. `npm run test:rbac` checks every endpoint × all six roles (74 checks at M2, 124 at M3; M4 adds templates and events). |
| **Row scope for managers**: a Social Media / Marketing Manager only ever reads or writes their own clients (and everything under them); a miss is a 404, never a 403 that confirms the record exists. | Ownership is the core privacy rule of the product. |
| **Validate every input with zod at the edge; parse queries strictly** (400 on a bad role / non-numeric limit, never silently use a default). | A silent fallback shows the wrong data with no error. |
| **Rate-limited auth (and, from M8, the public portal); `TRUST_PROXY` = number of proxies in production.** | Brute-force protection only works when it keys on the real client IP. |
| **Admins can't lock the firm out**: no changing your own role, no deactivating yourself. | Guarantees at least one active Admin. |
| **Generated passwords are shown once; portal tokens are stored only as SHA-256 hashes.** | A leaked database never yields a usable credential. |
| **Secrets are server-only; logs redact tokens and passwords; the audit log records who did what.** | Accountability without leaking credentials. |
| **Least-privilege database role in production** (needleye's ADR 0006; planned with production). | A bug or injection can't drop tables. |

## 4. Errors, logging, operations

- **Typed `AppError`s with stable codes**, for example `USER_CANNOT_DEACTIVATE_SELF`. One error middleware turns them into JSON, and unknown errors become a generic 500. *Why:* clients branch on codes, not message text, and internals never leak.
- **pino structured logs with request IDs, plus slow-query warnings** (`SLOW_QUERY_MS`, default 250 ms) and DB-error tracing that never logs row values. *Why:* a problem can be traced from one request ID.
- **Pool size is configurable** (`DB_POOL_MAX`). **Health endpoint and graceful shutdown.**

## 5. Architecture

- **Feature modules with api / application / domain / infrastructure layers** (ADR 0001); ports and repositories (ADR 0002); per-module schema ownership (ADR 0003); HOK's own foundations (ADR 0004).
- **Business rules live in `domain/` as pure functions**, unit tested without a database.
- **No shared package with the web.** Each repo keeps its own copy of the rules, and the contract is `openapi.yaml`. `src/docs/openapi.test.ts` fails if its enums drift from the code or a mounted route is undocumented.

## 6. Migrations

- Hand-written SQL in `supabase/migrations/`, applied with the pinned Supabase CLI; each module's Drizzle `*.schema.ts` mirrors its tables for typed queries (ADR 0004).
- Only add new, timestamped files; never edit one that has been applied anywhere.
- Apply to **local first**, test everything, and only then to production (when it exists: `npx supabase@2.119.0 db push --dry-run`, then `db push`, only when the user asks).
- Prefer migrations that only *loosen* rules or *add* indexes, because they are safe to apply before the code ships.

## 7. Testing and the release checklist

The testing pyramid: many unit tests, fewer integration tests, and end-to-end tests only for critical flows.

**Run before every release (all on the local stack):**

| Command | Checks |
| --- | --- |
| `npm run typecheck && npm run lint && npm run build` | Code compiles and is clean |
| `npm run test:unit` | Domain rules, services against fakes, the OpenAPI drift check |
| `npm run test:integration` | Real database + auth behaviour, including the **query budget** (no N+1, capped pages) |
| `SEED_ADMIN_PASSWORD=… npm run test:rbac` | Who can call what (every endpoint × six roles) |

**When you add a new list, search or report:** add it to `lists` in the query-budget test, and state its page cap in §1.
**When you add an endpoint:** document it in `openapi.yaml` (the drift test fails otherwise), add its cases to `tests/rbac-matrix.mjs`, and add it to the README's route map.
