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

## When parallel agents *are* worth it

Two modules with no shared tables and no shared screens (e.g. M10 dashboards UI while M8 portal UI is built), both specified up front. Otherwise sequential is cheaper and nearly as fast, because the main session wastes nothing on coordination.
