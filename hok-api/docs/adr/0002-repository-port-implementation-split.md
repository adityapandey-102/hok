# 0002: Split repository contracts from implementations; domain rules throw the app's one error type

## Status

Accepted (2026-10-13). Inherited from needleye-api's ADR 0002. Applied to every module from M2 (`auth`, `users`).

## Context

A repository that is one file -- `interface XRepository` followed by `class DrizzleXRepository` -- hides which part is the stable contract the Application layer depends on and which is the swappable adapter. Adding a test double means editing the file everything else depends on.

A related question: should a pure domain rule (e.g. `assertNotDeactivatingSelf`) throw a dedicated domain-error type, translated to HTTP somewhere else?

## Decision

**Port/implementation split.** The interface lives in `application/ports/<name>-repository.port.ts`; the concrete class in `infrastructure/drizzle-<name>.repository.ts`. Ports speak in domain-shaped, camelCase, fully typed records (`UserAccountEntity`, `ProfileUpdate`, `NewUserRecord`), never raw rows. Only Infrastructure imports Drizzle. Repositories that also need identity operations (create user, set password, ban) take the `AuthProvider` interface by constructor injection.

**Domain errors.** Domain rule functions throw the codebase's `AppError` subclasses (`BadRequestError`, `ForbiddenError`, ...) with a code from `ERROR_CODES` directly, not a parallel domain-error hierarchy. This API has exactly one delivery mechanism (Express REST); a translation layer would be abstraction with no consumer.

## Consequences

- Services are unit tested against in-memory fakes of the port (`users.service.test.ts`, `auth.service.test.ts`) -- no database, no mocking library.
- A second implementation of a port (a fake, a cache) never touches `application/` or `domain/`.
- If a second delivery mechanism ever appears (a CLI, a background job needing a different error shape), the fix is additive: introduce a domain-error type and translate at each boundary.
