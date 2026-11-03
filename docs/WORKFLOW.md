# HOK: lean development workflow (token-efficient)

> Adopted 2026-10-15 after the 5-agent setup hit the Claude Pro usage limit twice in one day. Quality bar unchanged; waste removed.

## What burned the tokens (measured, not guessed)

1. **Long-lived agents that kept being resumed.** Each agent finished one milestone and was handed the next, so its transcript kept growing (≈270k–440k tokens per agent). Every tool call re-reads that whole context.
2. **Five at once, three on Opus.** Five parallel contexts, mostly on the most expensive model.
3. **Shared-file churn.** Five agents editing the same `openapi.yaml`, `seed.ts`, `README.md`, `app.ts` and `rbac-matrix.mjs` meant constant re-reading. The main session also received a "file changed" diff of every edit, which bloated its own context.
4. **Heavy verification, repeatedly.** Full integration suites, Playwright and screenshots (images are expensive) run several times per milestone.
5. **Long reports and chatty coordination** (relayed notes, status questions, resume messages).

## The rules from now on

1. **Default = the main session works alone**, milestone by milestone. Use a helper agent only for a *truly independent* chunk (e.g. a separate module), at most **2 at a time**, on **Sonnet**. The main session (Opus) plans and reviews.
2. **Fresh, short-lived agents.** One agent = one bounded task, then it ends. **Never resume** a finished agent for new work; start a new one with a short brief.
3. **Task brief, not exploration.** Each agent gets a ≤20-line brief: goal, exact files/modules, the API contract, acceptance criteria, and "read only these files". Agents don't read CLAUDE.md history or other modules beyond the one named as the pattern.
4. **Shared files belong to the main session.** Agents build inside their own module folder. The main session does the small wiring in shared files (router mount, schema list, nav item, openapi/seed/README sections) at the end, once.
5. **Verify once per milestone.** During work: targeted unit tests only. At the end: one full run (lint, typecheck, unit, integration, rbac, build, one e2e). Screenshots only when a visual question needs answering.
6. **Reports ≤10 lines:** outcome, files changed, checks with counts, blockers. No narratives.
7. **Approvals batched:** one approval per milestone for its migration + seed. Migrations are applied only by the main session, after the user's yes (never by an agent; never `migration up` while unapproved files exist: move them aside or apply one by one).
8. **Handoff = `docs/STATUS.md`.** Update it at each milestone end. A new session reads STATUS.md (+ CLAUDE.md) and nothing else to resume.
9. **The main session stays lean:** no polling, short replies, no re-reading big files it already knows, and `/compact` or a new session between milestones.

10. **Model policy: Opus designs and reviews; Sonnet implements well-specified pieces; security-critical code stays with Opus.** Opus (main session) owns architecture, data model, migrations, security design (auth, RBAC, the public portal and its tokens, rate limits) and the final review of every helper's diff. Sonnet helpers implement bounded, pattern-following work (a module shaped like an existing one, screens from components/ui, tests, docs, lint fixes). Automated gates protect quality regardless of model: lint, typecheck, unit/integration tests, RBAC matrix, OpenAPI drift test, query budget, e2e.

## Round playbook (learned 2026-11-02..04, team-feedback rounds 1–2)

The plan-spec-build-review loop: Opus writes `docs/specs/round-N.md`, two Sonnet helpers (API and web) build it in parallel against a fixed contract, and Opus reviews and re-runs every gate. It worked: no contract mismatches, and the review found no security bugs. It cost too much because of what follows.

**What it cost.**
- Each helper used **240k–530k tokens**.
- Two helper pairs were lost: one stopped by the user, and one by the 5-hour usage limit mid-work. Each restart had to re-read and re-review everything, which roughly doubled the cost of those rounds.

**Spec rules (the main session, when writing a round spec):**
1. **Keep the proven skeleton:**
   - §0 rules (only the app folder, no git writes, no Docker, local DB only with a localhost check, keep line endings);
   - one section per area;
   - an exact **contract** block;
   - a **permission table** (who gets which status per endpoint);
   - seed and test lists.
2. **Add an "Impact list"**: existing features a model change breaks or alters. Examples:
   - derived status ended board drag-and-drop;
   - a removed endpoint breaks old e2e tests;
   - a new unique name collides with a seed row.

   Helpers otherwise discover these late, or remove features silently.
3. **Say the refusal for every "not allowed" case:** status code plus error code. Also name the **existing guard** that covers each read, or say "check X". Both gaps made helpers guess (round 1 `relation=team`; round 2 template reads).
4. **List files to read, not modules to explore:** "read `events/domain/event.rules.ts` assertStageMove as the pattern". Whole-module reading was the biggest token cost.
5. Keep migrations additive, and make **old API + new schema** safe during the deploy window. Production runs `db push` before the deploy.

**Helper prompt rules:**
1. **Progress file.** Each helper appends one line per finished part to `docs/specs/round-N-progress-<api|web>.md` (its only file outside its app). A replacement helper reads that file instead of re-reviewing everything.
2. **Test budget:**
   - while working: only the targeted test files (`vitest run <path>`);
   - at the end: one full run of lint, typecheck, unit, integration, RBAC, build and bundle;
   - Playwright: only new or affected spec files, one file at a time, with `touch hok-api/src/index.ts` between them (login rate limit);
   - screenshots: only new screens, at 390 and 1280 px.
3. **Own scratch folder per helper:** `<scratchpad>/round-N-<api|web>/`. Shared scratch files overwrote each other.
4. `next build` adds lines to `tsconfig.json`, so build with `NEXT_DIST_DIR=.next-<name>`, back `tsconfig.json` up first, and restore it byte for byte afterwards.
5. **Helpers may apply the round's migration to the LOCAL DB** (localhost check, recorded in `supabase_migrations.schema_migrations`). This replaces rule 7 above for local work. Production stays the user's `db push`.
6. Reports stay at 15 lines or fewer: files, counts, gaps and decisions, unfinished.

**Running a round:**
- Start helpers only with plenty of the 5-hour window left. If the limit stops them, start **fresh** helpers that read the progress files; don't resume.
- Big risky rounds (approvals, parent/child): split the API work into two sequential helpers (data plus domain and service, then routes plus tests) rather than one 500k-token helper.
- Main session: edit docs with the Edit tool, never regex scripts. A `String.replace` with an empty match once dumped rows at the top of REQUIREMENTS.md.

## When parallel agents *are* worth it

Two modules with no shared tables and no shared screens (e.g. M10 dashboards UI while M8 portal UI is built), both specified up front. Otherwise sequential is cheaper and nearly as fast, because the main session wastes nothing on coordination.
