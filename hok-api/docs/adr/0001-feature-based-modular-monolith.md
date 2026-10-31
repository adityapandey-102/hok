# 0001: Feature-Based Modular Monolith with Clean Architecture per module

## Status

Accepted (2026-10-13). Inherited from needleye-api's ADR 0001, where it was proven over a full production cycle. Applied from HOK's first module (`auth`, `users`, M2).

## Context

HOK is one firm's internal agency-management API: ~20–50 staff, 100–500 clients, a dozen business capabilities (clients, stage templates, events, calendars, asset links, client portal, comments, staff tasks, notifications, dashboards). needleye-api, built by the same team for a similar-sized business, started as a flat monolith and had to be converted because business rules ended up inline in services (untestable without a database) and repository files mixed the contract with the Drizzle adapter. HOK starts from the end state instead of repeating the conversion.

## Decision

One deployable Express process, split into business-capability modules under `src/modules/*`. Each module has four sub-folders, dependencies pointing inward:

```
modules/<name>/
  api/            controllers (*.routes.ts, also the composition root), request/response DTOs, presenters (entity -> DTO)
  application/    use-case orchestration (*.service.ts), repository ports (interfaces)
  domain/         entities, pure business-rule functions -- zero framework/persistence knowledge
  infrastructure/ concrete adapters (Drizzle repository, this module's *.schema.ts, persistence mappers)
```

- **Domain depends on nothing.** No imports from `application/`, `infrastructure/`, `express` or `drizzle-orm`.
- **Application depends on Domain** and declares the ports Infrastructure must satisfy. Never imports Drizzle or a concrete adapter.
- **Infrastructure depends on Domain and Application's ports.**
- **API depends on Application only** -- controllers never touch a repository or Drizzle.
- Cross-cutting code lives in `src/common/*` (errors, logging, request context, auth provider, audit, middleware, database client); the shared vocabulary (roles, capability matrix, `Profile`, time-zone and contact validation) in `src/domain/`.

## Consequences

- Every module has the same shape regardless of size; consistency beats trimming files for small modules.
- A lookup-shaped module may have a near-empty `domain/`. That is honest, not a sign the pattern doesn't fit.
- Business rules are pure functions with unit tests -- the base of the testing pyramid (see `CLAUDE.md`).
- No microservices, queues or event bus (`CLAUDE.md` "Keep it simple"). If a module ever needs to scale independently, its boundaries are already drawn.
