import { describe, expect, it } from "vitest";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { isUnexpiredJwt } from "./auth.middleware";
import { isUpstreamFailure } from "../auth/supabase-auth-provider";

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
const jwt = (payload: unknown) => `${b64({ alg: "HS256" })}.${b64(payload)}.c2ln`;

describe("isUnexpiredJwt (local pre-check before Supabase Auth)", () => {
  const now = 1_800_000_000;
  it("passes a well-formed token that has not expired", () => {
    expect(isUnexpiredJwt(jwt({ exp: now + 60 }), now)).toBe(true);
  });
  it("rejects expired, exp-less, malformed and oversized tokens without a network call", () => {
    expect(isUnexpiredJwt(jwt({ exp: now - 1 }), now)).toBe(false);
    expect(isUnexpiredJwt(jwt({ sub: "x" }), now)).toBe(false);
    expect(isUnexpiredJwt("junk", now)).toBe(false);
    expect(isUnexpiredJwt("a.b!.c", now)).toBe(false);
    expect(isUnexpiredJwt(`${b64({})}.bm90LWpzb24.c2ln`, now)).toBe(false);
    expect(isUnexpiredJwt(jwt({ exp: now + 60, pad: "x".repeat(5000) }), now)).toBe(false);
  });
});

describe("isUpstreamFailure (503, never 401, so hok-web keeps the session)", () => {
  it("is true for network errors, 5xx and Supabase's own rate limit", () => {
    expect(isUpstreamFailure(new AuthRetryableFetchError("fetch failed", 0))).toBe(true);
    expect(isUpstreamFailure(new AuthApiError("boom", 502, "unexpected_failure"))).toBe(true);
    expect(isUpstreamFailure(new AuthApiError("slow down", 429, "over_request_rate_limit"))).toBe(true);
  });
  it("is false when Supabase rejects the credentials or token", () => {
    expect(isUpstreamFailure(new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found"))).toBe(false);
    expect(isUpstreamFailure(new AuthApiError("bad jwt", 401, "bad_jwt"))).toBe(false);
    expect(isUpstreamFailure(null)).toBe(false);
  });
});
