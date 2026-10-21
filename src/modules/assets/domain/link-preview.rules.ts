import { isIP } from "node:net";

/**
 * Link previews (REQUIREMENTS FR-AST-08): what a pasted link points to --
 * page title, description, image and site -- read from the page's own
 * metadata (Open Graph / Twitter tags, else <title>). Pure helpers here; the
 * guarded network fetch is infrastructure/http-link-previewer.ts.
 */

export interface LinkPreview {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

/** Column limits (migration 20261021000001). */
const MAX = { title: 300, description: 500, imageUrl: 2048, siteName: 120 } as const;

// --------------------------------------------------------------- SSRF guard --

const v4ToInt = (ip: string) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);
const inV4 = (ip: string, base: string, bits: number) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((v4ToInt(ip) & mask) >>> 0) === ((v4ToInt(base) & mask) >>> 0);
};

/** IPv4 ranges a server must never be made to call: private, loopback, link-local (cloud metadata), CGNAT, multicast, reserved. */
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/**
 * True only for a public unicast address. Anything else -- private networks,
 * loopback, link-local (incl. 169.254.169.254 cloud metadata), unique-local
 * IPv6, multicast, reserved, and IPv4-mapped IPv6 forms of those -- is refused.
 */
export function isPublicAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return !BLOCKED_V4.some(([base, bits]) => inV4(ip, base, bits));
  if (kind !== 6) return false;
  const lower = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return isPublicAddress(mapped[1]!);
  if (lower === "::" || lower === "::1") return false;
  const first = parseInt(lower.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return false; // ff00::/8 multicast
  if (lower.startsWith("64:ff9b:") || lower.startsWith("2001:db8:")) return false; // NAT64 / documentation
  return true;
}

/** Only plain web links on the standard ports are ever fetched. */
export function isFetchableUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  if (url.username || url.password) return null;
  return url;
}

// ------------------------------------------------------------------- parsing --

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

const clean = (s: string | undefined, max: number): string | null => {
  if (!s) return null;
  const text = decodeEntities(s).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

/** The <meta> tags' content by property/name (first one wins), from the page's head only. */
function metaTags(html: string): Map<string, string> {
  const head = html.slice(0, html.search(/<\/head>/i) >= 0 ? html.search(/<\/head>/i) : html.length);
  const tags = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (key && value !== undefined && !tags.has(key)) tags.set(key, value);
  }
  return tags;
}

/** Title, description, image (absolute http(s) only) and site name from a page's HTML. */
export function parseLinkPreview(html: string, pageUrl: string): LinkPreview {
  const meta = metaTags(html);
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const rawImage = meta.get("og:image") ?? meta.get("og:image:url") ?? meta.get("twitter:image");
  let imageUrl: string | null = null;
  if (rawImage) {
    try {
      const abs = new URL(decodeEntities(rawImage.trim()), pageUrl);
      if ((abs.protocol === "https:" || abs.protocol === "http:") && abs.href.length <= MAX.imageUrl) imageUrl = abs.href;
    } catch {
      imageUrl = null;
    }
  }
  return {
    title: clean(meta.get("og:title") ?? meta.get("twitter:title") ?? titleTag, MAX.title),
    description: clean(meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"), MAX.description),
    imageUrl,
    siteName: clean(meta.get("og:site_name"), MAX.siteName) ?? clean(new URL(pageUrl).hostname.replace(/^www\./, ""), MAX.siteName),
  };
}
