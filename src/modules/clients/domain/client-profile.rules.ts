import { BadRequestError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { isValidHttpUrl } from "../../../domain";
import { SOCIAL_PLATFORMS, type SocialAccount, type SocialPlatform } from "./client.entity";

/**
 * Field rules for a client profile (FR-CLI-02). Pure functions: the zod DTOs
 * call the `is*` / `normalize*` helpers so each rule lives in one place, and
 * the service calls `assertContractDates` against the merged (stored + edited)
 * values, which a DTO alone can't see.
 */

/** Longest social handle or profile link we keep. */
export const SOCIAL_HANDLE_MAX_LENGTH = 200;
/** At most this many services, each 1..SERVICE_MAX_LENGTH characters. */
export const SERVICES_MAX_COUNT = 20;
export const SERVICE_MAX_LENGTH = 60;

/** "@acme", "acme.studio", "acme_official", or "company/acme" (LinkedIn) -- no spaces, no scheme. */
const HANDLE = /^@?[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

export function isSocialPlatform(key: string): key is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(key);
}

/** A handle ("@acme") or a full http(s) profile link. Refuses javascript:/data: links and free text. */
export function isValidSocialHandle(value: string): boolean {
  if (!value || value.length > SOCIAL_HANDLE_MAX_LENGTH) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return isValidHttpUrl(value);
  return HANDLE.test(value);
}

/** How many of each a client can list (the database checks the same caps). */
export const CLIENT_LIST_MAX = { websites: 10, phones: 10, contacts: 20, socialAccounts: 20 } as const;

/** Keeps the first of each value by `key`, in the order given. */
function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** The same account twice (same platform, same handle ignoring case) is kept once. Values are validated by the DTO. */
export function normalizeSocialAccounts(accounts: readonly SocialAccount[]): SocialAccount[] {
  return uniqueBy(
    accounts.map((a) => ({ platform: a.platform, handle: a.handle.trim() })),
    (a) => `${a.platform}:${a.handle.toLowerCase()}`,
  );
}

/** Websites as typed ("acme.com" → "https://acme.com"), duplicates dropped. Values are validated by the DTO. */
export function normalizeWebsites(websites: readonly string[]): string[] {
  return uniqueBy(
    websites.map((w) => normalizeWebsite(w) ?? w.trim()),
    (w) => w.toLowerCase(),
  );
}

/** Phone numbers trimmed; the same number typed twice (ignoring spaces and dashes) is kept once. */
export function normalizePhones(phones: readonly string[]): string[] {
  return uniqueBy(
    phones.map((p) => p.trim()),
    (p) => p.replace(/[\s\-().]/g, ""),
  );
}

/** Trims, drops blanks and case-insensitive duplicates (first spelling wins), keeping the order given. */
export function normalizeServices(services: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of services) {
    const label = raw.trim();
    const key = label.toLowerCase();
    if (label && !seen.has(key)) {
      seen.add(key);
      out.push(label);
    }
  }
  return out;
}

/**
 * A website as people type it: "acme.com" becomes "https://acme.com". Returns
 * null when the result still isn't an http(s) URL with a dotted host.
 */
export function normalizeWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isValidHttpUrl(withScheme)) return null;
  return new URL(withScheme).hostname.includes(".") ? withScheme : null;
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day in `YYYY-MM-DD` form (refuses "2026-02-30"). */
export function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The contract can't end before it starts. Either date may be missing. `YYYY-MM-DD` compares correctly as text. */
export function assertContractDates(start: string | null, end: string | null): void {
  if (start && end && end < start) {
    throw new BadRequestError("The contract end date can't be before its start date", ERROR_CODES.CLIENT_CONTRACT_DATES_INVALID);
  }
}
