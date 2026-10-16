# E2E tests (Playwright)

Critical-workflow coverage only (see CLAUDE.md's testing pyramid), added
milestone by milestone. Not a full click-every-page suite.

| Spec | Covers | Needs |
| --- | --- | --- |
| `portfolio.spec.ts` (M1) | Every portfolio page answers 200 with its heading and no script error; no sideways scroll at 768 / 1280 px; no Font Awesome; the 404 page; the template CSS never reaching `/login` | Only the web app |
| `login-users.spec.ts` (M2) | Admin logs in, creates a user, finds it in the directory, logs out | HOK's local Supabase stack + hok-api (seeded) |
| `assets.spec.ts` (M6) | A manager adds an asset link (bad link refused), finds it by search/tag, edits and deletes it; the Assets page; no Assets nav for tasks-only staff | Supabase + hok-api (migration 20261014100001 applied, seeded) with `rohan.smm`, `neha.agent` and "Chai Point Cafe" |
| `events.spec.ts` (M4) | Admin creates a stage template; a manager creates an event from it and moves its stage with a client-visible note | Supabase + hok-api with the seeded `admin@hok.test`, `rohan.smm@hok.test` and the client "Chai Point Cafe" |
| `staff-tasks.spec.ts` (M7) | The Admin assigns an editor task (raw files link required), the editor finds it in My tasks and moves it to In progress (with a comment) and Done, a developer gets 404 on it, the Admin reopens and deletes it | Supabase + hok-api (migration 20261014200001 applied, seeded) with `admin@hok.test`, `meera.editor`, `arjun.dev` |
| `clients.spec.ts` (M3) | A manager creates and edits a client; another manager cannot see it; a tasks-only role has no client access | Supabase + hok-api with the seeded `rohan.smm`, `sara.smm`, `neha.agent` |

Planned: a client posts a portal
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
- `events.spec.ts` signs in as `admin@hok.test` and `rohan.smm@hok.test`
  (`Hok@2026`, or `E2E_PASSWORD`) and needs the seeded client "Chai Point Cafe".

The config starts a Next.js dev server on the port in `E2E_BASE_URL` (default
3400) itself, or reuses one already running there. With parallel agents, also
set `NEXT_DIST_DIR` (your build folder) and `--output=test-results-<agent>`.

## Running

**Run one spec at a time**: specs share `test-results/`, so two runs at once
overwrite each other's results.

```
npx playwright test e2e/portfolio.spec.ts
npx playwright test e2e/login-users.spec.ts
npx playwright test e2e/clients.spec.ts
npx playwright test e2e/events.spec.ts --output=test-results-screens
npx playwright test e2e/staff-tasks.spec.ts --output=test-results-tasks
```

`npm run test:e2e` runs every spec in turn (the backend must be up).
