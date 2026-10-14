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

  // The API sits behind a proxy that sets X-Forwarded-For: the Next.js session
  // proxy in dev (over loopback), and a reverse proxy (Railway) in prod.
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
  // The public client-portal routes (M8) mount here, BEFORE the global JSON
  // parser, with their own small body limit -- needleye's public-form pattern.
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
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  // Every module's router mounts under /api/v1.
  const apiV1 = express.Router();
  app.use("/api/v1", apiV1);
  apiV1.use("/auth", authRouter);
  apiV1.use("/users", usersRouter);
  apiV1.use("/clients", clientsRouter);
  apiV1.use("/stage-templates", stageTemplatesRouter);
  apiV1.use("/events", eventsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
