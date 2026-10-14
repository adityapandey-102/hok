# Engineering practices — hok-web

This is the rulebook for the web app: what we do, and **why**. Each rule is
either already true in the code, or backed by a check that fails when it is
broken. The API and database have their own page
(`hok-api/docs/engineering-practices.md`). The rules are needleye-web's,
adapted to HOK; the agent working rules are in `../CLAUDE.md` §0.

---

## 1. Talking to the API

| Practice | Why | Where |
| --- | --- | --- |
| **Every search box is debounced**: one request after the user pauses (`SEARCH_DEBOUNCE_MS` = 300 ms), not one per keystroke. | Typing a client's name would otherwise send a request per letter, and the answers can arrive out of order. | `lib/hooks/useDebouncedValue.ts`. Used by the user directory; every later search box (clients, assets, tasks) uses it too. |
| **Only typing is debounced.** Page, filter and view clicks fetch immediately. | A click is one deliberate action; delaying it only makes the app feel slow. | The debounced value is a dependency of the fetch; page and filter state are used directly. |
| **Lists are paginated by the server; nothing is filtered in the browser.** | Loading everything and filtering works with 20 rows and breaks with 500 clients. The server returns one page plus a total. | `components/ui/Pager.tsx` (shared); the user directory. |
| **Any filter change goes back to page 1, in the same event handler.** | Otherwise a narrower filter can leave you on an empty page 5. Doing it in the handler, not an effect, avoids a wasted fetch. | Each list's change handlers. |
| **Stale responses are ignored.** | A slow answer to an old query must not overwrite the answer to the new one. | A `cancelled` flag in every fetch effect. |
| **Load on demand.** A calendar month only when it's shown, an event's details only when opened. | Most of what *could* be shown is never looked at. | Calendars (M5), event detail (M4). |
| **One API module per feature** (`authApi`, `usersApi`, …); components never call `fetch`/`apiFetch` directly. | Every request for a feature is in one place: easy to find, change and mock. | `modules/*/api/*.ts` |
| **The browser never talks to Supabase.** | One security boundary: hok-api. | No Supabase SDK or keys in this repo. |

## 2. Rendering and bundle size

| Practice | Why |
| --- | --- |
| **Pages are server components that check access and then render client islands.** | The access check runs before page code reaches someone who shouldn't see it; only interactive parts ship JavaScript. |
| **A bundle budget: ≤ 300 KB of first-load JS per page, gzipped** (`npm run check:bundle` after a build). The app pages are at about 200–230 KB, of which 168 KB is React plus the Next runtime shared by every page. | Staff work on phones. The check catches one heavy import quietly landing on every page. |
| **The portfolio is a documented exception.** Its pages also load the template's jQuery and plugins (about 132 KB gzipped, about 321 KB in all). The check counts them and reports "portfolio exception" instead of failing. | It is the template ported as-is; the redesign (Tailwind, no jQuery) removes the exception. |
| **Few dependencies** (Next, React, zod, lucide-react, dnd-kit). | Every dependency is download size and upgrade work. Prefer a small local helper. |
| **Fonts via `next/font`** (self-hosted and preloaded) in the app. | No layout shift and no call to Google on every page view. (The portfolio keeps the template's own Google Fonts import until the redesign.) |
| **Only the icons used are imported** (`components/ui/Icon.tsx`, `modules/site/components/SiteIcon.tsx`). | The rest of Lucide is tree-shaken away. |

## 3. The two root layouts

| Practice | Why |
| --- | --- |
| **`app/(site)` never imports `globals.css`, Tailwind classes or `components/ui/*`; `app/(main)` never loads `public/site/*`.** | Bootstrap and Tailwind's preflight fight. Each root layout has its own `<html>`; moving between them is a full page load. Checked by `e2e/portfolio.spec.ts`. |
| **Template files in `public/site/assets` are never edited.** HOK changes go in `public/site/hok-site.css` and `modules/site/`. | The template stays a clean copy, so it's obvious what HOK changed, and the redesign can drop it in one go. |
| **Portfolio links are plain `<a>`.** | A full page load each time lets the template's jQuery plugins start fresh. |
| **No Font Awesome.** Portfolio icons are Lucide (`SiteIcon`). | The template's Font Awesome was a paid Pro licence. |

## 4. Correctness

| Practice | Why |
| --- | --- |
| **Instants are UTC; every user, client and event has an IANA time zone** (`lib/domain/utils/timeZone.ts`, `date.ts`, unit tested around DST). | Staff and clients are in several time zones; a daylight-saving change must not move an event. |
| **Business rules live in `lib/domain/`** (this repo's own copy) and are unit tested. The UI's permission checks are for convenience only. | hok-api enforces permissions; the UI only hides what you can't use. |
| **Validation with zod** on every form, mirroring the API's rules. | Instant feedback; the API still validates. |

## 5. UX and accessibility

- Every data view has **loading, empty and error states, with a retry**. *Why:* a slow or down API never produces a blank screen.
- **Shared primitives instead of copy-paste**: `Modal` (focus trap, Escape, scroll lock, bottom sheet on phones), `ConfirmDialog` (no native `confirm()`), `Pager`, `Card`, `Button`, `Toast`. *Why:* fix a bug once and every screen gets the fix.
- Labelled inputs, `aria-live` status lines, keyboard support.
- **Phone and tablet layouts are checked** at 360 / 768 / 1024 / 1280 px: lists are cards below `lg`, the sidebar is a drawer below 1280 px, and no page scrolls sideways (the portfolio e2e checks 768 and 1280).

## 6. Security

- The web holds **no Supabase keys and no secrets in `NEXT_PUBLIC_*`**. The refresh token (`hok_rt`) is an httpOnly cookie, set only by `app/api/session/*`. *Why:* anything shipped to the browser is public.
- There's no `dangerouslySetInnerHTML` anywhere (the portfolio included).
- The client portal (`/p/[token]`) shows only what hok-api returns for that token; the token is never logged.

## 7. Testing and the release checklist

**Run before every release** (hok-api and the local Supabase stack must be running for the login/users e2e):

| Command | Checks |
| --- | --- |
| `npm run typecheck && npm run lint` | Types and lint are clean |
| `npm run test:unit` | `lib/domain` rules: capabilities, time zones, dates, validation |
| `npm run build && npm run check:bundle` | Production build, then the per-page JS budget (portfolio reported as the exception). `--write` refreshes `docs/performance/bundle-budget.md`. |
| `npx playwright test e2e/portfolio.spec.ts` | Every portfolio page: 200, heading, no script error, no sideways scroll, no Font Awesome, CSS kept apart |
| `npx playwright test e2e/login-users.spec.ts` | Admin login, create and find a user, logout (needs hok-api + Supabase) |

Run e2e specs **one at a time**: they share `test-results/`.

**When you add a search box:** use `useDebouncedValue(value, SEARCH_DEBOUNCE_MS)`
and send the search to the server with a page size. **When you add a list:**
paginate it on the server and use `Pager`.
