import { sql } from "drizzle-orm";
import { db } from "./drizzle-client";
import { logger } from "../logger/logger";

/**
 * Last seen (REQUIREMENTS FR-SYS-03): when a person last used HOK. Called by
 * requireAuth on every authenticated request, but writes their own
 * profiles.last_seen_at at most once per WRITE_EVERY_MS:
 *   - an in-memory note per user skips the database entirely in between;
 *   - the UPDATE carries the same condition, so several API instances (or a
 *     restart that forgot the notes) still write at most once per window.
 * Fire-and-forget: the request never waits for it and a failure is only
 * logged. Reading it is a primary-key lookup -- never a scan of any log.
 * (The profiles updated_at trigger also moves; nothing reads profiles.updated_at.)
 */
export const LAST_SEEN_WRITE_EVERY_MS = 5 * 60 * 1000;
/** Bound the in-memory notes (20-30 staff today; this only guards against surprises). */
const MAX_NOTES = 10_000;
const lastWrite = new Map<string, number>();

export function touchLastSeen(userId: string, now: number = Date.now()): void {
  const prev = lastWrite.get(userId);
  if (prev !== undefined && now - prev < LAST_SEEN_WRITE_EVERY_MS) return;
  if (lastWrite.size >= MAX_NOTES) lastWrite.clear();
  lastWrite.set(userId, now);
  db.execute(
    sql`update public.profiles set last_seen_at = now()
        where id = ${userId}
          and (last_seen_at is null or last_seen_at < now() - make_interval(secs => ${LAST_SEEN_WRITE_EVERY_MS / 1000}))`,
  ).catch((err: unknown) => logger.warn({ err, userId }, "could not record last seen"));
}

/** Tests only: forget the in-memory notes. */
export function resetLastSeenNotes(): void {
  lastWrite.clear();
}
