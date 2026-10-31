# Project Scale & Engineering Strategy

Internal agency-management API for one marketing firm. ~20-50 staff,
~100-500 clients, single organization, several time zones, business data
(clients, events, tasks, comments) that people rely on day to day.
Accuracy, maintainability, and reliability matter far more than extreme
scalability. **Do not overengineer.** Always prefer the simplest solution
that satisfies the current requirement while remaining extensible.

> **Agent working rules** (asking before acting outside `HOK/`, never touching
> other projects, git only with an explicit yes, never production): see
> `../CLAUDE.md` §0. They apply to every session and every helper agent.

This repo is modelled on `needleye-pilot/needleye-api` (read-only
reference): same architecture, conventions, code style and documentation
style. When a pattern is needed, copy and adapt it from there rather than
inventing a new one.

## Mandatory, non-negotiable

Consistent architecture · clean code · SOLID · high cohesion · low coupling ·
proper authentication/authorization · strong validation · consistent error
handling · structured backend logging · proper database migrations ·
development seed data · a Dockerized backend dev environment · CI pipelines ·
comprehensive documentation.

## Keep it simple

Unless explicitly requested, do **not** introduce: microservices, Kubernetes,
Redis, CQRS, Event Sourcing, a distributed event bus, Kafka, RabbitMQ,
message queues, distributed tracing (Jaeger/Zipkin/OpenTelemetry), complex
caching layers, multi-region deployment, a WebSocket server, file storage
(assets are links only), or highly abstract generic frameworks. Phase 2
reminders use an in-process job runner (`FOR UPDATE SKIP LOCKED`), not a queue.

**The Feature-Based Modular Monolith (see README's "Architecture") is the
correct architecture for this project. Keep improving it, don't replace it.**

## Testing strategy (Testing Pyramid -- don't test every line equally)

- **Unit tests (highest priority)**: business logic -- domain rules,
  validation, permission/RBAC logic, ownership scoping, time-zone and
  date maths, stage/status transitions. These should be the majority of
  tests. This maps directly onto every module's `domain/*.rules.ts` file,
  plus each `application/*.service.test.ts` against in-memory fakes.
- **Integration tests**: Repository ↔ Database, Service ↔ Repository,
  authentication, API endpoints, DB transactions, the query budget.
- **RBAC matrix** (`npm run test:rbac`): every endpoint × all six roles
  against the running API. Every new endpoint adds its cases.
- **E2E tests** (hok-web, Playwright): only for critical workflows -- login,
  create client, create event and move a stage, assign and close a staff
  task, client portal comment. Not every page/button.
- **Manual testing** before calling a feature done: desktop, mobile
  responsiveness, auth, authz, error scenarios, the important workflows.

## Performance

Appropriate for realistic concurrent usage at this scale -- not
enterprise-scale load testing. Every query gets reviewed for N+1s, duplicate
queries, unnecessary joins, excessive round trips, unnecessary columns. No
premature optimization.

The concrete rules (pagination caps, no N+1, indexing, bounded-by-live-set
queries) and the reasons for them are in `docs/engineering-practices.md` --
follow them. Check: `tests/integration/query-budget.integration.test.ts`
(runs with `test:integration`). Add every new list/search/report query to it.
(A volume-based query audit, needleye's `npm run test:perf`, arrives in M11.)

## Monitoring & logging

Track API errors, unhandled exceptions, login failures, DB errors, slow
queries, request duration. Structured logging (pino, already in place).
Never log passwords, tokens, portal tokens, secrets, or personal/confidential
data (client contact details included).

## Security

Every backend change gets a security review: auth, authz, JWT validation,
RBAC (capability **and** row scope: a manager sees only their own clients),
input validation, SQL injection prevention, secure HTTP headers, XSS
protection, CSRF protection where applicable, and -- from M8 -- the public
client-portal surface (hashed tokens, rate limits, size limits).

## CI strategy

CI only -- no CD until production is planned (local machine only for now).

- **Frontend CI** (hok-web): install, lint, typecheck, unit tests, build.
- **Backend CI** (this repo): install, lint, typecheck, unit tests, build,
  Docker image build verification; plus an integration job against a local
  Supabase stack.

## Local development

Minimal setup. One command (`..\start-dev.ps1`, or `npm run dev:up` for the
backend alone) starts Postgres/Auth, applies migrations, optionally seeds dev
data, and starts the servers. Dev data resets with `-Reset` when appropriate.
HOK's ports are offset from needleye's (Supabase 544xx, API 4100, web 3400)
so both can run at once.

## Engineering standard -- applies to every future change

Every implementation, refactor, optimization, bug fix, and feature must
automatically include a review of whether these need updating -- **do not
wait to be asked**:

Automated tests · the RBAC matrix · documentation · architecture
documentation (README, ADRs) · flow diagrams (when architecture/workflow
changes) · API documentation (`openapi.yaml`) · logging · error handling ·
validation · security · performance · database migrations · seed data ·
environment configuration · CI configuration.

## Definition of done

Not done just because the feature works. Done means: implemented correctly ·
existing functionality unaffected · tests added/updated (unit, integration,
RBAC matrix) · `openapi.yaml` and README current · logging reviewed · error
handling reviewed · security reviewed · performance reviewed (query budget) ·
migrations added if needed (new files only, never edit an applied one) · seed
data updated if needed · build succeeds · typecheck passes · lint passes · CI
passes.

Always balance maintainability, simplicity, and production readiness. Avoid
overengineering. Prefer the simplest architecture and implementation that
cleanly solves the problem while staying extensible.
