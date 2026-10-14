import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import {
  assertClientUsable,
  assertClientWritable,
  assertEventTimes,
  assertEventVersion,
  assertEventVisible,
  assertStageMove,
  assertTeamValid,
  assertTemplateUsable,
  resolveRange,
  type EventScope,
} from "./event.rules";

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return err.code;
  }
}

const ALL: EventScope = { kind: "all" };
const ROHAN: EventScope = { kind: "own", userId: "rohan" };

describe("row scope", () => {
  it("events follow their client's owner: others' are 404 EVENT_NOT_FOUND", () => {
    expect(codeOf(() => assertEventVisible(ROHAN, { ownerId: "rohan" }))).toBeNull();
    expect(codeOf(() => assertEventVisible(ALL, { ownerId: "sara" }))).toBeNull();
    expect(codeOf(() => assertEventVisible(ROHAN, { ownerId: "sara" }))).toBe("EVENT_NOT_FOUND");
    expect(codeOf(() => assertEventVisible(ROHAN, null))).toBe("EVENT_NOT_FOUND");
  });

  it("a new event needs a visible, non-archived client", () => {
    const client = (ownerId: string, status: "active" | "paused" | "archived" = "active") => ({ id: "c", ownerId, status, timeZone: "UTC" });
    expect(codeOf(() => assertClientUsable(ROHAN, client("rohan")))).toBeNull();
    expect(codeOf(() => assertClientUsable(ROHAN, client("rohan", "paused")))).toBeNull();
    expect(codeOf(() => assertClientUsable(ROHAN, client("sara")))).toBe("CLIENT_NOT_FOUND");
    expect(codeOf(() => assertClientUsable(ROHAN, null))).toBe("CLIENT_NOT_FOUND");
    expect(codeOf(() => assertClientUsable(ALL, client("sara", "archived")))).toBe("CLIENT_ARCHIVED");
  });

  it("an archived client's events are read-only (409 CLIENT_ARCHIVED)", () => {
    expect(codeOf(() => assertClientWritable("active"))).toBeNull();
    expect(codeOf(() => assertClientWritable("archived"))).toBe("CLIENT_ARCHIVED");
  });
});

describe("assertTemplateUsable", () => {
  const t = (active: boolean, stageNames = ["Planned", "Done"]) => ({ id: "t", name: "Photo Shoot", active, stageNames });
  it("needs an existing, active template with stages (else 400 EVENT_TEMPLATE_INVALID)", () => {
    expect(codeOf(() => assertTemplateUsable(t(true)))).toBeNull();
    expect(codeOf(() => assertTemplateUsable(t(false)))).toBe("EVENT_TEMPLATE_INVALID");
    expect(codeOf(() => assertTemplateUsable(t(true, [])))).toBe("EVENT_TEMPLATE_INVALID");
    expect(codeOf(() => assertTemplateUsable(null))).toBe("EVENT_TEMPLATE_INVALID");
  });
});

describe("assertEventTimes", () => {
  it("allows an instant event and up to 31 days, across offsets", () => {
    expect(codeOf(() => assertEventTimes("2026-10-14T10:00:00Z", "2026-10-14T10:00:00Z"))).toBeNull();
    expect(codeOf(() => assertEventTimes("2026-10-14T10:00:00+05:30", "2026-10-14T06:00:00Z"))).toBeNull();
    expect(codeOf(() => assertEventTimes("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"))).toBeNull();
  });

  it("refuses an end before the start (the same wall time in an earlier zone included) and > 31 days", () => {
    expect(codeOf(() => assertEventTimes("2026-10-14T10:00:00Z", "2026-10-14T09:59:59Z"))).toBe("EVENT_TIMES_INVALID");
    expect(codeOf(() => assertEventTimes("2026-10-14T10:00:00Z", "2026-10-14T10:00:00+05:30"))).toBe("EVENT_TIMES_INVALID");
    expect(codeOf(() => assertEventTimes("2026-10-01T00:00:00Z", "2026-11-01T00:00:01Z"))).toBe("EVENT_TIMES_INVALID");
  });
});

describe("assertTeamValid", () => {
  it("passes when every id is a confirmed active account", () => {
    expect(codeOf(() => assertTeamValid(["a", "b"], new Set(["a", "b"])))).toBeNull();
    expect(codeOf(() => assertTeamValid([], new Set()))).toBeNull();
    expect(codeOf(() => assertTeamValid(["a", "x"], new Set(["a"])))).toBe("EVENT_TEAM_INVALID");
  });
});

describe("assertStageMove", () => {
  const stages = [
    { id: "s1", position: 1, name: "Planned" },
    { id: "s2", position: 2, name: "Shoot" },
    { id: "s3", position: 3, name: "Editing" },
  ];
  const move = (targetStageId: string, state: "active" | "cancelled" | "postponed" = "active") =>
    codeOf(() => assertStageMove({ state, currentStageId: "s2", stages, targetStageId }));

  it("moves forward or back to any stage of the event", () => {
    expect(move("s3")).toBeNull();
    expect(move("s1")).toBeNull();
    expect(assertStageMove({ state: "active", currentStageId: "s2", stages, targetStageId: "s3" }).name).toBe("Editing");
  });

  it("refuses the current stage, another event's stage, and a cancelled or postponed event", () => {
    expect(move("s2")).toBe("EVENT_STAGE_UNCHANGED");
    expect(move("other")).toBe("EVENT_STAGE_INVALID");
    expect(move("s3", "cancelled")).toBe("EVENT_NOT_ACTIVE");
    expect(move("s3", "postponed")).toBe("EVENT_NOT_ACTIVE");
  });
});

describe("assertEventVersion", () => {
  it("409 EVENT_MODIFIED when stale", () => {
    expect(codeOf(() => assertEventVersion(3, 3))).toBeNull();
    expect(codeOf(() => assertEventVersion(3, undefined))).toBeNull();
    expect(codeOf(() => assertEventVersion(3, 2))).toBe("EVENT_MODIFIED");
  });
});

describe("resolveRange", () => {
  it("is optional, but needs both ends", () => {
    expect(resolveRange(undefined, undefined)).toBeUndefined();
    expect(codeOf(() => resolveRange("2026-10-01T00:00:00Z", undefined))).toBe("EVENT_RANGE_INVALID");
    expect(codeOf(() => resolveRange(undefined, "2026-10-01T00:00:00Z"))).toBe("EVENT_RANGE_INVALID");
  });

  it("needs to after from, and at most 92 days", () => {
    expect(resolveRange("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z")).toEqual({ from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" });
    expect(codeOf(() => resolveRange("2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z"))).toBe("EVENT_RANGE_INVALID");
    expect(codeOf(() => resolveRange("2026-10-01T00:00:00Z", "2027-01-02T00:00:00Z"))).toBe("EVENT_RANGE_INVALID");
  });
});
