import "dotenv/config";
import { z } from "zod";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "../domain/time-zone";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** 4100, not needleye's 4000, so both projects can run on one machine. */
  API_PORT: z.coerce.number().default(4100),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  /** Exact allow-list of web origins (comma-separated), never a wildcard. */
  CORS_ALLOWED_ORIGIN: z.string().default("http://localhost:3400"),
  /** Where the frontend lives -- used to build the redirect URL Supabase puts in password-reset emails. */
  WEB_APP_URL: z.string().default("http://localhost:3400"),
  /** This API's public address (no /api/v1), for links outside apps fetch, e.g. the calendar subscribe feed. Production: the https URL. */
  PUBLIC_API_URL: z.string().url().default("http://localhost:4100"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  /** Queries slower than this (ms) are logged at WARN for observability. See common/database/query-timing. */
  SLOW_QUERY_MS: z.coerce.number().default(250),
  /**
   * Max Postgres connections in the pool (the whole app shares one pool). The
   * main concurrency lever: raise it for higher simultaneous load, but keep it
   * comfortably under the database's connection limit. Default 10 suits
   * ~20-50 staff.
   */
  DB_POOL_MAX: z.coerce.number().int().min(1).default(10),
  /** Auth rate-limit window (ms) and max requests per window per IP. Defaults: 15 min / 30 attempts. */
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(30),
  /**
   * Public client portal (M8), per IP: reads per 15 minutes, comment posts per
   * hour; plus a firm-wide hourly ceiling on comment posts and a daily cap
   * per portal link. Defaults: 300 / 10 / 300 / 30.
   */
  PORTAL_READ_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  PORTAL_COMMENT_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  PORTAL_COMMENT_GLOBAL_MAX_PER_HOUR: z.coerce.number().int().min(1).default(300),
  PORTAL_COMMENT_MAX_PER_LINK_PER_DAY: z.coerce.number().int().min(1).default(30),
  /**
   * Express `trust proxy` setting -- how many/which proxy hops sit in front of
   * the API, so the rate limiter keys on the real client IP from
   * X-Forwarded-For instead of the proxy's. Accepts a hop count ("1"), a
   * preset ("loopback"), or "false" to disable. Default trusts loopback: in
   * dev the Next.js session proxy calls the API over 127.0.0.1/::1 and forwards
   * XFF, which would otherwise make express-rate-limit throw. In production set
   * this to the number of proxies in front of the app. Never a blanket "true"
   * (that lets any client spoof its IP).
   */
  TRUST_PROXY: z.string().default("loopback"),
  /**
   * The firm's home IANA time zone: the default for new users and clients.
   * Everyone can still pick their own zone (multiple time zones, REQUIREMENTS
   * NFR-08); instants are always stored in UTC.
   */
  DEFAULT_TIMEZONE: z.string().default(DEFAULT_TIME_ZONE).refine(isValidTimeZone, "Must be an IANA timezone, e.g. Asia/Kolkata"),
  /**
   * Web Push (M9, ARCHITECTURE §8). The VAPID key pair identifies this server
   * to the browsers' push services: generate one per environment with
   * `npx web-push generate-vapid-keys` and keep the private key secret (never
   * commit it). The subject is a contact for the push services: `mailto:` or
   * an https URL. All three unset = push is off (the in-app bell still works).
   */
  VAPID_PUBLIC_KEY: z.string().trim().optional().transform((v) => v || undefined),
  VAPID_PRIVATE_KEY: z.string().trim().optional().transform((v) => v || undefined),
  VAPID_SUBJECT: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => v === undefined || /^(mailto:|https:\/\/)/.test(v), "Must start with mailto: or https://"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration. Check hok-api/.env against .env.example.");
}

export const env = parsed.data;
