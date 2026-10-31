/**
 * "Last seen" wording (REQUIREMENTS FR-SYS-03): always how long ago, in the
 * largest whole unit -- minutes, hours, days, then weeks. The API records the
 * moment on the person's own row (at most every 5 minutes); anything older
 * than 45 days -- or never -- reads as not seen, so no one digs through history.
 */
export const LAST_SEEN_HORIZON_DAYS = 45;

export interface LastSeen {
  text: string;
  /** Older than 45 days, or never. */
  stale: boolean;
}

const unit = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`} ago`;

export function lastSeen(iso: string | null, now: number = Date.now()): LastSeen {
  const at = iso ? Date.parse(iso) : NaN;
  const mins = Math.floor((now - at) / 60_000);
  if (!iso || Number.isNaN(at) || mins > LAST_SEEN_HORIZON_DAYS * 24 * 60) {
    return { text: `Not seen in the last ${LAST_SEEN_HORIZON_DAYS} days`, stale: true };
  }
  if (mins < 60) return { text: `${Math.max(1, mins)} min ago`, stale: false };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { text: unit(hours, "hour"), stale: false };
  const days = Math.floor(hours / 24);
  if (days < 7) return { text: unit(days, "day"), stale: false };
  return { text: unit(Math.floor(days / 7), "week"), stale: false };
}
