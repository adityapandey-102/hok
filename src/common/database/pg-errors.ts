/**
 * Recognises specific Postgres failures a repository wants to turn into a
 * domain error (e.g. a unique name -> 409). Drizzle may wrap the pg error in
 * `cause`, so both levels are checked. Only the SQLSTATE and constraint name
 * are read -- never `detail`, which carries row values.
 */
function pgFields(err: unknown): { code?: unknown; constraint?: unknown } | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { code?: unknown; constraint?: unknown; cause?: unknown };
  if (typeof e.code === "string") return e;
  return e.cause && typeof e.cause === "object" ? e.cause : undefined;
}

/** True for SQLSTATE 23505 (unique_violation), optionally on one named constraint/index. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const f = pgFields(err);
  return f?.code === "23505" && (constraint === undefined || f.constraint === constraint);
}
