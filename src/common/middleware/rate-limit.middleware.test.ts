import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { loginEmailKey } from "./rate-limit.middleware";
import { clientIp } from "./client-ip";

const req = (body: unknown, ip: string, headers: Record<string, string> = {}) =>
  ({ body, ip, header: (name: string) => headers[name] }) as unknown as Pick<Request, "body" | "ip" | "header">;

describe("loginEmailKey", () => {
  it("keys on the lower-cased, trimmed email regardless of IP", () => {
    const a = loginEmailKey(req({ email: "  Jane@Example.COM " }, "203.0.113.7"));
    expect(a).toBe(loginEmailKey(req({ email: "jane@example.com" }, "198.51.100.1")));
    expect(a).not.toBe(loginEmailKey(req({ email: "joe@example.com" }, "203.0.113.7")));
  });

  it("falls back to the IP key when the email is missing, not a string, or oversized junk", () => {
    expect(loginEmailKey(req({}, "203.0.113.7"))).toBe("203.0.113.7");
    expect(loginEmailKey(req(undefined, "203.0.113.7"))).toBe("203.0.113.7");
    expect(loginEmailKey(req({ email: 5 }, "203.0.113.7"))).toBe("203.0.113.7");
    expect(loginEmailKey(req({ email: "  " }, "203.0.113.7"))).toBe("203.0.113.7");
    expect(loginEmailKey(req({ email: `${"a".repeat(300)}@x.io` }, "203.0.113.7"))).toBe("203.0.113.7");
  });
});

describe("clientIp", () => {
  const SECRET = "s".repeat(40);
  const fromWeb = (ip: string, secret = SECRET) => req({}, "10.0.0.1", { "x-hok-client-ip": ip, "x-hok-proxy-secret": secret });

  it("believes the forwarded IP only with the right shared secret", () => {
    expect(clientIp(fromWeb("203.0.113.7"), SECRET)).toBe("203.0.113.7");
    expect(clientIp(fromWeb("203.0.113.7", "wrong"), SECRET)).toBe("10.0.0.1");
    expect(clientIp(req({}, "10.0.0.1", { "x-hok-client-ip": "203.0.113.7" }), SECRET)).toBe("10.0.0.1");
  });

  it("ignores the header when the feature is off or the value is not an IP", () => {
    expect(clientIp(fromWeb("203.0.113.7"), "")).toBe("10.0.0.1");
    expect(clientIp(fromWeb("evil"), SECRET)).toBe("10.0.0.1");
  });
});
