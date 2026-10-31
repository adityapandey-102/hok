/**
 * Shared by the proxy (edge-style runtime: no node:* imports here), the
 * server-side fetch wrapper and the session route handlers.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Dependency-free IPv4 / IPv6 syntax check (no node:net, so it runs in the edge runtime). */
export function isIpAddress(value: string): boolean {
  if (IPV4.test(value)) return true;
  if (!/^[0-9a-f:.]+$/i.test(value) || !value.includes(":")) return false;

  // An embedded dotted IPv4 tail (::ffff:1.2.3.4) stands for two 16-bit groups.
  let tail = value;
  let groupsFromTail = 0;
  const lastColon = value.lastIndexOf(":");
  if (value.includes(".")) {
    if (!IPV4.test(value.slice(lastColon + 1))) return false;
    tail = `${value.slice(0, lastColon + 1)}0`;
    groupsFromTail = 1;
  }

  const halves = tail.split("::");
  if (halves.length > 2) return false;
  const groups = halves.flatMap((half) => (half === "" ? [] : half.split(":")));
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return false;
  const count = groups.length + groupsFromTail;
  return halves.length === 2 ? count <= 7 : count === 8;
}

/**
 * The visitor's IP from the hosting proxy's headers, or null unless it is a
 * syntactically valid address -- the value is forwarded to hok-api as
 * X-Forwarded-For and used as a rate-limit key, so junk must not pass through.
 */
export function clientIpFrom(headers: { get(name: string): string | null }): string | null {
  const candidate = (headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip") ?? "").trim();
  return isIpAddress(candidate) ? candidate : null;
}

/** True only when hok-api says the refresh token itself is bad (401, or 400 for a malformed one). 429 / 5xx are transient. */
export function isRefreshTokenRejected(status: number): boolean {
  return status === 401 || status === 400;
}

/**
 * POST /auth/refresh with the visitor's IP forwarded, so hok-api's per-IP auth
 * limiter counts the visitor and not this web server. Throws on network failure.
 */
export function postRefresh(refreshToken: string, headers: { get(name: string): string | null }): Promise<Response> {
  const forwarded: Record<string, string> = { "Content-Type": "application/json" };
  const clientIp = clientIpFrom(headers);
  if (clientIp) forwarded["x-forwarded-for"] = clientIp;
  return fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: forwarded,
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
}
