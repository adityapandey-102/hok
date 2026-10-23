/**
 * Picking a time zone by what people know: a city ("London"), a zone's
 * common name ("India Standard Time", "Gulf Standard Time") or an offset
 * ("GMT+4", "+05:30"). The list is the browser's own zone database, which is
 * fixed (~420 entries), so it is searched here rather than on the server.
 */

/** Shown when the search box is empty: the zones HOK's clients are most often in. */
const COMMON = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Asia/Karachi",
  "Asia/Dhaka",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney",
  "Africa/Johannesburg",
  "UTC",
];

/** Old names some browsers (and Node) still list; people know the new ones. Both are valid IANA ids. */
const RENAMED: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "Atlantic/Faeroe": "Atlantic/Faroe",
};

let zones: string[] | null = null;
function allZones(): string[] {
  if (!zones) {
    let listed: string[] = [];
    try {
      listed = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    } catch {
      // Older browser: the common list below still works.
    }
    zones = [...new Set([...listed.map((z) => RENAMED[z] ?? z), ...COMMON])];
  }
  return zones;
}

function part(zone: string, timeZoneName: Intl.DateTimeFormatOptions["timeZoneName"], at: Date): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export interface TimeZoneOption {
  id: string;
  /** "London" / "Kolkata" / "New York". */
  city: string;
  /** "United Kingdom Time", "India Standard Time" (the browser's wording). */
  name: string;
  /** "GMT+5:30" right now (daylight saving included). */
  offset: string;
}

export function describeTimeZone(zone: string, at = new Date()): TimeZoneOption {
  const city = zone === "UTC" ? "UTC" : (zone.split("/").pop() ?? zone).replace(/_/g, " ");
  return { id: zone, city, name: part(zone, "longGeneric", at), offset: part(zone, "shortOffset", at).replace(/^GMT$/, "GMT+0") };
}

/** "Kolkata · India Standard Time (GMT+5:30)". */
export function timeZoneLabel(zone: string, at = new Date()): string {
  const z = describeTimeZone(zone, at);
  return z.name && z.name !== z.city ? `${z.city} · ${z.name} (${z.offset})` : `${z.city} (${z.offset})`;
}

const squash = (s: string) => s.toLowerCase().replace(/[\s_/·()]+/g, " ").trim();

/** "+05:30" / "+5:30" / "gmt+4" all mean an offset; returns "gmt+5:30" form, or null. */
function offsetQuery(q: string): string | null {
  const m = /^(?:gmt|utc)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i.exec(q.trim());
  if (!m) return null;
  const minutes = m[3] && m[3] !== "00" ? `:${m[3]}` : "";
  return `gmt${m[1]}${Number(m[2])}${minutes}`;
}

/** Up to `limit` zones matching every word of `query` (city, zone id, common name or offset); city-starts-with first. */
export function searchTimeZones(query: string, limit = 20, at = new Date()): TimeZoneOption[] {
  const q = query.trim();
  if (!q) return COMMON.map((z) => describeTimeZone(z, at)).slice(0, limit);
  const offset = offsetQuery(q);
  const words = squash(q).split(" ");
  const hits: { z: TimeZoneOption; rank: number }[] = [];
  for (const id of allZones()) {
    const z = describeTimeZone(id, at);
    if (offset) {
      if (z.offset.toLowerCase() === offset) hits.push({ z, rank: COMMON.includes(id) ? 0 : 1 });
      continue;
    }
    const hay = squash(`${z.id} ${z.city} ${z.name} ${z.offset}`);
    if (!words.every((w) => hay.includes(w))) continue;
    const phrase = words.join(" ");
    const starts = squash(z.city).startsWith(phrase) || squash(z.name).startsWith(phrase);
    hits.push({ z, rank: starts ? (COMMON.includes(id) ? 0 : 1) : COMMON.includes(id) ? 2 : 3 });
  }
  return hits
    .sort((a, b) => a.rank - b.rank || a.z.city.localeCompare(b.z.city))
    .slice(0, limit)
    .map((h) => h.z);
}
