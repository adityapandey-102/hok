import { describe, expect, it } from "vitest";
import type { Approval } from "../types/approval";
import {
  approvalStageCount,
  approvalStageCountLabel,
  approvedStageIds,
  approverLabel,
  approversLabel,
  blockedByWithPosition,
  blockedReason,
  deciderLabel,
  isMoveBlocked,
  latestApprovalForStage,
} from "./approvals";

const row = (over: Partial<Approval>): Approval => ({
  id: "a1",
  subject: "task",
  subjectId: "t1",
  subjectTitle: "Reel",
  clientName: null,
  stageId: "s4",
  stageName: "Review",
  stagePosition: 4,
  approvers: ["admin"],
  status: "pending",
  requestNote: null,
  requestLink: null,
  requestedById: "u1",
  requestedByName: "Ed",
  requestedAt: "2026-11-04T10:00:00Z",
  decidedById: null,
  decidedByName: null,
  decidedVia: null,
  decidedAt: null,
  decisionComment: null,
  version: 1,
  canDecide: false,
  canCancel: false,
  ...over,
});

describe("approver labels", () => {
  it("names each token", () => {
    expect(approverLabel("admin")).toBe("Admin");
    expect(approverLabel("team_managers")).toBe("Client's team managers");
    expect(approverLabel("client")).toBe("The client");
    expect(approverLabel("social_media_manager")).toBe("Social Media Manager");
  });
  it("joins with commas and 'or'", () => {
    expect(approversLabel([])).toBe("");
    expect(approversLabel(["admin"])).toBe("Admin");
    expect(approversLabel(["social_media_manager", "admin"])).toBe("Social Media Manager or Admin");
    expect(approversLabel(["admin", "team_managers", "editor"])).toBe("Admin, Client's team managers or Editor");
  });
});

describe("approval stage counts", () => {
  it("counts only stages with approvers", () => {
    expect(approvalStageCount([{ approvers: [] }, { approvers: ["admin"] }, {}, { approvers: ["client", "admin"] }])).toBe(2);
    expect(approvalStageCountLabel(1)).toBe("1 approval stage");
    expect(approvalStageCountLabel(2)).toBe("2 approval stages");
  });
});

describe("isMoveBlocked", () => {
  const blocked = { stageId: "s4", stageName: "Review", position: 4 };
  it("never blocks without a blocking stage", () => {
    expect(isMoveBlocked(null, 2, 5)).toBe(false);
    expect(isMoveBlocked(null, 5, null)).toBe(false);
  });
  it("allows entering the blocking stage but not passing it", () => {
    expect(isMoveBlocked(blocked, 2, 3)).toBe(false);
    expect(isMoveBlocked(blocked, 2, 4)).toBe(false);
    expect(isMoveBlocked(blocked, 2, 5)).toBe(true);
    expect(isMoveBlocked(blocked, 4, 5)).toBe(true);
  });
  it("never blocks a move back", () => {
    expect(isMoveBlocked(blocked, 5, 1)).toBe(false);
    expect(isMoveBlocked(blocked, 4, 2)).toBe(false);
  });
  it("blocks completing", () => {
    expect(isMoveBlocked(blocked, 5, null)).toBe(true);
  });
});

describe("blocked reason and position", () => {
  it("names the stage", () => {
    expect(blockedReason({ stageId: "s4", stageName: "Review" })).toBe("Needs approval at Review");
  });
  it("finds the stage position, or null", () => {
    const stages = [{ id: "s1", position: 1 }, { id: "s4", position: 4 }];
    expect(blockedByWithPosition({ stageId: "s4", stageName: "Review" }, stages)).toEqual({ stageId: "s4", stageName: "Review", position: 4 });
    expect(blockedByWithPosition({ stageId: "zz", stageName: "X" }, stages)).toBeNull();
    expect(blockedByWithPosition(null, stages)).toBeNull();
  });
});

describe("latestApprovalForStage", () => {
  it("skips cancelled and superseded rows, newest first", () => {
    const rows = [row({ id: "n", status: "cancelled" }), row({ id: "m", status: "superseded" }), row({ id: "k", status: "changes_requested" }), row({ id: "o", stageId: "s5" })];
    expect(latestApprovalForStage(rows, "s4")?.id).toBe("k");
    expect(latestApprovalForStage(rows, "s9")).toBeNull();
  });
});

describe("deciderLabel", () => {
  it("says the client for portal decisions", () => {
    expect(deciderLabel({ decidedVia: "portal", decidedByName: null })).toBe("the client");
    expect(deciderLabel({ decidedVia: "staff", decidedByName: "Asha" })).toBe("Asha");
    expect(deciderLabel({ decidedVia: "staff", decidedByName: null })).toBe("Someone");
  });
});

describe("approvedStageIds", () => {
  it("lists stages whose newest counting row is approved", () => {
    const rows = [
      row({ id: "1", stageId: "s5", status: "pending" }),
      row({ id: "2", stageId: "s4", status: "approved" }),
      row({ id: "3", stageId: "s4", status: "changes_requested" }),
      row({ id: "4", stageId: "s2", status: "superseded" }),
      row({ id: "5", stageId: "s2", status: "approved" }),
    ];
    expect(approvedStageIds(rows).sort()).toEqual(["s2", "s4"]);
  });
});
