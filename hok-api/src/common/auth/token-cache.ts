import { createHash } from "node:crypto";

const TTL_MS = 30_000;
const MAX_ENTRIES = 500;

type Entry = { userId: string; until: number };
const entries = new Map<string, Entry>();

// Keyed by a hash so no raw bearer token sits in memory.
const keyOf = (token: string) => createHash("sha256").update(token).digest("hex");

function jwtExpMs(token: string): number {
  try {
    const exp = (JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8")) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Short-lived memory of tokens Supabase Auth has just confirmed, so a burst of calls from one
 * session costs one network round trip, not one each. A token is trusted for at most 30 s and never
 * past its own expiry. Signing a user out everywhere (deactivation, password change) drops their
 * entries at once, and the active-profile check still runs on every request. Per process: if the
 * API is ever scaled to several containers, a remote sign-out can take up to 30 s to reach the others.
 * Only successful checks are stored, so bad tokens can never fill it.
 */
export const tokenCache = {
  get(token: string, now = Date.now()): string | null {
    const key = keyOf(token);
    const hit = entries.get(key);
    if (!hit) return null;
    if (hit.until <= now) {
      entries.delete(key);
      return null;
    }
    return hit.userId;
  },
  set(token: string, userId: string, now = Date.now()): void {
    const until = Math.min(now + TTL_MS, jwtExpMs(token));
    if (until <= now) return;
    if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value!); // oldest first
    entries.set(keyOf(token), { userId, until });
  },
  dropToken(token: string): void {
    entries.delete(keyOf(token));
  },
  dropUser(userId: string): void {
    for (const [key, entry] of entries) if (entry.userId === userId) entries.delete(key);
  },
  clear(): void {
    entries.clear();
  },
};
