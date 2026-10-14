/**
 * Frontend logging — the one way to log on the web app (browser AND Node/RSC).
 *
 * Deliberately tiny (no dependency): a leveled, structured console logger plus
 * helpers that turn raw fetch/HTTP failures into a friendly user message while
 * recording the technical detail for developers. Mirrors the backend's
 * structured-logging discipline (pino there) without pulling a logger into the
 * bundle.
 *
 * Rules:
 *   - NEVER pass tokens, passwords, or full auth headers into a log context.
 *   - User-facing strings come from `describeFetchError` / `ApiFailure.message`;
 *     the raw error/stack goes only to the log, never to the UI.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// In production only warn/error reach the console; in dev everything does.
const MIN_LEVEL: LogLevel = process.env.NODE_ENV === "production" ? "warn" : "debug";

const isBrowser = typeof window !== "undefined";

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const entry = {
    level,
    where: isBrowser ? "client" : "server",
    time: new Date().toISOString(),
    message,
    ...(context ? { context } : {}),
  };

  // console.error/warn keep the browser + server stderr semantics; the object
  // stays structured so it's greppable in logs and expandable in devtools.
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : level === "info" ? console.info : console.debug;
  fn(`[hok] ${message}`, entry);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};

/**
 * A network/transport failure (the server was unreachable, DNS failed, the
 * request was aborted) -- as opposed to an HTTP error the server actually
 * returned. Carries a friendly `message` safe to show the user.
 */
export class ApiFailure extends Error {
  readonly kind: "network" | "timeout" | "http";
  readonly status?: number;
  constructor(message: string, kind: ApiFailure["kind"], status?: number) {
    super(message);
    this.name = "ApiFailure";
    this.kind = kind;
    this.status = status;
  }
}

/**
 * Turns a thrown fetch error (browser `TypeError: Failed to fetch`, Node
 * `ECONNREFUSED`/`ENOTFOUND`, an `AbortError`, etc.) into a friendly,
 * user-safe message. The technical cause is logged separately by the caller.
 */
export function describeFetchError(err: unknown): { message: string; kind: ApiFailure["kind"] } {
  const raw = err instanceof Error ? err : new Error(String(err));
  const text = `${raw.name} ${raw.message} ${(raw as { cause?: { code?: string } }).cause?.code ?? ""}`.toLowerCase();

  if (raw.name === "AbortError" || text.includes("timeout") || text.includes("timed out")) {
    return { message: "The request timed out. Please try again.", kind: "timeout" };
  }
  if (
    text.includes("failed to fetch") ||
    text.includes("networkerror") ||
    text.includes("econnrefused") ||
    text.includes("enotfound") ||
    text.includes("econnreset") ||
    text.includes("network request failed")
  ) {
    return { message: "Can't reach the server. Check your connection and try again.", kind: "network" };
  }
  return { message: "Something went wrong talking to the server. Please try again.", kind: "network" };
}
