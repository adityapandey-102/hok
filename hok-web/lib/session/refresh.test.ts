import { describe, expect, it } from "vitest";
import { clientIpFrom, isIpAddress, isRefreshTokenRejected } from "./refresh";

const headers = (init: Record<string, string>) => new Headers(init);

describe("isIpAddress", () => {
  it("accepts IPv4 and IPv6", () => {
    for (const ip of ["203.0.113.7", "0.0.0.0", "255.255.255.255", "::1", "::", "2001:db8::1", "2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd", "::ffff:203.0.113.7", "fe80::1"]) {
      expect(isIpAddress(ip), ip).toBe(true);
    }
  });

  it("rejects junk", () => {
    for (const ip of ["", "unknown", "256.1.1.1", "1.2.3", "1.2.3.4.5", "01.2.3.4", "1.2.3.4:80", "a:b", ":::", "1::2::3", "12345::1", "1:2:3:4:5:6:7:8:9", "1:2:3:4:5:6:7", "<script>", "1.1.1.1, 2.2.2.2", "::g"]) {
      expect(isIpAddress(ip), ip).toBe(false);
    }
  });
});

describe("clientIpFrom", () => {
  it("uses the first X-Forwarded-For entry, else x-real-ip", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIpFrom(headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("returns null for an invalid or missing value", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": "evil, 1.2.3.4" }))).toBeNull();
    expect(clientIpFrom(headers({}))).toBeNull();
  });
});

describe("isRefreshTokenRejected", () => {
  it("clears the session only for 401 / 400", () => {
    expect(isRefreshTokenRejected(401)).toBe(true);
    expect(isRefreshTokenRejected(400)).toBe(true);
    for (const status of [429, 500, 502, 503]) expect(isRefreshTokenRejected(status)).toBe(false);
  });
});
