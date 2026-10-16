import { z } from "zod";
import { ASSET_TAGS_MAX, ASSET_TAG_MAX_LENGTH, ASSET_TYPES } from "../types/asset";
import { zonedWallTimeToIso } from "../utils/zonedTime";

/** An absolute http(s) link: the only kind of URL an asset may hold. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Tags as typed: trimmed, inner spaces collapsed, leading "#" dropped, de-duplicated ignoring case (first spelling wins). */
export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of raw) {
    const name = tag.replace(/^#+/, "").replace(/\s+/g, " ").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

/** Light client-side check of the asset form; hok-api re-validates everything. */
export const assetFormSchema = z.object({
  title: z.string().trim().min(1, "Please enter a title").max(160, "Title is too long"),
  url: z
    .string()
    .trim()
    .min(1, "Paste the link")
    .max(2048, "The link is too long")
    .refine(isHttpUrl, "Enter a full link starting with http:// or https://"),
  type: z.enum(ASSET_TYPES),
  comment: z.string().trim().max(2000, "The comment is too long"),
  tags: z
    .array(z.string())
    .refine((t) => t.length <= ASSET_TAGS_MAX, `At most ${ASSET_TAGS_MAX} tags`)
    .refine((t) => t.every((x) => x.length <= ASSET_TAG_MAX_LENGTH), `Each tag is at most ${ASSET_TAG_MAX_LENGTH} characters`),
});

/** The first instant of a calendar day ("2026-10-14") in a time zone, as an ISO string with offset; null if malformed. */
export function dayStartIso(date: string, zone: string): string | null {
  return zonedWallTimeToIso(`${date}T00:00`, zone);
}

/** The calendar day after "YYYY-MM-DD" (used to turn an inclusive end date into an exclusive `to` instant). */
export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
