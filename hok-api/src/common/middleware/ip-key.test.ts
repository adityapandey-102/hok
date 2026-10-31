import { describe, expect, it } from "vitest";
import { ipKey } from "./ip-key";

describe("ipKey", () => {
  it("keeps IPv4 as is and unwraps IPv4-mapped IPv6", () => {
    expect(ipKey("203.0.113.7")).toBe("203.0.113.7");
    expect(ipKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(ipKey("::ffff:cb00:7107")).toBe("203.0.113.7");
  });

  it("gives addresses in one IPv6 /64 the same key, and different /64s different keys", () => {
    const a = ipKey("2001:db8:1:2::1");
    expect(ipKey("2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd")).toBe(a);
    expect(ipKey("2001:db8:1:2:ffff::9")).toBe(a);
    expect(ipKey("2001:db8:1:3::1")).not.toBe(a);
    expect(ipKey("2001:db8:2:2::1")).not.toBe(a);
  });

  it("handles compressed, loopback and zone-id forms", () => {
    expect(ipKey("::1")).toBe(ipKey("::2"));
    expect(ipKey("fe80::1%eth0")).toBe(ipKey("fe80::2"));
    expect(ipKey(undefined)).toBe("unknown");
  });
});
