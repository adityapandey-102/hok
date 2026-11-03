import { describe, expect, it } from "vitest";
import { AppError } from "../common/errors/app-error";
import {
  APPROVER_ROLE_TOKENS,
  APPROVER_TOKENS,
  approvedStageIds,
  assertApproversValid,
  assertCanDecide,
  assertCanPass,
  assertDecisionComment,
  blockingStage,
  canCancelApproval,
  canManageApprovalItem,
  canMoveApprovalItem,
  canSeeApprovalItem,
  canDecide,
  completionPosition,
  matchesApprover,
  maxReachablePosition,
  nextBlockedBy,
  toApproval,
  withApproved,
  type ApprovalRecord,
} from "./stage-approvals";

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return err.code;
  }
}

/** The user's example: five stages, stage 4 by SMM or Admin, stage 5 by Admin only. */
const stage = (position: number, approvers: string[] = [], approved = false) => ({ id: `s${position}`, name: `Stage ${position}`, position, approvers, approved });
const EXAMPLE = [stage(1), stage(2), stage(3), stage(4, ["social_media_manager", "admin"]), stage(5, ["admin"])];

describe("approver tokens", () => {
  it("are the three specials plus every role except admin", () => {
    expect(APPROVER_TOKENS).toContain("admin");
    expect(APPROVER_TOKENS).toContain("team_managers");
    expect(APPROVER_TOKENS).toContain("client");
    expect(APPROVER_ROLE_TOKENS).toContain("content_writer");
    expect(APPROVER_ROLE_TOKENS).not.toContain("admin");
  });

  it("are valid on a template: known, no repeat; none at all is fine", () => {
    expect(assertApproversValid("task", [])).toEqual([]);
    expect(assertApproversValid("task", ["admin", "team_managers", "editor"])).toEqual(["admin", "team_managers", "editor"]);
    expect(codeOf(() => assertApproversValid("event", ["admin", "admin"]))).toBe("STAGE_TEMPLATE_APPROVERS_INVALID");
    expect(codeOf(() => assertApproversValid("event", ["boss"]))).toBe("STAGE_TEMPLATE_APPROVERS_INVALID");
    expect(codeOf(() => assertApproversValid("event", ["ADMIN"]))).toBe("STAGE_TEMPLATE_APPROVERS_INVALID");
  });

  it("allow 'client' only on an event template", () => {
    expect(assertApproversValid("event", ["client", "admin"])).toEqual(["client", "admin"]);
    expect(codeOf(() => assertApproversValid("task", ["client"]))).toBe("STAGE_TEMPLATE_APPROVERS_INVALID");
  });

  it("allow at most 8 per stage", () => {
    expect(codeOf(() => assertApproversValid("event", APPROVER_TOKENS.slice(0, 9)))).toBe("STAGE_TEMPLATE_APPROVERS_INVALID");
    expect(codeOf(() => assertApproversValid("event", APPROVER_TOKENS.slice(0, 8)))).toBeNull();
  });
});

describe("the move gate (the user's example)", () => {
  it("stops AT the first unapproved approval stage: it can be entered, not passed", () => {
    expect(maxReachablePosition(EXAMPLE, 1)).toBe(4);
    expect(maxReachablePosition(EXAMPLE, 3)).toBe(4);
    expect(maxReachablePosition(EXAMPLE, 4)).toBe(4);
  });

  it("moves on once the stage is approved, to the next approval stage, then past the last one", () => {
    const approved4 = withApproved(EXAMPLE, new Set(["s4"]));
    expect(maxReachablePosition(approved4, 4)).toBe(5);
    const approved45 = withApproved(EXAMPLE, new Set(["s4", "s5"]));
    expect(maxReachablePosition(approved45, 5)).toBe(completionPosition(EXAMPLE));
    expect(completionPosition(EXAMPLE)).toBe(6);
  });

  it("is unlimited without approval stages", () => {
    expect(maxReachablePosition([stage(1), stage(2), stage(3)], 1)).toBe(4);
  });

  it("refuses 2 to 5 (jumping over stage 4) and allows 2 to 4", () => {
    expect(codeOf(() => assertCanPass(EXAMPLE, 2, 5))).toBe("STAGE_APPROVAL_REQUIRED");
    expect(codeOf(() => assertCanPass(EXAMPLE, 2, 4))).toBeNull();
    expect(codeOf(() => assertCanPass(EXAMPLE, 1, 3))).toBeNull();
  });

  it("refuses 4 to 5 until stage 4 is approved, then allows it", () => {
    expect(codeOf(() => assertCanPass(EXAMPLE, 4, 5))).toBe("STAGE_APPROVAL_REQUIRED");
    expect(codeOf(() => assertCanPass(withApproved(EXAMPLE, new Set(["s4"])), 4, 5))).toBeNull();
  });

  it("refuses completing from 5 until the Admin approved stage 5", () => {
    const approved4 = withApproved(EXAMPLE, new Set(["s4"]));
    expect(codeOf(() => assertCanPass(approved4, 5, completionPosition(approved4)))).toBe("STAGE_APPROVAL_REQUIRED");
    const both = withApproved(EXAMPLE, new Set(["s4", "s5"]));
    expect(codeOf(() => assertCanPass(both, 5, completionPosition(both)))).toBeNull();
  });

  it("names the stage that is in the way", () => {
    try {
      assertCanPass(EXAMPLE, 2, 5);
      expect.unreachable();
    } catch (err) {
      expect((err as AppError).message).toContain("Stage 4");
      expect((err as AppError).statusCode).toBe(409);
    }
  });

  it("never blocks a move back, even from an unapproved approval stage", () => {
    expect(codeOf(() => assertCanPass(EXAMPLE, 5, 1))).toBeNull();
    expect(codeOf(() => assertCanPass(EXAMPLE, 4, 2))).toBeNull();
  });

  it("only looks forward from the current stage (an earlier approval stage doesn't block)", () => {
    const sixStages = [stage(1, ["admin"]), stage(2), stage(3)];
    expect(blockingStage(withApproved(sixStages, new Set()), 2)).toBeNull();
    expect(codeOf(() => assertCanPass(sixStages.map((s) => ({ ...s })), 2, 4))).toBeNull();
  });

  it("an approved stage 5 does not open the way over an unapproved stage 4", () => {
    const only5 = withApproved(EXAMPLE, new Set(["s5"]));
    expect(codeOf(() => assertCanPass(only5, 2, 5))).toBe("STAGE_APPROVAL_REQUIRED");
  });

  it("reports nextBlockedBy for the web: the approval stage that stops forward moves", () => {
    expect(nextBlockedBy(EXAMPLE, new Set(), 2)).toEqual({ stageId: "s4", stageName: "Stage 4", stagePosition: 4 });
    expect(nextBlockedBy(EXAMPLE, new Set(["s4"]), 4)).toEqual({ stageId: "s5", stageName: "Stage 5", stagePosition: 5 });
    expect(nextBlockedBy(EXAMPLE, new Set(["s4", "s5"]), 5)).toBeNull();
    expect(nextBlockedBy([stage(1), stage(2)], new Set(), 1)).toBeNull();
  });
});

describe("who can decide", () => {
  const ctx = (over: Partial<{ teamIds: string[]; canSeeItem: boolean; requestedBy: string | null }> = {}) => ({
    teamIds: ["smm1"],
    canSeeItem: true,
    requestedBy: "editor1",
    ...over,
  });
  const smm = { userId: "smm1", role: "social_media_manager" as const };
  const admin = { userId: "admin1", role: "admin" as const };
  const editor = { userId: "editor1", role: "editor" as const };

  it("matches the admin token and role tokens by the caller's role", () => {
    expect(matchesApprover(admin, ["admin"], ctx())).toBe(true);
    expect(matchesApprover(smm, ["social_media_manager", "admin"], ctx())).toBe(true);
    expect(matchesApprover(smm, ["admin"], ctx())).toBe(false);
    expect(matchesApprover(editor, ["social_media_manager"], ctx())).toBe(false);
  });

  it("'admin' is never matched by a role token and a role token never gives admin rights", () => {
    expect(matchesApprover({ userId: "x", role: "admin" }, ["editor"], ctx())).toBe(false);
  });

  it("team_managers = a client-manager role on the client's team", () => {
    expect(matchesApprover(smm, ["team_managers"], ctx())).toBe(true);
    expect(matchesApprover({ userId: "smm2", role: "social_media_manager" }, ["team_managers"], ctx())).toBe(false);
    // An editor listed on the team is not a team manager.
    expect(matchesApprover({ userId: "editor1", role: "editor" }, ["team_managers"], ctx({ teamIds: ["editor1"] }))).toBe(false);
  });

  it("team_managers on a task without a client (no team): nobody", () => {
    expect(matchesApprover(smm, ["team_managers"], ctx({ teamIds: [] }))).toBe(false);
    expect(matchesApprover(admin, ["team_managers"], ctx({ teamIds: [] }))).toBe(false);
  });

  it("an Admin on the team counts as a team manager too", () => {
    expect(matchesApprover(admin, ["team_managers"], ctx({ teamIds: ["admin1"] }))).toBe(true);
  });

  it("'client' never matches a staff member", () => {
    expect(matchesApprover(admin, ["client"], ctx())).toBe(false);
    expect(canDecide(admin, ["client"], ctx())).toBe(false);
  });

  it("needs to see the item", () => {
    expect(canDecide(smm, ["social_media_manager"], ctx())).toBe(true);
    expect(canDecide(smm, ["social_media_manager"], ctx({ canSeeItem: false }))).toBe(false);
  });

  it("refuses self-approval except for the Admin", () => {
    const own = ctx({ requestedBy: "smm1" });
    expect(canDecide(smm, ["social_media_manager"], own)).toBe(false);
    expect(codeOf(() => assertCanDecide(smm, ["social_media_manager"], own))).toBe("STAGE_APPROVAL_SELF");
    const ownAdmin = ctx({ requestedBy: "admin1" });
    expect(canDecide(admin, ["admin"], ownAdmin)).toBe(true);
    expect(codeOf(() => assertCanDecide(admin, ["admin"], ownAdmin))).toBeNull();
  });

  it("answers NOT_APPROVER (not SELF) for someone who isn't an approver at all", () => {
    expect(codeOf(() => assertCanDecide(editor, ["admin"], ctx()))).toBe("STAGE_APPROVAL_NOT_APPROVER");
    expect(codeOf(() => assertCanDecide(editor, ["editor"], ctx()))).toBe("STAGE_APPROVAL_SELF");
  });

  it("a request whose requester is gone (null) is nobody's own", () => {
    expect(canDecide(smm, ["social_media_manager"], ctx({ requestedBy: null }))).toBe(true);
  });

  it("requests changes only with a comment", () => {
    expect(codeOf(() => assertDecisionComment("changes", undefined))).toBe("STAGE_APPROVAL_COMMENT_REQUIRED");
    expect(codeOf(() => assertDecisionComment("changes", "   "))).toBe("STAGE_APPROVAL_COMMENT_REQUIRED");
    expect(assertDecisionComment("changes", " fix the intro ")).toBe("fix the intro");
    expect(assertDecisionComment("approve", undefined)).toBeNull();
    expect(assertDecisionComment("approve", "  looks good ")).toBe("looks good");
  });

  it("lets the requester or whoever manages the item cancel", () => {
    expect(canCancelApproval(editor, "editor1", false)).toBe(true);
    expect(canCancelApproval(smm, "editor1", false)).toBe(false);
    expect(canCancelApproval(smm, "editor1", true)).toBe(true);
    expect(canCancelApproval(smm, null, false)).toBe(false);
  });
});

describe("toApproval", () => {
  const record = (over: Partial<ApprovalRecord> = {}): ApprovalRecord => ({
    id: "a1",
    subject: "task",
    subjectId: "t1",
    subjectTitle: "Reel",
    clientName: null,
    stageId: "s4",
    stageName: "Stage 4",
    stagePosition: 4,
    approvers: ["social_media_manager", "admin"],
    status: "pending",
    requestNote: null,
    requestLink: null,
    requestedById: "editor1",
    requestedByName: "Ed",
    requestedAt: "2026-11-04T10:00:00.000Z",
    decidedById: null,
    decidedByName: null,
    decidedVia: null,
    decidedAt: null,
    decisionComment: null,
    version: 1,
    ...over,
  });
  const ctx = { teamIds: [], canSeeItem: true, canManageItem: false };

  it("sets the caller's flags on a pending request", () => {
    expect(toApproval(record(), { userId: "smm1", role: "social_media_manager" }, ctx)).toMatchObject({ canDecide: true, canCancel: false });
    expect(toApproval(record(), { userId: "editor1", role: "editor" }, ctx)).toMatchObject({ canDecide: false, canCancel: true });
    expect(toApproval(record(), { userId: "admin1", role: "admin" }, { ...ctx, canManageItem: true })).toMatchObject({ canDecide: true, canCancel: true });
  });

  it("gives no flags once it isn't pending", () => {
    for (const status of ["approved", "changes_requested", "cancelled", "superseded"] as const) {
      expect(toApproval(record({ status }), { userId: "admin1", role: "admin" }, { ...ctx, canManageItem: true })).toMatchObject({ canDecide: false, canCancel: false });
    }
  });

  it("collects the approved stage ids", () => {
    expect(approvedStageIds([record({ status: "approved" }), record({ stageId: "s5", status: "superseded" }), record({ stageId: "s6", status: "pending" })])).toEqual(new Set(["s4"]));
  });
});

describe("seeing, moving and managing the item", () => {
  const smm = { userId: "smm1", role: "social_media_manager" as const };
  const editor = { userId: "editor1", role: "editor" as const };
  const admin = { userId: "admin1", role: "admin" as const };
  const event = (teamIds: string[]) => ({ subject: "event" as const, teamIds });
  const task = (o: { teamIds?: string[]; assigneeId?: string | null; assignedBy?: string | null }) => ({ subject: "task" as const, teamIds: o.teamIds ?? [], assigneeId: o.assigneeId ?? null, assignedBy: o.assignedBy ?? null });

  it("events: the Admin and managers on the client's team; nobody else (task-only roles never)", () => {
    expect(canSeeApprovalItem(admin, event([]))).toBe(true);
    expect(canSeeApprovalItem(smm, event(["smm1"]))).toBe(true);
    expect(canSeeApprovalItem(smm, event(["other"]))).toBe(false);
    expect(canSeeApprovalItem(editor, event(["editor1"]))).toBe(false);
    expect(canMoveApprovalItem(smm, event(["smm1"]))).toBe(true);
    expect(canMoveApprovalItem(smm, event([]))).toBe(false);
    expect(canManageApprovalItem(smm, event(["smm1"]))).toBe(true);
  });

  it("tasks: assignee, creator, Admin, and managers on the client's team see; only assignee, creator and Admin move", () => {
    const t = task({ teamIds: ["smm1"], assigneeId: "editor1", assignedBy: "smm2" });
    expect(canSeeApprovalItem(editor, t)).toBe(true);
    expect(canSeeApprovalItem({ userId: "smm2", role: "social_media_manager" }, t)).toBe(true);
    expect(canSeeApprovalItem(smm, t)).toBe(true);
    expect(canSeeApprovalItem({ userId: "dev1", role: "developer" }, t)).toBe(false);
    expect(canMoveApprovalItem(editor, t)).toBe(true);
    expect(canMoveApprovalItem(smm, t)).toBe(false); // sees it via the team, but may not move it
    expect(canMoveApprovalItem(admin, t)).toBe(true);
  });

  it("tasks: a task-only role on a client team gets no team visibility; managing = Admin or the creator who can still assign", () => {
    const t = task({ teamIds: ["editor9"], assigneeId: "x", assignedBy: "smm2" });
    expect(canSeeApprovalItem({ userId: "editor9", role: "editor" }, t)).toBe(false);
    expect(canManageApprovalItem({ userId: "smm2", role: "social_media_manager" }, t)).toBe(true);
    expect(canManageApprovalItem(smm, t)).toBe(false);
    expect(canManageApprovalItem(editor, task({ assignedBy: "editor1" }))).toBe(false);
    expect(canManageApprovalItem(admin, t)).toBe(true);
  });
});
