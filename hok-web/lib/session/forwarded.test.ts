import { afterEach, describe, expect, it, vi } from "vitest";
import { forwardedClientHeaders } from "./forwarded";

const headers = (h: Record<string, string>) => ({ get: (name: string) => h[name] ?? null });

describe("forwardedClientHeaders", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sends the visitor's IP with the shared secret", () => {
    vi.stubEnv("INTERNAL_PROXY_SECRET", "s".repeat(40));
    expect(forwardedClientHeaders(headers({ "x-forwarded-for": "203.0.113.7" }))).toEqual({ "x-hok-client-ip": "203.0.113.7", "x-hok-proxy-secret": "s".repeat(40) });
  });

  it("sends nothing without a secret or a valid IP", () => {
    vi.stubEnv("INTERNAL_PROXY_SECRET", "");
    expect(forwardedClientHeaders(headers({ "x-forwarded-for": "203.0.113.7" }))).toEqual({});
    vi.stubEnv("INTERNAL_PROXY_SECRET", "s".repeat(40));
    expect(forwardedClientHeaders(headers({ "x-forwarded-for": "evil" }))).toEqual({});
  });
});
