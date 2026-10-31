@AGENTS.md

# HOK web: project scale & engineering strategy

**Read `../CLAUDE.md` first, especially §0 "Agent working rules".** They are
hard rules for every session and helper agent: ask before any action outside
the HOK folders (Docker, Supabase containers, other people's processes,
credentials, databases), never touch other projects (`needleye-pilot` and
`buyer-file` are read-only sources), get an explicit "yes" before every
`git commit` and every `git push` (no Claude co-author trailer), and never
touch production.

One website for a marketing firm (HOK, House of Khalak): the **public
portfolio** at `/`, the **staff app** at `/app` and the **client portal** at
`/p/[token]`. About 20–50 staff and 100–500 clients. Accuracy,
maintainability and reliability matter far more than extreme scalability.
**Do not overengineer.** Prefer the simplest solution that satisfies the
current requirement while staying extensible.

This repo has no database or backend of its own: it talks to `hok-api` over
HTTP only (see README "No shared package, on purpose"). The Docker,
migration and seed-data parts of the charter live in `hok-api/CLAUDE.md`.
Engineering patterns, the design system and these docs are copied from
`needleye-pilot/needleye-web` (read-only reference).

## Mandatory, non-negotiable

Consistent architecture · clean code · SOLID · high cohesion · low coupling ·
strong validation · consistent error handling · comprehensive documentation.

## Keep it simple

Unless explicitly requested, do **not** introduce: state-management
frameworks beyond what's here, complex caching layers, highly abstract
generic component frameworks, or any of the backend items (Kubernetes,
Redis, queues, …) ruled out in `hok-api/CLAUDE.md`.

**The `modules/` (feature) + `lib/domain/` (independent domain copy) +
`components/ui/` structure is the correct architecture for this project. Keep
improving it, don't replace it.**

## Two root layouts: keep them apart

- `app/(site)/` is the **portfolio**: the HOK HTML template ported as-is
  (Bootstrap + jQuery plugins from `public/site/assets`). It must **never**
  import `app/globals.css`, Tailwind classes or `components/ui/*`.
- `app/(main)/` is the **staff app, sign-in pages and client portal** on
  needleye's design system (`app/globals.css`). It must **never** load
  anything from `public/site/`.
- Inside the portfolio, links stay plain `<a>` (full page loads, so the
  template's jQuery starts fresh on every page). Template files in
  `public/site/assets` are never edited; HOK changes go in
  `public/site/hok-site.css` and `modules/site/`.
- No Font Awesome (the template's copy was a paid Pro licence): portfolio
  icons are Lucide via `modules/site/components/SiteIcon.tsx`.

## Testing strategy (Testing Pyramid: don't test every line equally)

- **Unit tests (highest priority)**: `lib/domain/`: capability matrix, time
  zone and date utilities, zod validation. These should be most of the tests.
- **Integration tests**: component behaviour against a mocked `apiFetch`.
- **E2E tests**: critical workflows only (login and users, create client,
  events and stages, asset links, staff tasks, portal comments) plus the
  portfolio smoke test. Not every page or button. Run specs one at a time
  (they share `test-results/`).
- **Manual testing** before calling a feature done: desktop, phone and tablet
  (360 / 768 / 1024 / 1280 px), auth, authz, error scenarios.

## Security

Every change touching auth, forms or user input gets a security review: XSS
(no `dangerouslySetInnerHTML` with user data), safe handling of the session
tokens in `lib/session/`, CSRF where applicable, no secrets in
`NEXT_PUBLIC_*` env vars, no Supabase keys in this repo at all.

## Performance

The rules and their reasons are in `docs/engineering-practices.md`: every
search box debounced (`useDebouncedValue` + `SEARCH_DEBOUNCE_MS`), every list
paginated by the server (shared `Pager`), data loaded on demand, and
first-load JS per page within budget (`npm run check:bundle` after a build;
the portfolio is a documented exception until its redesign).

## CI strategy

CI only, no CD until production is planned (local machine only for now).
`.github/workflows/ci.yml`: install, lint, typecheck, unit tests, build,
bundle budget.

## Engineering standard: applies to every change

Every implementation, refactor, optimization, bug fix and feature must
include a review of whether these need updating, **without being asked**:

Automated tests · documentation (this README, `hok-api`'s README/OpenAPI if
the contract changed) · error handling · validation · security · performance
· environment configuration · CI configuration.

## Definition of done

Not done just because the feature works. Done means: implemented correctly ·
existing functionality unaffected · tests added/updated · documentation
current · error handling reviewed · security reviewed · performance reviewed
· build succeeds · typecheck passes · lint passes · CI passes.
