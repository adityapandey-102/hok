import { describe, expect, it } from "vitest";
import { lastSeen } from "./lastSeen";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const ago = (mins: number) => new Date(NOW - mins * 60_000).toISOString();

describe("lastSeen", () => {
  it("says how long ago in minutes, hours, days, then weeks", () => {
    expect(lastSeen(ago(0), NOW).text).toBe("1 min ago");
    expect(lastSeen(ago(25), NOW).text).toBe("25 min ago");
    expect(lastSeen(ago(60), NOW).text).toBe("1 hour ago");
    expect(lastSeen(ago(5 * 60), NOW).text).toBe("5 hours ago");
    expect(lastSeen(ago(30 * 60), NOW).text).toBe("1 day ago");
    expect(lastSeen(ago(6 * 24 * 60), NOW).text).toBe("6 days ago");
    expect(lastSeen(ago(7 * 24 * 60), NOW).text).toBe("1 week ago");
    expect(lastSeen(ago(44 * 24 * 60), NOW).text).toBe("6 weeks ago");
  });

  it("treats never, or older than 45 days, as not seen", () => {
    expect(lastSeen(null, NOW)).toEqual({ text: "Not seen in the last 45 days", stale: true });
    expect(lastSeen(ago(46 * 24 * 60), NOW).stale).toBe(true);
    expect(lastSeen(ago(44 * 24 * 60), NOW).stale).toBe(false);
  });
});
