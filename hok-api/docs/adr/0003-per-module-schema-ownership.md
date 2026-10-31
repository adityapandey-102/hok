# 0003: Each module owns its own Drizzle schema; cross-module reads stay Infrastructure-to-Infrastructure only

## Status

Accepted (2026-10-13). Inherited from needleye-api's ADR 0003, which got here by deleting a shared "god" `schema.ts`. HOK never had one.

## Context

A single shared schema file grows without bound and couples every module to every other. But some cross-module reads are genuinely needed: Auth updates `profiles.last_login_at`; later, Events join a client's owner to scope a manager's calendar, and Staff Tasks join an assignee's name. Replacing such a `JOIN` with calls through another module's service would add round trips (and N+1 risk) for no isolation benefit.

## Decision

- Each module owns the Drizzle definitions of the tables it is the business owner of, in `modules/<name>/infrastructure/<name>.schema.ts` (e.g. `profiles` -> Users, `profile.schema.ts`). Shared infrastructure tables live in `common/` (`audit_log` -> `common/audit/audit-log.schema.ts`).
- `common/database/drizzle-client.ts` aggregates every schema file into the one object Drizzle needs -- pure infrastructure bootstrap. Each new module adds its schema there.
- A module may read or write another module's table **only from its Infrastructure layer, importing the other module's schema file** -- e.g. `drizzle-auth.repository.ts` imports `profiles` from `users/infrastructure/profile.schema.ts`. Every such import carries a comment pointing to this ADR.
- A module's Application or Domain layer never imports another module's. If two modules need the same small rule, each keeps its own copy.
- `fetchActiveProfile` lives in `common/database/profiles.ts` because `requireAuth`, which every module depends on, needs it.

## Consequences

- Module boundaries hold where the business logic is; Infrastructure keeps a small, explicit, commented set of cross-module reads that a single SQL query serves best.
- Two Drizzle definitions of one physical table are never allowed: the drift risk is worse than the coupling.
- The DDL itself is not in these files: see ADR 0004 (hand-written SQL migrations, Drizzle mirrors them).
