# HOK: first production deploy (step by step)

**Setup:** database and login on **Supabase**, the API (`hok-api`) on **DigitalOcean App Platform** ($5/month), the website (`hok-web`) on **Vercel** (free plan). Free addresses first (`*.ondigitalocean.app`, `*.vercel.app`); a custom domain can come later.

You do everything that touches production. Claude never sees production passwords or keys. Keep a private note (password manager) for the **values sheet** below, and fill it in as you go.

Total time: about 1.5–2 hours the first time.

---

## Values sheet (fill in as you go, keep it private)

| # | Name | Where it comes from | Your value |
|---|---|---|---|
| V1 | Supabase project URL | Step 2 | `https://xxxx.supabase.co` |
| V2 | Supabase anon (public) key | Step 2 | |
| V3 | Supabase service_role key (**secret**) | Step 2 | |
| V4 | Database password (**secret**) | Step 2 | |
| V5 | Database pooler connection string (**secret**, contains V4) | Step 2 | |
| V6 | Supabase CA certificate (public, not secret) | Step 2 | `prod-ca-2021.crt` file |
| V7 | `INTERNAL_PROXY_SECRET` (**secret**, same in API and web) | Step 0 | |
| V8 | `BOOTSTRAP_TOKEN` (**secret**, temporary) | Step 0 | |
| V9 | VAPID public key | Step 0 | |
| V10 | VAPID private key (**secret**) | Step 0 | |
| V11 | Web address | Step 4 | `https://<name>.vercel.app` |
| V12 | API address | Step 3 | `https://<name>.ondigitalocean.app` |

---

## Step 0: make the secrets (on your PC, 5 min)

Open Git Bash (or a terminal) in `D:\Code Space\WorkSpace\HOK\hok-api` and run:

```bash
# V7 and V8: two different long random values
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# V9 and V10: push notification keys (only needed if you want phone/desktop push)
npx web-push generate-vapid-keys
```

Copy the first value to V7, the second to V8, and the VAPID public and private keys to V9 and V10. Never reuse the local dev values from `.env`.

---

## Step 1: put the code on GitHub (with Claude, about 15 min)

Vercel and DigitalOcean deploy from GitHub.

**One repo for both apps works fine.** Vercel and DigitalOcean each let you pick a sub-folder ("Root directory" / "Source directory"), so one private repo `hok` can hold `hok-api/`, `hok-web/` and `docs/`. Claude will:
1. commit the security fixes in each app (you say yes first);
2. join both apps into one repo at the `HOK` folder, **keeping both histories**. The old `.git` folders are kept as a backup in `HOK/.repo-backups/`;
3. leave out the things that must never go online: `.env` files, `security-audit/` (it describes weak spots), `graphify-out/`, `node_modules`, build folders.

You then:
1. Go to github.com → **New repository** → name `hok` → **Private** → no README → Create.
2. Give Claude the repo address (`https://github.com/<you>/hok.git`). Claude adds it and pushes after you say yes.

---

## Step 2: Supabase (database + login), about 25 min

1. **Create the project:** supabase.com → New project.
   - Name: `hok-prod`. Region: **South Asia (Mumbai)**, near your staff and the API.
   - Database password: click **Generate**. Save it as **V4**.
   - Plan: Free works to start, but has **no daily backups**. Pro ($25/month) adds them. Decide before real client data goes in.
2. **Keys:** Project Settings → **API**.
   - Project URL → **V1**.
   - `anon` `public` key → **V2**.
   - `service_role` key → **V3**. This one is a master key: never paste it in chat, in Vercel, or in any browser code.
3. **Connection string:** click **Connect** (top bar) → **Session pooler**. Copy the URI, put your password (V4) in it, and remove any `?sslmode=...` at the end. Save as **V5**. It looks like
   `postgresql://postgres.xxxx:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`.
   Use the *pooler*, not the "Direct connection", which is IPv6-only and won't work from DigitalOcean.
4. **SSL:** Project Settings → **Database** → SSL Configuration.
   - **Download certificate** → **V6**.
   - Turn **Enforce SSL on incoming connections** ON.
5. **Create the tables (apply the 20 migrations):** in Git Bash, inside `D:\Code Space\WorkSpace\HOK\hok-api`:
   ```bash
   npx supabase@2.119.0 login                       # opens the browser once
   npx supabase@2.119.0 link --project-ref <xxxx>    # xxxx = the id in V1; asks for V4
   npx supabase@2.119.0 db push --dry-run            # lists the 20 migrations it would apply
   npx supabase@2.119.0 db push                      # applies them, in order
   ```
   Expect 20 files, from `20261013000001_profiles.sql` to `20261030000004_revoke_data_api_reads.sql`. **Never run `npm run seed` against production**: it creates test accounts with a known password.
6. **Login settings:** Authentication → **Sign In / Providers**.
   - **Allow new users to sign up: OFF.** Only the Admin creates accounts.
   - Email provider stays **on**, because staff sign in with email + password. Confirm email: off. No email server (SMTP) is needed: reset emails are turned off in the app.
   - Minimum password length: **8**.
   - **Secure password change: ON.**
7. **Address settings:** Authentication → **URL Configuration**. Site URL = **V11** (fill in after Step 4; until then put `https://hok-web.vercel.app` or the name you'll choose).

---

## Step 3: the API on DigitalOcean App Platform, about 25 min

1. cloud.digitalocean.com → **Apps** → **Create App** → **GitHub** → allow access to the `hok` repo → branch `main`.
   - **Source directory: `/hok-api`**. It will find the `Dockerfile`; keep "Dockerfile" as the build type.
   - Autodeploy: on (every push to `main` redeploys).
2. **Resource settings:**
   - Type: Web Service. Size: **Basic, 512 MB RAM / 1 vCPU ($5)**, 1 container.
   - **HTTP port: `4100`.**
   - **Health check:** HTTP, path **`/health`**.
   - Region: **Bangalore (BLR1)**, closest to Supabase Mumbai.
3. **Environment variables.** Click "Encrypt" on each one marked secret:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `NODE_OPTIONS` | `--max-old-space-size=384` |
   | `DATABASE_URL` 🔒 | V5 (no `sslmode` in it) |
   | `DATABASE_SSL_CA` | contents of V6 (open the .crt in Notepad, copy everything, including the BEGIN/END lines) |
   | `SUPABASE_URL` | V1 |
   | `SUPABASE_ANON_KEY` | V2 |
   | `SUPABASE_SERVICE_ROLE_KEY` 🔒 | V3 |
   | `CORS_ALLOWED_ORIGIN` | V11 (web address, `https://…`, no trailing slash) |
   | `WEB_APP_URL` | V11 |
   | `PUBLIC_API_URL` | V12 (this API's own address, no `/api/v1`). If you don't know it yet, deploy once, copy it, then set this and redeploy |
   | `TRUST_PROXY` | `1` (checked in Step 6) |
   | `INTERNAL_PROXY_SECRET` 🔒 | V7 |
   | `BOOTSTRAP_TOKEN` 🔒 | V8 (**temporary**, removed in Step 5) |
   | `DEFAULT_TIMEZONE` | `Asia/Kolkata` |
   | `VAPID_PUBLIC_KEY` | V9 (skip all three VAPID values if you don't want push) |
   | `VAPID_PRIVATE_KEY` 🔒 | V10 |
   | `VAPID_SUBJECT` | `mailto:houseofkhalaq@gmail.com` (any contact address) |

   Leave everything else unset; the defaults are the tested ones. If a value is wrong, the API refuses to start, and the reason is in **Runtime Logs** (for example "Must be the public https:// address in production").
4. **Create** → wait for the build (5–8 min). Copy the app address → **V12**.
5. **Check:** open `V12/health` (should say `"status":"ok"`) and `V12/health/ready` (should say `"ready"`).
   - If `/health/ready` fails with a certificate error: see "If something goes wrong" below.
   - If the logs say "unsupported startup parameter": add `DB_STATEMENT_TIMEOUT_MS` = `0`, and run `alter role postgres set statement_timeout = '15s';` in Supabase → SQL Editor.

---

## Step 4: the website on Vercel, about 15 min

1. vercel.com → **Add New → Project** → import the `hok` repo.
   - **Root Directory: `hok-web`**. Framework: Next.js (auto-detected).
   - Project name: e.g. `hok-web`. The address becomes `https://hok-web.vercel.app` (or a variant if the name is taken) → **V11**.
2. **Environment variables** (Production):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE_URL` | V12 + `/api/v1` (e.g. `https://hok-api-xxxx.ondigitalocean.app/api/v1`) |
   | `NEXT_PUBLIC_WEB_APP_URL` | V11 |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | V9 (only if push is on) |
   | `INTERNAL_PROXY_SECRET` 🔒 | V7, **exactly** the same as on the API. Mark it Sensitive. It must **not** start with `NEXT_PUBLIC_` |

   Never put V3, V4, V5, V8 or V10 in Vercel.
3. **Deploy.** When it's live, copy the real address. If it differs from what you guessed, update **V11** in three places: DigitalOcean `CORS_ALLOWED_ORIGIN` and `WEB_APP_URL` (the API redeploys), and Supabase Site URL.
4. Because `NEXT_PUBLIC_…` values are baked in at build time, changing one later needs a **Redeploy** in Vercel.

---

## Step 5: create the first Admin (the Owner), 5 min

1. Open `V11/setup`. Enter the setup key (V8), your name, email and a strong password.
2. This first account is the **Owner**: only the Owner can create, demote, deactivate or reset other Admins.
3. **Turn setup off:** in DigitalOcean, **delete** `BOOTSTRAP_TOKEN` → Save (the API redeploys). Opening `/setup` should now refuse.
4. Sign in at `V11/login`. Create the staff accounts under Users. The app shows each new password once; pass it on in person or by phone.

---

## Step 6: checks after go-live, 15 min (we can do these together in chat)

1. **Pages:** log in, open a client, the calendar, tasks; log out and back in.
2. **Rate limit sees the real visitor (`TRUST_PROXY`).** In Git Bash on your PC:
   ```bash
   API=https://<V12>/api/v1
   # A: 31 junk requests from your PC -> the last line must be 429
   for i in $(seq 31); do curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer junk" $API/auth/me; done | tail -1
   # B: the same with a faked address header -> the last line must ALSO be 429 (a fake header must not help)
   for i in $(seq 31); do curl -s -o /dev/null -w "%{http_code}\n" -H "X-Forwarded-For: 9.9.9.$i" -H "Authorization: Bearer junk" $API/auth/me; done | tail -1
   ```
   C: right after A, open `V12/api/v1/auth/me` on your **phone using mobile data** (not Wi-Fi). It must show the "Missing bearer token" error (401), **not** "Too many attempts" (429).
   - A=429, B=429, C=401: `TRUST_PROXY=1` is right.
   - C=429: everyone shares one limit. Set `TRUST_PROXY=2`, redeploy, and repeat A–C.
   - B never reaches 429: the value is too high. Lower it.

   The block from A/B lifts after 15 minutes.
3. **Login from the website still works for everyone** after test A (it goes through Vercel with the signed address).
4. **Push** (if on): My profile → turn on notifications → "Send a test".
5. **Client portal:** make a portal link for a test client and open it in a private window.
6. **Calendar link:** make a Google Calendar link; the address must start with V12.
7. **`/api-docs`:** `V12/api-docs` lists every endpoint. That's harmless, but say if you want it hidden in production.

---

## If something goes wrong

| Symptom | Fix |
|---|---|
| API won't start; the log names a setting | Set it as the message says (all `https://`, no localhost; `TRUST_PROXY` and `INTERNAL_PROXY_SECRET` must be set) |
| `/health/ready` fails: "self-signed certificate in certificate chain" | `DATABASE_SSL_CA` is missing or broken. Paste the whole certificate again, and make sure `DATABASE_URL` has no `sslmode` |
| "unsupported startup parameter" | `DB_STATEMENT_TIMEOUT_MS=0` plus the SQL in Step 3.5 |
| Website shows "couldn't reach the server" / CORS error in the browser console | `CORS_ALLOWED_ORIGIN` must be exactly V11 (https, no trailing slash); `NEXT_PUBLIC_API_BASE_URL` must end in `/api/v1`, then redeploy Vercel |
| Everyone gets "Too many attempts" at login | `INTERNAL_PROXY_SECRET` differs between Vercel and DigitalOcean (or is missing on one) |
| Push says not configured | VAPID values missing on the API, or `NEXT_PUBLIC_VAPID_PUBLIC_KEY` missing on Vercel (redeploy after adding) |

## Costs to expect
- DigitalOcean: $5/month flat (data out beyond 50 GiB at $0.02/GiB; about 21 GiB expected at heavy use). Set a billing alert at $10.
- Vercel Hobby: free. Note that Hobby is meant for non-commercial use; for a business, Vercel Pro is $20/month per member.
- Supabase: Free (no backups, pauses after a week with no activity), or Pro at $25/month with daily backups. Recommended once real data is in.

## Later
- Custom domain: add it in Vercel (web) and DigitalOcean (API), then update V11/V12 everywhere (CORS, WEB_APP_URL, PUBLIC_API_URL, NEXT_PUBLIC_API_BASE_URL, Supabase Site URL).
- Error alerts (DigitalOcean alerts or Sentry).
