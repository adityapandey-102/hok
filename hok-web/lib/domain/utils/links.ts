import { isHttpUrl } from "../validation/asset";

/** One piece of free text: plain text, or a link with the safe absolute http(s) address to open. */
export type TextPart = { text: string; href?: string };

// "https://…", "http://…" or a bare "www.…" up to the next space.
const LINK_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
// Punctuation that usually ends the sentence, not the link: "see https://x.com/a."
const TRAILING_RE = /[.,;:!?)\]}'"]+$/;

/**
 * Splits typed text (an event's "Location or link") into text and links.
 * Only http(s) addresses become links, so a typed "javascript:" can never run.
 */
export function splitLinks(value: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of value.matchAll(LINK_RE)) {
    const raw = m[0].replace(TRAILING_RE, "");
    const start = m.index ?? 0;
    const href = /^www\./i.test(raw) ? `https://${raw}` : raw;
    if (!isHttpUrl(href)) continue;
    if (start > last) parts.push({ text: value.slice(last, start) });
    parts.push({ text: raw, href });
    last = start + raw.length;
  }
  if (last < value.length) parts.push({ text: value.slice(last) });
  return parts;
}
