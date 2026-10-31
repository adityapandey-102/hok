import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { assertCanIssueLink, assertClientManageable, assertLead, assertPortalRange, pickCurrent, portalUrl } from "./portal.rules";
import type { PortalEvent } from "./portal.entity";

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return err.code;
  }
}

describe("link management rules", () => {
  const client = (ownerId: string, status: "active" | "paused" | "archived" = "active", teamIds = [ownerId]) => ({ id: "c", ownerId, teamIds, status });

  it("the owner and the Admin manage a client's link; anyone else gets 404", () => {
    expect(codeOf(() => assertClientManageable({ kind: "own", userId: "rohan" }, client("rohan")))).toBeNull();
    expect(codeOf(() => assertClientManageable({ kind: "all" }, client("sara")))).toBeNull();
    expect(codeOf(() => assertClientManageable({ kind: "own", userId: "rohan" }, client("sara")))).toBe("CLIENT_NOT_FOUND");
    expect(codeOf(() => assertClientManageable({ kind: "all" }, null))).toBe("CLIENT_NOT_FOUND");
  });

  it("no new link for an archived client", () => {
    expect(codeOf(() => assertCanIssueLink(client("rohan", "paused")))).toBeNull();
    expect(codeOf(() => assertCanIssueLink(client("rohan", "archived")))).toBe("CLIENT_ARCHIVED");
  });

  it("builds the shareable URL on the web app", () => {
    expect(portalUrl("http://localhost:3400/", "AbC")).toBe("http://localhost:3400/p/AbC");
  });
});

describe("client teams and the portal link", () => {
  const client = (ownerId: string, teamIds: string[]) => ({ id: "c", ownerId, teamIds, status: "active" as const });

  it("a team member sees the link, but only the lead (or the Admin) changes it", () => {
    const kiran = { kind: "own" as const, userId: "kiran" };
    const c = client("rohan", ["rohan", "kiran"]);
    expect(codeOf(() => assertClientManageable(kiran, c))).toBeNull();
    expect(codeOf(() => assertLead(kiran, c))).toBe("PORTAL_LEAD_ONLY");
    expect(codeOf(() => assertLead({ kind: "own", userId: "rohan" }, c))).toBeNull();
    expect(codeOf(() => assertLead({ kind: "all" }, c))).toBeNull();
  });
});

describe("portal reads", () => {
  it("the calendar range is required and capped", () => {
    expect(codeOf(() => assertPortalRange("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"))).toBeNull();
    expect(codeOf(() => assertPortalRange("2026-10-01T00:00:00Z", "2027-02-01T00:00:00Z"))).toBe("CALENDAR_RANGE_INVALID");
  });

  it("current = the first upcoming event that is still active", () => {
    const e = (id: string, state: PortalEvent["state"]) => ({ id, state }) as PortalEvent;
    expect(pickCurrent([e("a", "cancelled"), e("b", "postponed"), e("c", "active")])?.id).toBe("c");
    expect(pickCurrent([e("a", "cancelled")])).toBeNull();
    expect(pickCurrent([])).toBeNull();
  });
});
