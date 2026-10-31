import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";

const TTL_MS = 90 * 24 * 60 * 60 * 1000;

const sign = (email: string, exp: number, secret: string) =>
  // Domain-separated from the proxy-secret's other use (the forwarded-IP header).
  createHmac("sha256", `hok-trusted-device-v1:${secret}`).update(`${email.trim().toLowerCase()}|${exp}`).digest("base64url");

/**
 * Trusted-device token (OWASP "device cookies"): issued after a successful login and kept by
 * hok-web in an httpOnly cookie. A browser holding a valid token for an email skips the per-email
 * login limiter, so a stranger spraying wrong passwords from many IPs cannot lock the owner out.
 * The per-IP limiters still apply to it. Undefined when INTERNAL_PROXY_SECRET is unset (feature off).
 */
export function issueDeviceToken(email: string, now = Date.now(), secret = env.INTERNAL_PROXY_SECRET): string | undefined {
  if (!secret) return undefined;
  const exp = now + TTL_MS;
  return `${exp}.${sign(email, exp, secret)}`;
}

export function isTrustedDevice(token: unknown, email: unknown, now = Date.now(), secret = env.INTERNAL_PROXY_SECRET): boolean {
  if (!secret || typeof token !== "string" || typeof email !== "string" || token.length > 200) return false;
  const [expText, mac, extra] = token.split(".");
  const exp = Number(expText);
  if (extra !== undefined || !mac || !Number.isSafeInteger(exp) || exp <= now) return false;
  const expected = Buffer.from(sign(email, exp, secret));
  const given = Buffer.from(mac);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
