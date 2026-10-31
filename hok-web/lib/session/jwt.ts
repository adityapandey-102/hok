/**
 * Local expiry check for an access token, decoded without verifying its
 * signature -- verification is the API's job on every request. This only
 * needs to answer "is it worth sending, or should I refresh first."
 */
export function isExpired(token: string, skewSeconds = 15): boolean {
  const payload = decodePayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

function decodePayload(token: string): { exp?: number } | null {
  const segment = token.split(".")[1];
  if (!segment) return null;

  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    // atob is available in both the browser and the Edge runtime proxy.ts runs
    // in; Buffer is the fallback for Node-context server code (Route Handlers).
    const json =
      typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}
