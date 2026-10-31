import { isIPv6 } from "node:net";

/**
 * Rate-limit key for a client IP. express-rate-limit 7.5.1 keys on req.ip
 * verbatim, so one IPv6 holder (who owns a whole /64) would get a fresh
 * bucket per address. IPv4 is kept as is (IPv4-mapped IPv6 unwrapped);
 * IPv6 is reduced to its /64 prefix.
 */
export function ipKey(ip: string | undefined): string {
  if (!ip) return "unknown";
  const addr = ip.split("%")[0] ?? ip; // drop an IPv6 zone id
  if (!isIPv6(addr)) return addr;

  // Embedded dotted IPv4 tail (::ffff:1.2.3.4) -> two hex groups, then expand "::".
  const dotted = /^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(addr);
  const hex = dotted ? `${dotted[1]}${((+dotted[2]! << 8) | +dotted[3]!).toString(16)}:${((+dotted[4]! << 8) | +dotted[5]!).toString(16)}` : addr;
  const [head = "", tail] = hex.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const fill = tail === undefined ? [] : Array<string>(8 - headGroups.length - tailGroups.length).fill("0");
  const groups = [...headGroups, ...fill, ...tailGroups].map((g) => parseInt(g, 16));

  // ::ffff:a.b.c.d is an IPv4 client reaching a dual-stack socket.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const [hi = 0, lo = 0] = groups.slice(6);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
}
