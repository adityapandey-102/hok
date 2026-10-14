# Integration tests

Real Postgres, real Supabase Auth (GoTrue), real Express app in-process --
nothing mocked. This is the middle layer of the testing pyramid (see
`CLAUDE.md`): repository <-> database, service <-> repository,
authentication, and API-endpoint coverage.

## Prerequisites

HOK's local Supabase stack must be running (same as local dev), from `hok-api/`:

```
npx supabase@2.119.0 start -x imgproxy,edge-runtime,logflare,vector
```

`.env` must point at it (the checked-in `.env.example` defaults already match
HOK's ports, 54421/54422; only the two keys need filling in).

## Running

```
npm run test:integration
```

`vitest.integration.config.ts` sets `LOG_LEVEL=error` (as CI does), so a
run prints the test results rather than one access-log line per request.

Each file creates its own fixture users (via `authProvider.createUser`
directly, the same bypass-the-Application-layer pattern `src/db/seed.ts`
uses) and tears them down in `afterEach`/`afterAll` -- no dependency on
`npm run seed` having been run first, and safe to run repeatedly against the
same local database. Fixtures sign in through `bearerFor()` (the provider
directly), not `POST /auth/login`, so setup doesn't spend the in-memory
`/auth/*` rate-limit budget.

## Files

| File | Covers |
|---|---|
| `foundation.integration.test.ts` | Health/readiness, the standard error shape, the profiles trigger and role check |
| `auth.integration.test.ts` | `SupabaseAuthProvider` (sign-in, verify, ban, duplicate email → 409), `fetchActiveProfile`, and `/auth/*`: login bookkeeping (`last_login_at` + audit row), `/me` read and self-edit (validation, role can't be changed), logout revokes the refresh token, refresh, deactivated token → 403, bootstrap gate, reset-request always 204 |
| `users.integration.test.ts` | `/users/*` as Admin: paging + clamp, search + role filter, get / 404, create (generated password signs in; time zone + phone saved; duplicate email 409), edit, Admin self-protection, deactivate/reactivate at the auth layer, password regeneration rules |
| `clients.integration.test.ts` | `/clients/*` (needs migration 20261013000003): create (owner = creator, normalised fields, Admin-for-manager, owner rules), field validation, row scope (manager list pinned; another manager's client is 404 on read and every write), optimistic lock (409), archive/unarchive and the default list, reassign (+ audit row), filters/paging, DB CHECK constraints |
| `query-budget.integration.test.ts` | No N+1 (a page of 50 costs the same queries as a page of 5) and capped page sizes, for every list endpoint |

The per-role HTTP check is `tests/rbac-matrix.mjs` (`npm run test:rbac`), run
against the live API rather than in-process.
