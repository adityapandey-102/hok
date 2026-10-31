# HOK production readiness (2026-10-24, the day before launch)

## Verdict

**About 90% ready.** Safe to launch tomorrow **if** you finish the "Before launch" list below (mostly settings in Railway, Vercel and Supabase that only you can do). No known security issue is left open: #1 (old team members kept getting notifications) and the last library vulnerability (zod) were fixed later the same day. What's left is setup, plus monitoring after launch.

| Area | Score | Why |
|---|---|---|
| Features work end to end | 9/10 | Every automated test passes (see below) |
| Security | 9/10 | Three issues found and fixed today (Next.js, push addresses, #1); 0 known vulnerabilities in libraries |
| Speed under load | 8/10 | Fine for a firm of this size; every request costs one extra trip to Supabase Auth (fix after launch) |
| Production setup | 7/10 | Depends on settings you still have to enter (below). The API now refuses to start if the main ones are wrong |
| Monitoring and backups | 6/10 | Logs, health checks and safe shutdown are in place. Nothing alerts you when errors happen, and backups depend on your Supabase plan |

## What was tested today

| Check | Result |
|---|---|
| API lint, typecheck, build | Pass |
| API unit tests | 576 pass |
| API integration tests (real database) | 221 pass |
| Permission matrix (every role × every endpoint) | 547 / 547 pass |
| Web lint, typecheck, unit tests | Pass (155) |
| Web production build + page-size budget | Pass (27 pages, all under 300 KB) |
| Browser tests (Playwright, the real app) | 71 / 71 pass (run in 3 batches so the login limit resets between them) |
| Load test (20 people at once, 8 busiest pages) | Every request succeeded; 50–60 requests/second per page; 95% answered within 0.55 s |
| Security review (by hand, both apps) | See below |
| Dependency vulnerabilities | 0 left in both apps (Next.js 16.4.3, zod 4.6.7, body-parser patched) |

## Fixed today

From the code review (your items 2–5), **all fixed ✅**:
- ✅ **Team saves:** one deactivated member no longer blocks every save of that client's team. The dialog marks such people "Inactive", and they can't be made lead.
- ✅ **Phone layout:**
  - Tapping a tab while the "More" drawer is open now closes the drawer.
  - Toasts sit above the tab bar.
  - Dropdowns (time zone and team pickers) are no longer cut off inside panels.
- ✅ **Phone numbers:**
  - Old numbers saved without "+" are no longer silently turned into +91 numbers.
  - "0044…" is read as +44.
- ✅ **Time zones:**
  - Zone search is fast (it was rebuilding about 840 formatters on every keystroke).
  - Zone names can no longer cause a page-load error.
- ✅ **Client search:** now also finds clients by contact person name and industry, as the search box says.
- ✅ **Out-of-date text:** "the clients you own" wording in the guide, the dashboard and the clients list, plus CLAUDE.md and the API docs, updated for client teams.

From the security and production review, **all 7 fixed ✅** (the word in brackets is how serious the problem *was*):
- ✅ **Next.js 16.2.11 → 16.4.3** (was critical). The old version had several known remote-code-execution holes (image optimisation, Windows hosting, `use cache`) and cache-poisoning bugs.
- ✅ **body-parser** (part of Express; was high) patched against a denial-of-service bug.
- ✅ **Push notification addresses** (was medium): only real browser push services (Google, Mozilla, Apple, Microsoft) are accepted. Before, a signed-in user could make the server send requests to any internal address.
- ✅ **Security headers on every page:** no framing by other sites (clickjacking), no MIME sniffing, a safer Referer, and camera, microphone and location turned off. The "X-Powered-By: Next.js" header is gone.
- ✅ **Production safety check:** the API now refuses to start in production if `CORS_ALLOWED_ORIGIN`, `WEB_APP_URL` or `PUBLIC_API_URL` is missing, not https, or still localhost. A forgotten one would have broken portal and calendar links.
- ✅ **Database timeout:** a runaway query is now stopped after 15 seconds instead of tying up one of the few database connections.
- ✅ **Browser tests:** updated so they keep working as test data builds up.

## Security review: what was checked

Everything below was checked and looks right:
- **Sign-in and accounts:**
  - Login, refresh and logout. Cookies are httpOnly, Secure in production and SameSite=Lax.
  - Cross-site form protection is on every session route.
  - Login is rate-limited (30 tries per 15 minutes).
  - Passwords must be at least 8 characters, and nobody can sign themselves up.
- **Who sees what:**
  - Every endpoint checks the role.
  - Managers see only their teams' clients: 547 automated checks, and a client they can't see returns 404.
  - Database row security (RLS) is on for every table.
- **Client portal and calendar links:** stored only as hashes, rate-limited, kept out of logs and search engines, and never framed.
- **Links typed by users** (assets, logos, social accounts, task links): only http/https are accepted, so `javascript:` links are refused.
- **Link previews:** protected against requests to internal addresses (fixed earlier).
- **Data and logs:**
  - No secrets are committed to git.
  - Logs hide tokens, cookies and portal links.
  - Error details are never shown to users in production.
  - The API container runs as a non-root user.

## Before launch (you, in the hosting dashboards)

1. **Railway (API) environment:**
   - `NODE_ENV=production` (the Dockerfile sets it).
   - `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
   - `CORS_ALLOWED_ORIGIN`, `WEB_APP_URL` and `PUBLIC_API_URL`, all `https://…`. The API won't start otherwise.
   - `TRUST_PROXY` set for Railway's proxy, so rate limits see real visitor addresses. **Test this after deploying:** log in from two different networks and check that the API logs different IPs. If every request shows the same Vercel/Railway address, the whole firm shares one login limit (30 sign-ins + token refreshes per 15 minutes) and people will get "Too many attempts". Raise `AUTH_RATE_LIMIT_MAX` (e.g. 100) if in doubt. Also check Supabase → Auth → Rate limits (sign-ins per 5 minutes come from the API server's one address)..
   - VAPID keys if you want push notifications.
2. **Vercel (web):**
   - `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WEB_APP_URL` set to the production addresses.
   - Redeploy after this upgrade.
3. **Supabase (hosted):**
   - Apply the seven new migrations (the security audit fixes added `20261030000001_role_from_app_metadata`, `20261030000002_role_from_app_metadata_on_update`, `20261030000003_profiles_owner` and `20261030000004_revoke_data_api_reads`), in order. The first three are: `20261022000001_calendar_feed`, `20261022000002_client_contact_lists` and `20261023000001_client_teams_project_manager`.
   - In Auth settings, turn **sign-ups off**, set the Site URL and redirect URLs to the production web address, and set the minimum password length to 8.
   - Check that daily backups are on for your plan.
4. Set `TRUST_PROXY` explicitly on the API (it now refuses to start in production without it). The first Admin becomes the Owner: only the Owner can create, demote or deactivate Admins or reset an Admin's password. Email sign-in links (`/auth/callback`) are off until an email service is added. Set `BOOTSTRAP_TOKEN` (a long random value) on the API, create the first Admin on /setup with that key, then remove `BOOTSTRAP_TOKEN` so setup is off again. Create the first Admin account and change any test passwords. The seed's `Hok@2026` accounts must not exist in production.
5. Open `/api-docs` on production and decide whether it should be public. Today it lists every endpoint (harmless, but not needed).

## Hosting check: API on DigitalOcean $5, web on Vercel, database and login on Supabase

**Verdict: compatible, and the bill should stay at $5.** Checked 27 October against DigitalOcean's pricing and limits pages and by measuring a production-style build of the API.

- **The plan:** $5 a month flat for 1 shared CPU, 512 MiB of memory and 50 GiB of data out, on one server copy.
- **Extra charges:** the compute price is fixed, so heavy use never raises it. The only usage charge is data out beyond 50 GiB, at $0.02 per GiB (shared by the team, not carried over). Measured responses average 6.1 KB. If all 20 staff opened a page every 8 seconds, all workday, every workday, that is about 21 GiB a month, under the 50 GiB limit. Going 20 GiB over would cost 40 cents. Set a billing alert at about $10.
- **Measured on 27 October** (production-style build against the local database and login service, 20 simulated staff opening a page every 4–12 seconds, 70 seconds): all 395 requests succeeded; 95% finished within 215 ms; memory stayed at 96–110 MB and peaked at **128 MB** when hammered at 46 requests a second; about 5% of one CPU core on this PC (a shared DigitalOcean CPU may be 2–3 times slower, so roughly 15%).
- **Not measured:** the Docker image itself under a 512 MiB / 1 CPU limit, and hosted Supabase over the internet (distance adds delay to each request, so use the same region). Both need your OK to run.
- **Settings on DigitalOcean:** HTTP port **4100**; health check path **/health**; `NODE_OPTIONS=--max-old-space-size=384` (so Node cleans up before the 512 MiB limit); the environment variables from the checklist above.
- **Compatibility with Supabase:** nothing in the API needs a persistent database session, so Supabase's pooled connections work. Use the pooler connection string and pick the region closest to your Supabase project.
- **Two things to watch on the first deploy** (I couldn't test them without touching production):
  1. **SSL:** the driver treats `sslmode=require` as strict certificate checking, which may fail against Supabase with "self-signed certificate in certificate chain". Two fixes: put `sslmode=no-verify` in the URL (encrypted, but the server's identity isn't checked), or the secure way: set `DATABASE_SSL_CA` to Supabase's CA certificate (Dashboard > Database > SSL) and leave `sslmode` out of the URL. The API refuses to start if both are set. In production it also refuses to start if a hosted database would be reached without SSL, so a forgotten setting can never send the password and data unencrypted. Supabase's certificate is public, not a secret; keep `DATABASE_URL` (it contains the password) as an encrypted secret on DigitalOcean, and turn on "Enforce SSL on incoming connections" in Supabase.
  2. **Database timeout:** if the pooler refuses it ("unsupported startup parameter"), set `DB_STATEMENT_TIMEOUT_MS=0` and run `alter role postgres set statement_timeout = '15s'` on the database instead.
- **After deploying:** open `/health/ready`; it should say ready. Then repeat the two-networks login check for `TRUST_PROXY`.

## Fixed after the first report

- **#1:** client comments and event reminders now go only to team members who are active and still a client manager. Someone deactivated, or moved to Editor, Developer or Agent, stays listed on the team (so the Admin sees whom to take off) but gets nothing more about the client. Covered by a new database test.
- **zod 3 → 4.6.7** in both apps, which removes the last known vulnerability. Every API and web test still passes.

## Left open

- **After launch:**
  - **Login check speed:** check sign-in tokens inside the API instead of calling Supabase Auth on every request (about 60 ms saved per request, and higher capacity).
  - Lists run a small team lookup per row that only the detail pages need.
  - **Changing a client's lead:** the old and new lead are not notified.
  - **People removed from a team:** their personal calendar entries still link to that client.
  - The database doesn't itself guarantee that the lead is on the team (the app does).
  - Add error alerts (e.g. Sentry or Railway alerts) so you hear about failures before clients do.
  - Remove old "E2E …" test clients from the local database.
