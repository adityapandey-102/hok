import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { sql } from "drizzle-orm";
import { env } from "./config/env";
import { db } from "./common/database/drizzle-client";
import { describeDbError } from "./common/database/db-logging";
import { logger } from "./common/logger/logger";
import { requestLogger } from "./common/logger/request-logger.middleware";
import { requestContextMiddleware } from "./common/context/request-context.middleware";
import { errorHandler, notFoundHandler } from "./common/middleware/error.middleware";
import { openApiDocument } from "./docs/openapi";
import { authRouter } from "./modules/auth/api/auth.routes";
import { usersRouter } from "./modules/users/api/users.routes";
import { clientsRouter } from "./modules/clients/api/clients.routes";
import { stageTemplatesRouter } from "./modules/stage-templates/api/stage-templates.routes";
import { eventsRouter } from "./modules/events/api/events.routes";
import { personalEventsRouter } from "./modules/personal-events/api/personal-events.routes";
import { calendarFeedPublicRouter, calendarRouter } from "./modules/calendar/api/calendar.routes";
import { teamMembersRouter } from "./modules/team-members/api/team-members.routes";
import { assetsRouter } from "./modules/assets/api/assets.routes";
import { staffTasksRouter } from "./modules/staff-tasks/api/staff-tasks.routes";
import { clientTodosByClientRouter, clientTodosRouter } from "./modules/client-todos/api/client-todos.routes";
import { notificationsRouter } from "./modules/notifications/api/notifications.routes";
import { portalLinksRouter } from "./modules/portal/api/portal-links.routes";
import { portalPublicRouter } from "./modules/portal/api/portal-public.routes";
import { clientCommentsRouter, portalCommentsRouter } from "./modules/client-comments/api/client-comments.routes";
import { dashboardRouter } from "./modules/dashboard/api/dashboard.routes";
import { activityRouter } from "./modules/activity/api/activity.routes";
import { reportsRouter } from "./modules/reports/api/reports.routes";
import { searchRouter } from "./modules/search/api/search.routes";
import { requirePortalLink } from "./common/middleware/portal-link.middleware";
import { calendarFeedLimiter, portalReadLimiter } from "./common/middleware/portal-rate-limit.middleware";
import { tokenFailureRateLimiter } from "./common/middleware/rate-limit.middleware";

/** Turns the TRUST_PROXY env string into what Express's `trust proxy` expects:
 *  a boolean, a hop count, or a preset/subnet string (e.g. "loopback"). */
function parseTrustProxy(value: string): boolean | number | string {
  if (value === "false") return false;
  if (value === "true") return true;
  const n = Number(value);
  return Number.isInteger(n) && value.trim() !== "" ? n : value;
}

/**
 * Composition root: builds the Express app and mounts every module's
 * router. Each module wires its own controller/service/repository/mapper
 * internally (in its api/*.routes.ts); this file only knows about the
 * resulting routers, never about a module's internals.
 */
export function createApp() {
  const app = express();

  // The API sits behind a proxy that sets X-Forwarded-For: Railway's edge in prod (TRUST_PROXY=1),
  // nothing in dev. Calls hok-web's server makes for a browser carry the visitor's IP in a
  // secret-checked header instead (common/middleware/client-ip.ts), so this only has to be right
  // for direct browser calls.
  // Express must be told how far to trust XFF so the rate limiter keys on the
  // real client IP -- otherwise express-rate-limit throws when it sees an
  // untrusted XFF. Configured via TRUST_PROXY (default "loopback"): a hop count,
  // a preset like "loopback", or "false" to disable. See config/env.ts.
  app.set("trust proxy", parseTrustProxy(env.TRUST_PROXY));

  app.use(requestLogger);
  // Must come right after the request logger: it reads req.id (set above) so
  // the request-scoped context's id matches the logged req/res id.
  app.use(requestContextMiddleware);

  // Secure HTTP headers (HSTS, no-sniff, frameguard, hidden X-Powered-By,
  // etc). CSP is off globally -- this is a pure JSON API with no HTML views
  // of its own except /api-docs (Swagger UI), which needs inline
  // style/script that a default CSP would block.
  app.use(helmet({ contentSecurityPolicy: false }));

  // No `credentials: true` -- the API is stateless and bearer-token-only, it never
  // reads or sets cookies, so cross-origin requests never need to carry them
  // (this is also why CSRF protection doesn't apply here -- CSRF exploits
  // ambient cookie-based auth, which this API never has).
  //
  // CORS_ALLOWED_ORIGIN may be a single origin or a comma-separated list, so a
  // dev machine can allow both http://localhost:3400 and its LAN IP (phone
  // testing). An exact allow-list -- never a wildcard.
  const allowedOrigins = env.CORS_ALLOWED_ORIGIN.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(cors({ origin: allowedOrigins }));
  // The public client portal (M8): no login, the link token is the credential.
  // Mounted BEFORE the global JSON parser with its own small body limit (an
  // oversized body is a 413 before any work), behind the read limiter, and
  // only after requirePortalLink has resolved the token (same 404 for every
  // bad link). needleye's public-form pattern. Tokens are redacted from logs.
  app.use(
    "/api/v1/portal/:token",
    portalReadLimiter,
    express.json({ limit: "4kb" }),
    requirePortalLink,
    portalCommentsRouter,
    portalPublicRouter,
  );
  app.use(express.json());

  // Liveness: is the process up and serving? No dependencies checked -- an
  // orchestrator uses this to decide whether to restart the container.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Readiness: can the process actually serve traffic (DB reachable)? Returns
  // 503 if the DB check fails, so a load balancer stops routing to an
  // instance whose database is down instead of sending it doomed requests.
  app.get("/health/ready", (_req, res) => {
    void db
      .execute(sql`select 1`)
      .then(() => res.json({ status: "ready" }))
      .catch((err: unknown) => {
        logger.error({ db: describeDbError(err) ?? { message: err instanceof Error ? err.message : String(err) } }, "Readiness check failed -- database unreachable");
        res.status(503).json({ status: "not_ready", reason: "database_unreachable" });
      });
  });

  // Source of truth: openapi.yaml (repo root). Keep it updated alongside any
  // route change -- see README's "Keeping this documentation in sync".
  // Not served in production: the endpoint list is a map for attackers (security audit run 2).
  if (env.NODE_ENV !== "production") app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  // Every module's router mounts under /api/v1.
  const apiV1 = express.Router();
  // Counts only 401s per IP: a client flooding junk bearer tokens is cut off (rate-limit.middleware.ts).
  app.use("/api/v1", tokenFailureRateLimiter, apiV1);
  apiV1.use("/auth", authRouter);
  apiV1.use("/users", usersRouter);
  // Nested to-do routes first, so /clients/:id/todos never reaches the clients router.
  apiV1.use("/clients/:clientId/todos", clientTodosByClientRouter);
  apiV1.use("/clients", clientsRouter);
  apiV1.use("/stage-templates", stageTemplatesRouter);
  apiV1.use("/events", eventsRouter);
  apiV1.use("/personal-events", personalEventsRouter);
  apiV1.use("/calendar", calendarRouter);
  // Public calendar subscribe feed (FR-CAL-08): the token in the path is the credential.
  apiV1.use("/calendar-feed", calendarFeedLimiter, calendarFeedPublicRouter);
  apiV1.use("/team-members", teamMembersRouter);
  apiV1.use("/assets", assetsRouter);
  apiV1.use("/staff-tasks", staffTasksRouter);
  apiV1.use("/client-todos", clientTodosRouter);
  apiV1.use("/notifications", notificationsRouter);
  apiV1.use("/portal-links", portalLinksRouter);
  apiV1.use("/client-comments", clientCommentsRouter);
  apiV1.use("/dashboard", dashboardRouter);
  apiV1.use("/activity", activityRouter);
  apiV1.use("/reports", reportsRouter);
  apiV1.use("/search", searchRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
