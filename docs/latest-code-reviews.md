# Latest code reviews

Newest first. Each review lists its scope, findings (most severe first) and what was done about them.

---

## 2026-10-22: whole project (hok-api + hok-web)

**Scope:** all source in both repos, not just the last commit. Finding 1 was confirmed by running it (`npx tsx`: `isPublicAddress('::ffff:7f00:1')` returns `true`; `new URL('http://[::ffff:127.0.0.1]/')` normalises the host to `[::ffff:7f00:1]`). The rest come from reading the code and were not run. No files were changed by the review.

**Status:** all 10 fixed on 2026-10-22, committed locally (hok-api 92bdc44, hok-web 9570211).

**What was done:**
1. `isPublicAddress` now parses IPv6 into its 8 groups, whatever the notation, and judges the IPv4 address inside mapped forms. It refuses the IPv4-compatible, NAT64, 6to4, Teredo and old site-local ranges. Tests cover the exact attack hosts after `new URL()` normalisation.
2. New `lib/session/safe-next.ts` resolves `?next=` the way a browser would (WHATWG URL) and keeps it only when it stays on this origin. It is used by the login form, `/auth/callback` and `GET /api/session/logout`. Tests cover `//evil`, `/\evil`, `/<tab>/evil`, full URLs and `javascript:`.
3. Sign out first calls `unsubscribeThisDevice()` (`modules/notifications/pushDevice.ts`, best effort). It removes the subscription from the API and unsubscribes the browser even if the API call fails. "Turn off push" uses the same function.
4. Logout uses `admin.signOut(token, "local")`: only this device's session ends. Deactivated accounts are still refused on every request.
5. `/auth/callback` was removed from the proxy's sign-in redirect list, so a signed-in browser can open invite and reset links. Checked live: 200, while `/login` still returns 307 to /app.
6. `ensureFreshAccessToken` is single-flight: concurrent calls share one refresh. The refresh route no longer clears cookies when a refresh fails, because that may be a lost race with a successful rotation. The proxy clears a session that is really dead on the next navigation.
7. The feed reads upcoming items (next 180 days, up to 500 per kind) and the past 30 days (up to 100 per kind) separately, de-duplicated. A busy past no longer pushes upcoming items out. That is 4 fixed queries.
8. New `rejectCrossSite()` (`lib/session/same-origin.ts`) guards all five cookie-setting session POST routes: the body must be JSON, and Sec-Fetch-Site, when sent, must be same-origin. Checked live: text/plain, form posts and cross-site JSON get 403; the app's own calls work.
9. `toIcs` leaves DTEND out when an item ends as it starts (RFC 5545: zero duration).
10. Events uses the shared `spanProblem` / `rangeProblem` / `scanLowerBound`; its own 31/92-day constants are gone. The 13 identical `guarded()` copies were replaced by `common/database/guarded.ts`, which has an optional `mapError`. Stage templates (unique name → 409) and search ("Failed to search …") are thin wrappers around it.

| # | Severity | Where | Finding | Failure scenario |
|---|---|---|---|---|
| 1 | Security (confirmed) | `hok-api/src/modules/assets/domain/link-preview.rules.ts:56` | The link-preview SSRF guard only recognises IPv4-mapped IPv6 in dotted form (`::ffff:1.2.3.4`); the URL parser and DNS return the hex form (`::ffff:7f00:1`), so loopback, private and cloud-metadata addresses pass as public. | A manager saves `http://[::ffff:127.0.0.1]/` or `http://[::ffff:169.254.169.254]/latest/meta-data/`. The host normalises to hex, the regex misses, `isPublicAddress` returns true (also for `::7f00:1`), and the server fetches its own loopback or the metadata service, storing the page's title and description where staff can read them. |
| 2 | Security | `hok-web/modules/auth/components/LoginForm.tsx:27` (also the auth callback page line 21 and the logout GET guard) | Open redirect: `router.push(searchParams.get("next") \|\| "/app")` trusts `next`; the logout guard's `startsWith("/")` lets `//evil.com` through. | A link to `https://hok/login?next=https://evil.example/login` (or `//evil.example`): the user signs in for real, lands on a look-alike page asking them to "sign in again", and their password is phished. `/auth/callback?next=…` does the same after setting a session. |
| 3 | Privacy | `hok-web/components/shell/Sidebar.tsx:45` | Sign out never removes the browser's web-push subscription. | On a shared computer or borrowed phone, the next person keeps seeing the signed-out user's comment excerpts, task titles and reminders as OS notifications, until someone else subscribes from that browser. |
| 4 | Behaviour | `hok-api/src/common/auth/supabase-auth-provider.ts:43` | Logout calls `admin.signOut(accessToken, "global")`, ending every session on every device. | Signing out on the phone kicks the laptop to /login mid-task at its next refresh; the same happens via the `GET /api/session/logout` recovery path. |
| 5 | Bug | `hok-web/lib/session/proxy.ts:33` | `/auth/callback` is in `SIGN_IN_PATHS`, so a signed-in browser is redirected to /app before the callback reads the link's tokens. | The Admin, signed in, opens a new staff member's invite link, or a signed-in user opens their reset-password email in the same browser: 307 to /app, the tokens are never used, /update-password is never reached. |
| 6 | Bug | `hok-web/lib/api/client.ts:59` | `ensureFreshAccessToken` has no single-flight: each parallel call with an expired token refreshes on its own, alongside the proxy. | A dashboard firing 4–7 calls after the 1-hour expiry rotates the same refresh token several times; out-of-order responses can overwrite the newer pair, and one failed rotation's 401 calls `clearSession()`, signing the user out. |
| 7 | Bug | `hok-api/src/modules/calendar/application/calendar-feed.service.ts:64` | The subscribe feed keeps the earliest 500 items of a window starting 30 days back, so at the cap past events push out upcoming ones, silently. | The Admin's feed (every client) with over 500 events in now−30d…now+180d shows last month's shoots while next month's never appear, with no truncation marker. |
| 8 | Security | `hok-web/app/api/session/establish/route.ts:12` | `/api/session/establish` stores any posted token pair with no CSRF / Origin / Content-Type check; `request.json()` also parses text/plain (login CSRF). | An attacker page auto-submits a `text/plain` form with the attacker's tokens; the victim is silently signed in as the attacker and enters client data into the attacker's account. |
| 9 | Bug | `hok-api/src/modules/calendar/domain/calendar-feed.rules.ts:72` | `toIcs` writes `DTEND` equal to `DTSTART` for zero-length items (allowed by `assertEventTimes`); RFC 5545 needs DTEND later than DTSTART. | A 10:00–10:00 posting reminder: strict clients (Outlook, some CalDAV importers) drop the VEVENT, so it silently disappears. Fix: omit DTEND or use `DURATION:PT0S`. |
| 10 | Maintainability | `hok-api/src/modules/events/infrastructure/drizzle-events.repository.ts:136` | Events keeps its own copies of the shared time-range rules (`EVENT_MAX_DURATION_DAYS`, `EVENT_RANGE_MAX_DAYS`, `resolveRange`, an inline scan bound) instead of `domain/time-range.ts`; `guarded()` is also copy-pasted in 16 repositories. | Raising the event length cap in `event.entity.ts` only would store events longer than `MAX_ITEM_DAYS`; the calendar and .ics queries (bounded by `scanLowerBound`) then silently miss long events that began over 31 days before the window. |

---

## 2026-10-22: "Add to Google Calendar" (hok-web `ba665ca`, with hok-api `58e2485`)

**Scope:** hok-web's last commit (`ba665ca`, the subscribe dialog) plus two uncommitted wording changes, compared against `HEAD~1` (hok-web has no upstream). The matching hok-api commit (`58e2485`) was read to check the contract: same routes and response shapes, and the token format matches the e2e pattern. Nothing was run during the review.

**Summary:** the top three issues each lose or kill a link without warning, which the client portal link screen (`PortalTab`) already guards against.

**Status:** all 9 fixed on 2026-10-22, committed locally (hok-api 92bdc44, hok-web 9570211).

**What was done:**
1–3. The dialog asks inline before "Make a new link" (when one exists) and before "Turn off". It also asks before closing (Escape, backdrop or X) while a new link hasn't been copied, and ignores close while a link is being made. The question is shown inside the dialog: a confirm dialog stacked on top would share its Escape key and close both.
4. `isLocalAddress` parses the host and flags localhost, `*.localhost`, `*.local`, 0.0.0.0, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16, IPv6 loopback, unique-local and link-local, and bare machine names. `localhost-api.example.com` is no longer flagged.
5. `POST /calendar/feed-link` returns the absolute `url`, built by the API from the new `PUBLIC_API_URL` setting. The browser no longer builds it.
6. Google gets the https address as `cid`, not webcal://.
7. A shared `components/ui/OneTimeLink.tsx` (warning, address, copy, extra actions) is used by both the portal tab and the calendar dialog.
8. The API refuses with 404 `USER_NOT_FOUND` (no token, no audit) when nothing was saved. The response type now guarantees `link`.
9. The hok-web README route map describes the dialog, and the web engineering practices list the new security rules.

| # | Where | Finding | Failure scenario |
|---|---|---|---|
| 1 | `hok-web/modules/calendar/components/CalendarSubscribe.tsx:154` | "Make a new link" replaces the existing link with no confirmation, though the old link stops working at once. `PortalTab` asks first. | A manager already subscribed in Google clicks "Make a new link"; the stored hash changes, their Google copy goes empty for good, with no warning. Fix: `useConfirm({ danger: true })` as in `PortalTab.generate`. |
| 2 | `CalendarSubscribe.tsx:158` | "Turn off" revokes with one click; `PortalTab.disable` confirms first. | A mis-tap (on phones the buttons stack full-width next to "Make a new link") breaks every subscribed app; recovery means a new link and re-subscribing everywhere. |
| 3 | `CalendarSubscribe.tsx:91` | The one-time address lives only in the dialog's state, and the modal closes on Escape, a backdrop click or X without warning. | The user makes a link, then presses Escape or clicks outside before copying (or closes while `create()` runs). The token is gone; reopening shows only "Your link is on", so they must make a new one, breaking calendars on the old one. |
| 4 | `hok-web/modules/calendar/calendarApi.ts:51` | `isLocalAddress` only spots localhost, 127.x and [::1]; it misses private LAN addresses (dev runs over the LAN, see `allowedDevOrigins`) and wrongly flags hosts that merely start with "localhost". | With `NEXT_PUBLIC_API_BASE_URL=http://192.168.1.20:4100/api/v1` (or 10.x, 172.16–31.x, 0.0.0.0, *.local) no warning shows and the Google calendar stays empty; `https://localhost-api.example.com` shows the warning wrongly. |
| 5 | `calendarApi.ts:40` | The public feed address is built in the browser from `NEXT_PUBLIC_API_BASE_URL` (falling back to ""), not returned by the API as the portal's `res.url` is. | Env var unset: a relative `/calendar-feed/<token>.ics` is shown and Google gets a broken `cid`. Browser API base ≠ public API origin (proxy, internal host): the link is unreachable for Google/Outlook. Fix: `POST /calendar/feed-link` returns the absolute URL. |
| 6 | `calendarApi.ts:46` | `googleSubscribeUrl` turns `https://` into `webcal://`, losing the scheme. | Apps that resolve webcal as plain http send the secret token in cleartext on the first request (or fail if the host has no :80). Passing the https URL as `cid` also works with Google. |
| 7 | `CalendarSubscribe.tsx:80` | `copy()` and the shown-once link panel (lock note, URL box, copy button, regenerate/disable flow) are near-copies of `modules/portal/components/PortalTab.tsx`. | Two copies of the one-time-link UI drift apart; the missing confirmations above are the proof. A shared `OneTimeLinkPanel` or `useCopyToClipboard` would prevent it. |
| 8 | `CalendarSubscribe.tsx:58` | `make()` trusts `res.link` even when null: the API's `setFeedLink` returns null when no profile row was updated, yet still answers 201 with a token. | Profile missing or id mismatch: the dialog shows a URL and copy buttons while the status says "You have no calendar link yet", and the URL is a 404. |
| 9 | `hok-web/README.md:151` | The route/feature map doesn't mention the subscribe dialog or the public .ics link it hands out (hok-api's README does). | hok-web's definition of done requires current docs; `/app/calendar` still reads "(M5, client events + personal entries)", so the next reader misses that the page issues a public secret link. |
