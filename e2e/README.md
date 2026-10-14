# E2E tests (Playwright)

Critical-workflow coverage only (see CLAUDE.md's testing pyramid), added
milestone by milestone. Not a full click-every-page suite.

| Spec | Covers | Needs |
| --- | --- | --- |
| `portfolio.spec.ts` (M1) | Every portfolio page answers 200 with its heading and no script error; no sideways scroll at 768 / 1280 px; no Font Awesome; the 404 page; the template CSS never reaching `/login` | Only the web app |
| `login-users.spec.ts` (M2) | Admin logs in, creates a user, finds it in the directory, logs out | HOK's local Supabase stack + hok-api (seeded) |
| `clients.spec.ts` (M3) | A manager creates and edits a client; another manager cannot see it; a tasks-only role has no client access | Supabase + hok-api with the seeded `rohan.smm`, `sara.smm`, `neha.agent` |

Planned: create event and move its stage (M4), add an
asset link (M6), assign and close a staff task (M7), a client posts a portal
comment and the manager resolves it (M8).

## Prerequisites (for specs that need the backend)

- HOK's local Supabase stack running (`npx supabase@2.119.0 start` in `hok-api`;
  ask the user first, see `../../CLAUDE.md` §0)
- `hok-api` running (`npm run dev`, port 4100), seeded (`npm run seed`)
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`: a local Admin's credentials. They
  default to the seed's `admin@hok.test` / `Hok@2026`.
- `login-users.spec.ts` creates a new `e2e.<timestamp>@hok.test` user on
  every run, and `clients.spec.ts` one "E2E Client <timestamp>" (local
  database only). `clients.spec.ts` signs in as the seeded `rohan.smm`,
  `sara.smm` and `neha.agent` with `Hok@2026` (override with `E2E_PASSWORD`).

The config starts the Next.js dev server (`npm run dev`, port 3400) itself, or
reuses one already running there. Set `E2E_BASE_URL` to test a server on
another port.

## Running

**Run one spec at a time**: specs share `test-results/`, so two runs at once
overwrite each other's results.

```
npx playwright test e2e/portfolio.spec.ts
npx playwright test e2e/login-users.spec.ts
npx playwright test e2e/clients.spec.ts
```

`npm run test:e2e` runs every spec in turn (the backend must be up).
