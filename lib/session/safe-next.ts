const BASE = "http://hok.invalid";

/**
 * Where to go after sign-in / a link callback: only a path on THIS site.
 * `?next=` comes from the URL, so it's attacker-controlled: "https://evil",
 * "//evil", "/\evil" and "/<tab>/evil" all leave the site in a browser. They
 * are resolved exactly as a browser would (WHATWG URL) and anything that
 * lands on another origin falls back to `fallback`.
 */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const url = new URL(next, BASE);
    return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
