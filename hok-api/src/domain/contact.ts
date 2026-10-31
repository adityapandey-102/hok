/**
 * Validation for the free-form contact fields on a staff profile (and, from
 * M3, a client profile). Pure functions, no framework -- the zod DTOs in each
 * module call these, so the rule lives in one place.
 */

/** Longest phone string we accept, formatting included (e.g. "+44 (20) 7946-0958"). */
export const PHONE_MAX_LENGTH = 24;

/** E.164 allows at most 15 digits; fewer than 6 is not a reachable number. */
const PHONE_MIN_DIGITS = 6;
const PHONE_MAX_DIGITS = 15;

/** Digits, spaces, dashes and brackets, with an optional single leading "+". */
const PHONE_CHARS = /^\+?[0-9 ()-]+$/;

/** True for a plausible phone number such as "+91 98765 43210" or "(020) 7946-0958". */
export function isValidPhone(phone: string): boolean {
  if (!phone || phone.length > PHONE_MAX_LENGTH || !PHONE_CHARS.test(phone)) return false;
  const digits = phone.replace(/\D/g, "").length;
  return digits >= PHONE_MIN_DIGITS && digits <= PHONE_MAX_DIGITS;
}

/** Longest link we store (photo URLs, and later asset links). */
export const URL_MAX_LENGTH = 2048;

/** True for an absolute http(s) URL. Refuses javascript:, data: and other schemes that could run in a browser. */
export function isValidHttpUrl(value: string): boolean {
  if (!value || value.length > URL_MAX_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
