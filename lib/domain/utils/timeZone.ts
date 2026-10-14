/**
 * HOK works across several time zones (docs/REQUIREMENTS.md NFR-08): every
 * user, client and event carries an IANA zone name. Instants are stored in
 * UTC; the zone decides how they're shown.
 */
export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

/** Named zones only ("Area/City" or "UTC"). Recent Intl versions also accept raw offsets like "+05:30", which carry no daylight-saving rules, so they are refused here. */
const ZONE_NAME = /^(UTC|[A-Za-z]+(\/[A-Za-z0-9_+-]+)+)$/;

/** True for a named zone the runtime's Intl database knows (e.g. "Europe/London"); false for typos or offsets like "+05:30". */
export function isValidTimeZone(zone: string): boolean {
  if (!zone || zone.length > 64 || !ZONE_NAME.test(zone)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
