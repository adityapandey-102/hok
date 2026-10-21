import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import type { AuditEvent, AuditLogger } from "../../../common/audit/audit-logger";
import { hashToken } from "../../../common/crypto/credentials";
import type { Role } from "../../../domain";
import { CalendarFeedService } from "./calendar-feed.service";
import type { CalendarFeedRepositoryPort, CalendarRepositoryPort, FeedOwner } from "./ports/calendar-repository.port";

function setup(role: Role = "social_media_manager", active = true) {
  const hashes = new Map<string, string>(); // userId -> hash
  const audits: AuditEvent[] = [];
  const reads: unknown[] = [];
  const links: CalendarFeedRepositoryPort = {
    feedLink: (u) => Promise.resolve(hashes.has(u) ? { createdAt: "2026-10-21T00:00:00.000Z" } : null),
    setFeedLink: (u, h) => {
      if (h) hashes.set(u, h);
      else hashes.delete(u);
      return Promise.resolve(h ? { createdAt: "2026-10-21T00:00:00.000Z" } : null);
    },
    findFeedOwner: (h) => {
      const userId = [...hashes].find(([, v]) => v === h)?.[0];
      return Promise.resolve(userId && active ? ({ userId, role, fullName: "Rohan Mehta" } satisfies FeedOwner) : null);
    },
  };
  const calendar: CalendarRepositoryPort = {
    eventsInRange: (range, f) => (reads.push({ kind: "events", range, f }), Promise.resolve([])),
    personalInRange: (range, f) => (reads.push({ kind: "personal", range, f }), Promise.resolve([])),
  };
  const audit: AuditLogger = { record: (e) => (audits.push(e), Promise.resolve()) };
  const service = new CalendarFeedService(links, calendar, audit, "https://hok.example", () => new Date("2026-10-21T00:00:00Z"));
  return { service, hashes, audits, reads };
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return err.code;
  }
}

describe("CalendarFeedService", () => {
  it("stores only the hash, returns the token once, audits", async () => {
    const { service, hashes, audits } = setup();
    const { token, link } = await service.create("rohan");
    expect(link).not.toBeNull();
    expect(hashes.get("rohan")).toBe(hashToken(token));
    expect(audits.map((a) => a.action)).toEqual(["calendar_feed.created"]);
  });

  it("a new link replaces the old one; the old one is a 404", async () => {
    const { service } = setup();
    const first = await service.create("rohan");
    const second = await service.create("rohan");
    expect(await codeOf(service.ics(`${first.token}.ics`))).toBe("CALENDAR_FEED_INVALID");
    expect(await service.ics(`${second.token}.ics`)).toContain("X-WR-CALNAME:HOK · Rohan Mehta");
  });

  it("reads the owner's own scope over the feed window", async () => {
    const { service, reads } = setup();
    const { token } = await service.create("rohan");
    await service.ics(`${token}.ics`);
    expect(reads).toEqual([
      { kind: "events", range: { from: "2026-09-21T00:00:00.000Z", to: "2027-04-19T00:00:00.000Z" }, f: { ownerId: "rohan" } },
      { kind: "personal", range: { from: "2026-09-21T00:00:00.000Z", to: "2027-04-19T00:00:00.000Z" }, f: { ownerId: "rohan" } },
    ]);
  });

  it("the same 404 for a malformed, unknown, turned-off or no-longer-allowed link", async () => {
    expect(await codeOf(setup().service.ics("nope.ics"))).toBe("CALENDAR_FEED_INVALID");
    expect(await codeOf(setup().service.ics(`${"a".repeat(43)}.ics`))).toBe("CALENDAR_FEED_INVALID");

    const off = setup();
    const { token } = await off.service.create("rohan");
    await off.service.revoke("rohan");
    expect(await codeOf(off.service.ics(`${token}.ics`))).toBe("CALENDAR_FEED_INVALID");

    const editor = setup("editor");
    const t2 = await editor.service.create("meera");
    expect(await codeOf(editor.service.ics(`${t2.token}.ics`))).toBe("CALENDAR_FEED_INVALID");

    const gone = setup("social_media_manager", false);
    const t3 = await gone.service.create("rohan");
    expect(await codeOf(gone.service.ics(`${t3.token}.ics`))).toBe("CALENDAR_FEED_INVALID");
  });

  it("turning off is idempotent and audited once", async () => {
    const { service, audits } = setup();
    await service.revoke("rohan");
    await service.create("rohan");
    await service.revoke("rohan");
    await service.revoke("rohan");
    expect(audits.map((a) => a.action)).toEqual(["calendar_feed.created", "calendar_feed.revoked"]);
  });
});
