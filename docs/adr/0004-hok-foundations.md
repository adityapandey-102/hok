# 0004: HOK-specific foundations -- ports, migrations, auth hardening, time zones

## Status

Accepted (2026-10-13), M0; amended in M2 for the account rules.

## Context

HOK copies needleye-api's stack and patterns (ADRs 0001–0003, and needleye's operational hardening: request context, error-code registry, audit logger, auth rate limiting, slow-query logging). A few decisions are HOK's own, because HOK runs on the same machine as needleye, starts from a clean slate, and works across several time zones.

## Decisions

1. **Local ports offset from needleye.** Supabase 54420–54429 (API 54421, Postgres 54422, Studio 54423, mail 54424, pooler 54429), hok-api 4100, hok-web 3400 (3100 is taken by another local app). needleye uses 543xx / 4000 / 3000, so both stacks run at once. Same pinned Supabase CLI (`supabase@2.119.0`), so Docker reuses the images already on disk; `-x imgproxy,edge-runtime,logflare,vector` skips containers nothing uses.

2. **Migrations are hand-written SQL in `supabase/migrations/`**, applied by the Supabase CLI; each module's Drizzle `*.schema.ts` mirrors its tables for typed queries and introduces no DDL. This is what needleye actually does in practice: every one of its migrations is SQL under `supabase/migrations/` and it has no `drizzle/` folder, although its README also describes a `db:generate` path. One migration tool, one source of DDL: business tables, CHECK constraints, triggers, RLS and grants live together. New files only; never edit an applied migration.

3. **Public sign-up is disabled** (`[auth] enable_signup = false`). Accounts are created only by hok-api with the service-role key: by the Admin (`POST /users`) or the one-time first-Admin bootstrap (`POST /auth/bootstrap`, refused once any admin exists).

4. **Storage and Realtime are disabled.** HOK stores links, never files (REQUIREMENTS: assets are links only), and has no realtime feature; there is no `StorageProvider` in v1. Analytics is off too (its log shipper needs the Docker daemon on TCP on Windows).

5. **Least-privileged default role in the `handle_new_user` trigger.** The trigger copies `full_name`, `role` and `time_zone` from the new auth user's metadata; a missing role falls back to `editor` (staff tasks only), never to a powerful role. `role` is a `CHECK`-constrained column and the source of truth for authorization -- never the JWT.

6. **Time zones stored per user** (and, later, per client and per event): `profiles.time_zone` is a named IANA zone, default `DEFAULT_TIMEZONE` (Asia/Kolkata). Instants are `timestamptz` in UTC. The API validates zones with `isValidTimeZone` (named zones only; raw offsets are refused because they carry no daylight-saving rules); the database check only stops empty or absurd values.

7. **Account rules (M2).** Both "self" rules exist so at least one Admin always remains: an Admin can't change their own role or deactivate themselves. The Admin can regenerate any staff password except their own (use password-update) and except another Admin's once that Admin has signed in (then it's theirs to manage, via forgot-password). Users edit their own name, phone, time zone and photo URL through `PATCH /auth/me`; only the Admin changes role, email-bound identity or active state. QR login (a needleye feature) is not carried over.

## Consequences

- Both projects can be developed side by side without port or image clashes.
- A schema change is one reviewed SQL file plus a matching edit to the module's `*.schema.ts`; the integration suite catches a mismatch.
- No path exists for an outsider to create an account, and a forgotten metadata field can never mint an Admin.
- Every time shown to a person is converted to *their* zone; nothing in the API assumes a single business time zone (unlike needleye's `BUSINESS_TIMEZONE`).
