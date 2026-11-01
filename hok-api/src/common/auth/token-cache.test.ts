import { beforeEach, describe, expect, it } from "vitest";
import { tokenCache } from "./token-cache";

const jwt = (expSeconds: number) => `h.${Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url")}.s`;
const NOW = 1_800_000_000_000;

describe("tokenCache", () => {
  beforeEach(() => tokenCache.clear());

  it("returns the user for a token it has just seen, then forgets it after 30 s", () => {
    const token = jwt(NOW / 1000 + 3600);
    expect(tokenCache.get(token, NOW)).toBeNull();
    tokenCache.set(token, "u1", NOW);
    expect(tokenCache.get(token, NOW + 29_000)).toBe("u1");
    expect(tokenCache.get(token, NOW + 30_001)).toBeNull();
  });

  it("never trusts a token past its own expiry", () => {
    const token = jwt(NOW / 1000 + 5);
    tokenCache.set(token, "u1", NOW);
    expect(tokenCache.get(token, NOW + 4_000)).toBe("u1");
    expect(tokenCache.get(token, NOW + 5_001)).toBeNull();
  });

  it("does not store an already-expired or unreadable token", () => {
    tokenCache.set(jwt(NOW / 1000 - 1), "u1", NOW);
    tokenCache.set("not-a-jwt", "u2", NOW);
    expect(tokenCache.get(jwt(NOW / 1000 - 1), NOW)).toBeNull();
    expect(tokenCache.get("not-a-jwt", NOW)).toBeNull();
  });

  it("dropUser removes every token of that user and no one else's", () => {
    const a = jwt(NOW / 1000 + 3600), b = jwt(NOW / 1000 + 3601), c = jwt(NOW / 1000 + 3602);
    tokenCache.set(a, "u1", NOW);
    tokenCache.set(b, "u1", NOW);
    tokenCache.set(c, "u2", NOW);
    tokenCache.dropUser("u1");
    expect(tokenCache.get(a, NOW)).toBeNull();
    expect(tokenCache.get(b, NOW)).toBeNull();
    expect(tokenCache.get(c, NOW)).toBe("u2");
  });

  it("dropToken removes just that token", () => {
    const a = jwt(NOW / 1000 + 3600), b = jwt(NOW / 1000 + 3601);
    tokenCache.set(a, "u1", NOW);
    tokenCache.set(b, "u1", NOW);
    tokenCache.dropToken(a);
    expect(tokenCache.get(a, NOW)).toBeNull();
    expect(tokenCache.get(b, NOW)).toBe("u1");
  });

  it("stays bounded: the oldest entry makes room after 500", () => {
    const first = jwt(NOW / 1000 + 100_000);
    tokenCache.set(first, "u0", NOW);
    for (let i = 1; i <= 500; i++) tokenCache.set(jwt(NOW / 1000 + 100_000 + i), `u${i}`, NOW);
    expect(tokenCache.get(first, NOW)).toBeNull();
    expect(tokenCache.get(jwt(NOW / 1000 + 100_500), NOW)).toBe("u500");
  });
});
