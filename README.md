# HOK Web

Next.js (App Router) + TypeScript + Tailwind frontend for **HOK (House of
Khalak)**, a marketing firm. **One website**: the firm's public portfolio at
`/`, the staff app (clients, events, calendars, asset links, tasks) at `/app`,
and the client portal at `/p/[token]`. Deployed and managed independently from
[hok-api](../hok-api): **the two repos share no code and have no dependency on
each other; they only talk over HTTP.**

The architecture, tooling, design system and these docs are copied from
`needleye-pilot/needleye-web` (a read-only reference; never edit it).

> **Maintainers: keep this file current.** Whenever a change touches
> architecture, routing, env vars or the dev workflow, update the relevant
> section here in the same change. If it also changes how this app calls
> hok-api, update that repo's OpenAPI spec and README too.
> Project-wide context and the agent working rules: `../CLAUDE.md`.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4,
  organised as a **Modular Monolith**: one deployable app, partitioned into
  modules (`modules/*`) with the same internal shape.
- `lucide-react` icons, `zod` validation, `@dnd-kit` (drag and drop, later
  milestones), Vitest (unit), Playwright (e2e).
- **No Supabase SDK anywhere in this repo.** Login, session and password
  flows all go through hok-api's `/auth/*` endpoints. See "Authentication".
- `lib/domain/`: this repo's **own** copy of roles, the capability matrix,
  time-zone/date utilities and zod validation. See "No shared package".
- The portfolio (`app/(site)`) is the HOK HTML template ported as-is:
  Bootstrap 5.2, jQuery + Swiper, AOS, Magnific Popup, Nice Select,
  CounterUp, Waypoints, Vanilla Tilt, served from `public/site/assets`.

## Prerequisites

- Node.js 20+
- For the staff app: a running [hok-api](../hok-api) on port **4100**, with
  HOK's local Supabase stack (Supabase CLI pinned to `supabase@2.119.0`,
  ports 54420–54429). Swagger UI: `http://localhost:4100/api-docs`.
- The portfolio pages need nothing else: no API, no database.

## Quick start

```bash
npm install
cp .env.example .env.local      # defaults: API on :4100, web on :3400

npm run dev
# ⤷ http://localhost:3400       (portfolio at /, staff sign-in at /login)
```

Ports are offset from needleye (3000/4000) so both projects can run on one
machine; 3100 belongs to another local app. If the dev server answers 404 for
a page that exists, delete `<build folder>/dev` and restart it.

### Parallel dev servers

Next allows **one dev server per build folder**. The build folder is
`NEXT_DIST_DIR` (default `.next`, read by `next.config.ts` as `distDir`), so
several people or agents can run the app side by side, each with a folder and
port of its own (assignments: `../docs/AGENT-COORDINATION.md`):

```bash
NEXT_DIST_DIR=.next-web npx next dev -p 3401
NEXT_DIST_DIR=.next-web npm run build && NEXT_DIST_DIR=.next-web npm run check:bundle
E2E_BASE_URL=http://localhost:3401 NEXT_DIST_DIR=.next-web \
  npx playwright test e2e/portfolio.spec.ts --output=test-results-web
```

`.next-*/` and `test-results-*/` are git-ignored and skipped by lint. The known
folders' generated types are already listed in `tsconfig.json` so Next doesn't
rewrite it; a new folder name should be added there too. Next rewrites the
git-ignored `next-env.d.ts` to point at whichever folder ran last, which is
harmless.

First-time setup: open `/setup` to create the first Admin (self-disabling once
one exists). Everyone else is created by an Admin at `/app/admin/users`.

## Testing

Testing Pyramid (see `CLAUDE.md`): unit tests on `lib/domain/` first, e2e only
for critical workflows.

- **`npm run test:unit`** (Vitest, `lib/**/*.test.ts`, next to the code under
  test): capability matrix, date and time-zone utilities, user validation.
  Runs in CI.
- **`npm run test:e2e`** (Playwright, `e2e/`, see `e2e/README.md`). It starts
  `npm run dev` itself, or reuses a server already on 3400
  (`E2E_BASE_URL` points it elsewhere). **Run one spec at a time**: specs
  share `test-results/`.
  - `e2e/portfolio.spec.ts`: every portfolio page answers 200 with its
    heading and no script error, no sideways scroll at 768/1280 px, Font
    Awesome is gone, the 404 page, and the template CSS never reaching
    `/login`. Needs only the web app.
  - `e2e/login-users.spec.ts` (M2): Admin logs in, creates a user, finds it,
    logs out. Needs Supabase + hok-api (seeded). Defaults to
    `admin@hok.test` / `Hok@2026` (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`)
    and creates an `e2e.<timestamp>@hok.test` user on every run.
  - `e2e/clients.spec.ts` (M3): a manager creates and edits a client, another manager and a
    tasks-only role cannot see it. Needs Supabase + hok-api with the seeded `rohan.smm`,
    `sara.smm` and `neha.agent` (password `Hok@2026`, override with
    `E2E_PASSWORD`); leaves one "E2E Client <timestamp>" per run.
  - `e2e/events.spec.ts` (M4): Admin creates a stage template; a manager
    creates an event from it and moves its stage with a client-visible note.
    Needs the seeded `admin@hok.test`, `rohan.smm@hok.test` and the client
    "Chai Point Cafe" (password `Hok@2026`, override with `E2E_PASSWORD`).
    The screens agent runs it with `--output=test-results-screens`.
  - `e2e/assets.spec.ts` (M6): a manager adds an asset link with tags to Chai Point Cafe (a
    `javascript:` link is refused), finds it by search and tag, edits and deletes it; the
    Assets page lists links across clients; a tasks-only role has no Assets nav. Needs the
    seeded `rohan.smm`, `neha.agent` and the seeded asset links (`npm run seed` after migration
    20261014100001). The assets agent runs it with `--output=test-results-assets`.
  - `e2e/staff-tasks.spec.ts` (M7): the Admin assigns an editor task (the raw files link is
    required), the editor finds it in My tasks and moves it to In progress with a comment and
    then Done, a developer gets 404 on it, the Admin reopens and deletes it. Needs the seeded
    `admin@hok.test`, `meera.editor` and `arjun.dev` (migration 20261014200001 applied). The
    tasks agent runs it with `--output=test-results-tasks`.
  - Not in CI (it needs a live backend); run locally before a release.
- **`npm run check:bundle`** (after `npm run build`): first-load JS per page,
  gzipped, against a 300 KB budget (`scripts/bundle-budget.mjs`; `--write`
  refreshes `docs/performance/bundle-budget.md`). The portfolio pages are a
  documented exception (see "Portfolio").

## Architecture

### Two root layouts (and why)

The template's Bootstrap CSS and Tailwind's preflight would fight if they
were ever loaded together. Next.js lets each route group have its own `<html>`
root layout, and moving between different root layouts is a full page load.
So the app has two, and **neither ever loads the other's styles**:

| Root layout | What it serves | Styles and scripts |
| --- | --- | --- |
| `app/(site)/layout.tsx` | the public portfolio | `modules/site/components/SiteDocument.tsx`: the template's stylesheets from `/site/assets/css` + `/site/hok-site.css`, jQuery and plugins via `next/script`. **Never imports `globals.css`.** |
| `app/(main)/layout.tsx` | sign-in pages, staff app, client portal | `app/globals.css` (needleye's design system), `next/font` Playfair Display + Plus Jakarta Sans, Toast and Confirm providers. **Never loads `/site/*`.** |

Unmatched URLs render `app/global-not-found.tsx` (Next's experimental
`globalNotFound`, enabled in `next.config.ts`): with two root layouts there is
no single one a plain `not-found.tsx` could render inside. It is the
template's `oops.html`, inside `SiteDocument`, so a mistyped link looks like
the site. Once the portfolio is redesigned in Tailwind, `(site)` can move under
the main layout and the split goes away.

### URL map

| Area | URLs | Root layout | Session proxy |
| --- | --- | --- | --- |
| **Portfolio** (public) | `/`, `/about`, `/services`, `/services/details`, `/case-studies`, `/case-studies/details`, `/team`, `/team/details`, `/blog`, `/blog/list`, `/blog/details`, `/pricing`, `/faq`, `/contact`; anything unknown → 404 | `(site)` | no |
| Staff sign-in | `/login`, `/setup` (first Admin), `/reset-password`, `/update-password`, `/auth/callback` | `(main)` | yes (a signed-in user is sent to `/app`) |
| **Staff app** | `/app` (role dashboard, M10: firm / my clients / my tasks by role), `/app/profile` (own profile), `/app/admin/users`, `/app/admin/users/[userId]` (Admin, `users:manage`); `/app/clients`, `/app/clients/new`, `/app/clients/[clientId]` (managers see their own clients, Admin all; `clients:read`; Events tab); `/app/templates` (stage templates, Admin); `/app/events/new?clientId=`, `/app/events/[eventId]`; `/app/tasks` (everyone with `staff_tasks:read`: My tasks, or the Admin's list + Kanban), `/app/tasks/[taskId]` (another person's task is a 404); `/app/calendar` (M5, client events + personal entries), `/app/assets` (M6), `/app/comments` (M8, client comments inbox, sidebar badge), `/app/notifications` (M9, the bell's full list; mutes in My profile); Phase 2: `/app/my-clients` (Admin's own work), `/app/team`, `/app/reports` (Admin; tabs Team status, Staff, Client, Daily activity via `?view=`; the old `/app/activity` redirects to `?view=activity`), the client To-dos tab (`/app/clients/[id]?tab=todos`); in the top bar on every page: global search (Ctrl/Cmd+K, `components/shell/GlobalSearch.tsx`) and **Guide me** (`components/shell/GuideMe.tsx`, content in `modules/guide/guideContent.ts`) | `(main)` + sidebar shell | yes (signed-out → `/login?next=…`) |
| **Client portal** | `/p/[token]` (M8: dashboard, stage tracker, calendar, comments; browser fetches the public API directly; `no-referrer`, `noindex`, `no-store`, `DENY` framing headers) | `(main)`, plain chrome | no |
| Session handlers | `/api/session/{login,logout,refresh,establish,exchange-code}` | none | no |

The portfolio owns `/`, so `proxy.ts` **protects only `/app/*`** (and runs on
the sign-in pages). This is the inverse of needleye, which protects everything
except a list of public paths.

### Folder layout

```
app/                         routing only: thin pages that compose module components
  (site)/                      ROOT LAYOUT #1: the portfolio (14 pages, see "Portfolio")
  (main)/                      ROOT LAYOUT #2: needleye design system
    (auth)/                      login, setup, reset/update password: no sidebar
    app/                         the staff app behind auth: sidebar shell (layout.tsx -> AppShell)
    auth/callback/               lands here from a password-reset email link
  api/session/*                route handlers that own the session cookies
  global-not-found.tsx         the 404 for unmatched URLs (template's oops.html)
  globals.css                  the design system (imported by (main) only)
proxy.ts                     Next 16's middleware.ts: session refresh + guards /app/*
modules/
  site/                        the portfolio
    brand.ts                     the logo path (public/hok-logo.png)
    components/                  SiteDocument (the <html>), SitePage (shared chrome), SiteHeader,
                                 SiteFooter, Preloader, SearchPopup, SubSidebar, ScrollTop,
                                 SiteScripts (runs main.js after hydration), SiteIcon (Lucide),
                                 ExpandableText, NotFoundMain
  auth/                        LoginForm, SetupForm, Reset/UpdatePasswordForm, ProfileForm; api/authApi.ts
  admin-users/                 UserManagementClient (paged, searchable directory), UserDetailClient,
                               CredentialRevealOverlay, TimeZoneInput; api/usersApi.ts
  clients/                     ClientsListClient (paged, searchable), NewClientClient + ClientForm,
                               ClientWorkspaceClient (one client); api/clientsApi.ts
  stage-templates/             TemplatesClient (Admin); api/templatesApi.ts
  events/                      EventsTab (client workspace), NewEventClient + EventForm, EventDetailClient,
                               StageTracker; api/eventsApi.ts
  staff-tasks/                 TasksPageClient (My tasks / Admin list + board toggle, filters), TaskList (paged),
                               TaskBoard (Kanban, @dnd-kit: drag = status change after a confirm, with the version),
                               TaskFormModal (Admin create/edit; editor brief when an editor is picked),
                               TaskDetailClient (status actions + comment, timeline); api/staffTasksApi.ts
  notifications/               PWA + push groundwork (M9): config.ts (NOTIFICATIONS_ENABLED), registerServiceWorker.ts,
                               ServiceWorkerRegistrar, InstallAppHint, NotificationBell (hidden until M9)
components/
  ui/                          needleye's primitives: Button, Card, Field, Modal, ConfirmDialog, Toast,
                               Pager, StatusPill, Select, RadioGroup, Icon, ProgressRing, CountUp, Portal
  shell/                       AppShell, Sidebar, BrandMark, nav-config (role-based menu)
lib/
  domain/                      own copy of roles, capabilities, types, date/time-zone utils, zod validation
                               (utils/zonedTime.ts: the shared helper for times in a time zone)
  session/                     cookies holding hok-api-issued tokens (hok_at readable, hok_rt httpOnly)
  pwa/platform.ts              how "Install the app" works on this device (unit-tested)
  api/                         apiFetch (browser) / apiFetchServer (server components)
  hooks/                       useDebouncedValue (+ SEARCH_DEBOUNCE_MS), useMediaQuery
  logging/                     the one web-side logger
public/
  hok-logo.png                 the firm's logo (app + portfolio)
  site/assets/                 the template's css / js / img, copied unchanged from buyer-file
  site/hok-site.css            every HOK change to the template's look (icons, staff login link)
e2e/                         Playwright specs
scripts/bundle-budget.mjs    the first-load JS budget check
```

`app/` stays thin: a page fetches data (Server Components calling the API),
checks capabilities (redirects) and renders a component from `modules/`.

**Every module that talks to the backend has its own `api/*.ts` file**
(`authApi`, `usersApi`, …) wrapping `lib/api/client.ts` into named, typed
methods. Components never call `apiFetch` directly: it is the frontend's
equivalent of the backend's repository layer, the one place a module's HTTP
calls are made, even for small modules.

### Design system & branding

Copied **exactly** from needleye-web (same tokens, components, motion and
responsive rules); only the brand assets changed. `app/globals.css` holds the
whole visual language as CSS custom properties exposed to Tailwind v4 via
`@theme inline` (palette, the motion utilities with a
`prefers-reduced-motion` guard, material utilities). Type is *Playfair
Display* for titles and names and *Plus Jakarta Sans* for everything else;
numbers never use the serif (`.figure`). Shared primitives in
`components/ui/` consume the tokens, so pages don't hard-code colours.

- **Brand:** HOK / House of Khalak. `components/shell/BrandMark.tsx` renders
  `public/hok-logo.png` (a red wordmark, shown on a white tile so it reads on
  the dark sidebar); if the file is missing it falls back to an "H" monogram.
  The site icon is `app/icon.png`.
- **Icons:** `components/ui/Icon.tsx` wraps Lucide; only the icons in its map
  are imported.
- **Responsive:** mobile/tablet first, checked at 360 / 768 / 1024 / 1280 px;
  the sidebar is a drawer below 1280 px; no list scrolls sideways.

### Authentication

Every auth operation is a call to hok-api, never to Supabase. Two cookies hold
the session (`lib/session/constants.ts`):

- **`hok_at`** (access token): a normal cookie the browser reads to send
  `Authorization: Bearer <token>` on its direct API calls.
- **`hok_rt`** (refresh token): **httpOnly**. Browser JS can neither read nor
  write it, so an XSS can't steal the long-lived token.

Because JS can't set an httpOnly cookie, **everything that mints, rotates or
clears a session goes through same-origin route handlers in
`app/api/session/*`**, which call hok-api server-side and set the cookies:

- **Login / code exchange**: `authApi.login` / `exchangeCode` POST to
  `/api/session/{login,exchange-code}`, which proxy to hok-api's `/auth/*`
  (forwarding the client IP so the API's per-IP rate limit keys on the real
  user), set both cookies and return only the profile. Tokens never come back
  to the browser in a response body.
- **Logout**: `/api/session/logout` revokes server-side and clears both
  cookies (its GET form is used by the `/app` layout when a session turns out
  to be invalid, so a stale cookie can't cause a redirect loop).
- **Refresh**: `lib/api/client.ts` POSTs to `/api/session/refresh` on a stale
  or missing access token; `lib/api/server.ts` and `proxy.ts` refresh
  server-side the same way.
- **`/auth/callback`**: a password-reset email link lands here; the page hands
  the tokens to `/api/session/establish` so the refresh token is stored
  httpOnly.
- **`proxy.ts`** runs only for `/app/*` and the sign-in pages (its matcher).
  Signed-out users opening `/app/*` go to `/login?next=…`; signed-in users
  opening a sign-in page go to `/app`. The portfolio, the portal and `/api/*`
  never run it.

The API is the real security boundary: UI capability checks only hide what a
role can't use.

### Portfolio (the HOK template, ported as-is)

Source: `D:\Code Space\WorkSpace\buyer-file` (read-only; files were copied
out, never edited there). Phase 1 keeps the template's look, text and images;
a redesign with the firm's real content comes later
(`../docs/ARCHITECTURE.md` §11b).

| Template page | Route | Template page | Route |
| --- | --- | --- | --- |
| `index.html` | `/` | `team.html` | `/team` |
| `about.html` | `/about` | `team-details.html` | `/team/details` |
| `service.html` | `/services` | `blog-grid.html` | `/blog` |
| `service-details.html` | `/services/details` | `blog-list.html` | `/blog/list` |
| `study-grid.html` | `/case-studies` | `blog-details.html` | `/blog/details` |
| `study-details.html` | `/case-studies/details` | `pricing.html` | `/pricing` |
| `faq.html` | `/faq` | `contact.html` | `/contact` |
| `oops.html` | any unknown URL (`app/global-not-found.tsx`, status 404) | | |

How it is wired:

- **Pages** are server components that render `SitePage` (preloader, header,
  search overlay, footer, side menu, back-to-top; `home` or `inner` variant,
  as in the template) around the page's own `<main>`, converted to JSX.
- **CSS:** the template's stylesheets, in its order, then
  `public/site/hok-site.css` for every HOK change. The template's files in
  `public/site/assets` are byte-for-byte copies.
- **Scripts:** jQuery and the plugins load in the template's order as
  `beforeInteractive` scripts; `main.js` runs `afterInteractive`
  (`SiteScripts`), after React has hydrated, because it changes the DOM
  (Swiper clones slides, Nice Select inserts markup, AOS adds classes).
- **Links** inside the portfolio are plain `<a>` (a full page load each time,
  so the plugins start fresh), with every `*.html` link rewritten to the
  routes above. The menu's "Home Version-2/3/4" items were dropped (those
  pages never existed in the template); "Oops 404" opens `/oops`, which is the
  404 page.
- **Small HOK changes:** the placeholder "Xstar" logo and name read HOK /
  House of Khalak (logo `public/hok-logo.png`, also replacing the home page's
  hotlinked Shopify copy); the copyright year is 2026; the footer carries a
  discreet **"Staff login"** link to `/login`; the inline `toggleText()`
  script became the `ExpandableText` component; `javascript:void(0)` links
  became `href="#" role="button"` (React blocks `javascript:` URLs).
- **No `dangerouslySetInnerHTML`** anywhere in the portfolio.

**Icons: Font Awesome is gone.** The template shipped Font Awesome 6 **Pro**, a
paid licence. `all.min.css` and the `fa-*` webfonts were not copied. Every
`<i class="fa…">` is now a Lucide icon (ISC licence, the same family as the
staff app) through `modules/site/components/SiteIcon.tsx`. It renders an `<i>`
that keeps the template's classes (so its CSS and jQuery selectors still
apply), as wide as Font Awesome's glyph for that icon, with the SVG drawn at
1.3em and a heavier stroke so it matches the solid FA weight
(`public/site/hok-site.css`).

| Font Awesome (template) | Now (Lucide) |
| --- | --- |
| `fa-arrow-up` (often rotated 60° by the template) | `arrow-up` |
| `fa-arrow-right`, `fa-arrow-left` | `arrow-right`, `arrow-left` |
| `fa-arrow-right-long` | `move-right` |
| `fa-angle-double-right` | `chevrons-right` |
| `fa-chevron-right / left / up / down` | `chevron-right / left / up / down` |
| `fa-times` | `x` |
| `fa-bars` | `menu` |
| `fa-search` (solid), `fal fa-search` (light) | `search` (light: thinner stroke) |
| `fa-star` (solid / regular) | `star` (filled / outline) |
| `fa-circle` | `circle` (filled) |
| `fa-quote-right` | `quote` (filled) |
| `fa-play` | `play` (filled) |
| `fa-file-alt` | `file-text` |
| CSS glyphs in `main.css`: menu arrow `\f062`, FAQ toggle `\f101` | CSS masks of Lucide `arrow-up` / `chevrons-right` |
| CSS glyphs: service accordion `+` / `\f068` | plain CSS bars (plus / minus) |

The social icons (Facebook, Twitter, LinkedIn, YouTube) were already inline
SVGs in the template and are kept as they were.

**Known template quirks, kept as-is:** the home page's video play button
throws a Magnific Popup error on click (the same in the original template);
the demo images are placeholders (e.g. "450X300"); the forms (newsletter,
contact, search) don't submit anywhere yet. Before the site goes public:
replace the demo images and text with the firm's own.

**Bundle budget exception:** the portfolio pages load the template's jQuery
and plugins (about 132 KB gzipped) on top of the Next runtime, about 321 KB in
all, over the 300 KB budget. `check:bundle` counts them and reports these
pages as "portfolio exception" instead of failing, until the redesign removes
jQuery.

### Installable app (PWA) and notifications groundwork

The staff app installs like a native app (FR: PWA; web push arrives in M9):

- **`app/manifest.ts`** (served at `/manifest.webmanifest`): name "HOK · House of
  Khalak", short name "HOK", `start_url` and `id` `/app` (installing opens the
  staff app, not the portfolio), standalone, the design system's sand
  background and burgundy theme colour. Next adds the manifest link to every
  page, the portfolio's included.
- **Icons** in `public/icons/` (192, 512, a maskable 512, the 180 px Apple
  icon also copied to `app/apple-icon.png`) are generated from
  `public/hok-logo.png` by `node scripts/generate-pwa-icons.mjs`: the
  wordmark, its margins trimmed, centred on white. Re-run it when the logo
  changes.
- **`public/sw.js`**: the service worker, deliberately small. It shows a push
  notification from a JSON payload `{ title, body, url, tag }` and opens (or
  focuses) the app at `url` when it is clicked. Only same-origin URLs are
  opened; anything else falls back to `/app`. There is **no fetch handler and
  no offline cache**: staff always see live data. `next.config.ts` serves it
  with `Cache-Control: no-cache, no-store` and a strict CSP, so a fix reaches
  installed apps on their next load.
- **`modules/notifications`**: `ServiceWorkerRegistrar` (in `AppShell`)
  registers `/sw.js` on the staff app; `InstallAppHint` (top of every
  staff page) is a dismissible card: an Install button where the browser
  offers one (`beforeinstallprompt`: Chrome, Edge, Android), and "Tap Share,
  then Add to Home Screen" on iPhone and iPad (where web push only works for
  an installed app). Nothing shows once installed or after "Not now" (kept in
  this browser's storage). `NotificationBell` sits in the phone/tablet
  header but **renders nothing** until M9 sets `NOTIFICATIONS_ENABLED`
  (needleye's rule: no placeholders that do nothing).
- **M9 adds:** push subscription (needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and
  hok-api's subscribe endpoint), the bell's unread count and list, and the
  same bell on the desktop sidebar. Push needs HTTPS (or `localhost`).

### No shared package, on purpose

`hok-web` and `hok-api` are separate repos with separate CI and deploys, and
**nothing is imported across them**: the only connection is HTTP against the
API's documented endpoints. So `lib/domain/` (roles, capability matrix, time
zones, validation) is **this repo's own copy** of rules that also exist,
independently, in hok-api's `src/domain/`. If the roles or capabilities
change, both copies are updated by hand; that's the accepted cost of
independence for two apps this size.

**RBAC in the UI:** nav items and actions are gated with `lib/domain`'s
capability matrix (`hasCapability`), mirroring the API. Seven roles: Admin,
Social Media Manager, Marketing Manager (own clients), and Marketing Agent,
Developer, Editor (staff tasks only). Clients have no account: they use the
portal link.

**Frontend logging:** `lib/logging/logger.ts` is the one web-side logger
(levelled, structured, never logs tokens); a down API surfaces as a friendly
503 message, not a raw stack.

## Environment variables

See `.env.example`:

- `NEXT_PUBLIC_API_BASE_URL`: hok-api's URL (`http://localhost:4100/api/v1`).
- `NEXT_PUBLIC_WEB_APP_URL`: this app's own origin (`http://localhost:3400`),
  used to build absolute links such as a client's portal link.
- Later: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for web push (M9).

Nothing Supabase-related belongs here. `NEXT_PUBLIC_*` values are public and
inlined at build time.

## Deployment

**Local machine only for now.** Production (Vercel for this app, Railway for
hok-api, hosted Supabase) is deferred until Phase 1 runs locally, and nothing
is deployed without the user asking for that specific action.
`.github/workflows/ci.yml` runs lint, typecheck, unit tests, build and the
bundle budget on every push and PR to `main`.
