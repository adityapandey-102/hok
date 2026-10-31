import { clientIpFrom } from "./refresh";

/**
 * Headers that tell hok-api who the visitor is when this web server calls it on their behalf
 * (login, refresh, logout, Server Components). hok-api believes the IP only when the shared
 * INTERNAL_PROXY_SECRET matches (its common/middleware/client-ip.ts) -- without it every such call
 * would land in the web host's single rate-limit bucket. Server-only: the secret is never a
 * NEXT_PUBLIC_ variable, so it never reaches a browser bundle. Empty when either value is missing.
 */
export function forwardedClientHeaders(headers: { get(name: string): string | null }): Record<string, string> {
  const secret = process.env.INTERNAL_PROXY_SECRET;
  const ip = clientIpFrom(headers);
  return secret && ip ? { "x-hok-client-ip": ip, "x-hok-proxy-secret": secret } : {};
}
