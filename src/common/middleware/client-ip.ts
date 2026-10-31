import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request } from "express";
import { env } from "../../config/env";

/** Set by hok-web's server on calls it makes for a browser (lib/session/forwarded.ts). */
export const CLIENT_IP_HEADER = "x-hok-client-ip";
export const PROXY_SECRET_HEADER = "x-hok-proxy-secret";

function sameSecret(given: string, expected: string): boolean {
  // Hash first so the comparison is constant-time whatever the lengths.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * The visitor's IP for rate limiting. Requests from hok-web's server (login, refresh, Server
 * Components) carry the visitor's IP plus the shared INTERNAL_PROXY_SECRET; only then is the
 * forwarded IP believed. Everything else (browsers calling the API directly, or anyone without
 * the secret) gets req.ip, i.e. the connecting address after TRUST_PROXY hops -- so a client can
 * neither spoof its IP nor make all web-server traffic share one bucket.
 */
export function clientIp(req: Pick<Request, "ip" | "header">, secret = env.INTERNAL_PROXY_SECRET): string | undefined {
  const forwarded = req.header(CLIENT_IP_HEADER)?.trim();
  if (secret && forwarded && isIP(forwarded) && sameSecret(req.header(PROXY_SECRET_HEADER) ?? "", secret)) return forwarded;
  return req.ip;
}
