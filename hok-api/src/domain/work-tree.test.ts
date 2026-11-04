import { describe, expect, it } from "vitest";
import { AppError } from "../common/errors/app-error";
import {
  assertCanAddChild,
  assertDepth,
  childEventClientId,
  isFinishedEvent,
  isFinishedTask,
  isOpenEvent,
  isOpenTask,
  visibleChildren,
  visibleParent,
  type ParentFacts,
  type WorkChildRow,
  type WorkParentRecord,
} from "./work-tree";
import { assertCanPass, blockingStage, completionPosition, maxReachablePosition, nextBlockedBy, withApproved } from "./stage-approvals";

function errorOf(fn: () => unknown): { code: string; status: number; message: string } | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return { code: err.code, status: err.statusCode, message: err.message };
  }
}
const codeOf = (fn: () => unknown) => errorOf(fn)?.code ?? null;

const stage = (position: number, over: Partial<{ approvers: string[]; approved: boolean; openChildren: number }> = {}) => ({
  id: `s${position}`,
  name: `Stage ${position}`,
  position,
  approvers: [] as string[],
  approved: false,
  openChildren: 0,
  ...over,
});

describe("the move gate with children (round 4)", () => {
  // The user's example: "10 reels" with a stage 2 "Production" that holds 10 unfinished child events.
  const REELS = [stage(1), stage(2, { openChildren: 10 }), stage(3), stage(4)];

  it("lets the parent ENTER the stage but not pass it, forward or by jumping", () => {
    expect(codeOf(() => assertCanPass(REELS, 1, 2))).toBeNull();
    expect(codeOf(() => assertCanPass(REELS, 2, 3))).toBe("STAGE_CHILDREN_OPEN");
    expect(codeOf(() => assertCanPass(REELS, 1, 3))).toBe("STAGE_CHILDREN_OPEN");
    expect(codeOf(() => assertCanPass(REELS, 1, 4))).toBe("STAGE_CHILDREN_OPEN");
    expect(maxReachablePosition(REELS, 1)).toBe(2);
    expect(maxReachablePosition(REELS, 2)).toBe(2);
  });

  it("is a 409 that names the stage and the count", () => {
    const err = errorOf(() => assertCanPass(REELS, 2, 3));
    expect(err?.status).toBe(409);
    expect(err?.message).toBe('"Stage 2" has 10 unfinished parts');
    expect(errorOf(() => assertCanPass([stage(1, { openChildren: 1 }), stage(2)], 1, 2))?.message).toBe('"Stage 1" has 1 unfinished part');
  });

  it("stays shut until the LAST unfinished child is finished", () => {
    expect(codeOf(() => assertCanPass([stage(1), stage(2, { openChildren: 1 }), stage(3)], 2, 3))).toBe("STAGE_CHILDREN_OPEN");
    expect(codeOf(() => assertCanPass([stage(1), stage(2, { openChildren: 0 }), stage(3)], 2, 3))).toBeNull();
  });

  it("never blocks a move back, and ignores children on a stage already passed", () => {
    expect(codeOf(() => assertCanPass(REELS, 3, 1))).toBeNull();
    expect(codeOf(() => assertCanPass(REELS, 4, 2))).toBeNull();
    // At stage 3 the parent is past stage 2, so the children there no longer stop it.
    expect(codeOf(() => assertCanPass(REELS, 3, 4))).toBeNull();
    expect(blockingStage(REELS, 3)).toBeNull();
  });

  it("blocks completing from the last stage when the last stage has open children", () => {
    const stages = [stage(1), stage(2), stage(3, { openChildren: 2 })];
    expect(codeOf(() => assertCanPass(stages, 3, completionPosition(stages)))).toBe("STAGE_CHILDREN_OPEN");
    expect(codeOf(() => assertCanPass(stages, 2, 3))).toBeNull();
    expect(codeOf(() => assertCanPass(stages, 2, completionPosition(stages)))).toBe("STAGE_CHILDREN_OPEN");
  });

  it("stops at the FIRST blocking stage, whichever reason", () => {
    const stages = [stage(1), stage(2, { openChildren: 1 }), stage(3, { approvers: ["admin"] }), stage(4, { openChildren: 5 })];
    expect(blockingStage(stages, 1)?.position).toBe(2);
    expect(codeOf(() => assertCanPass(stages, 1, 4))).toBe("STAGE_CHILDREN_OPEN");
    const afterChildren = [stage(1), stage(2, { openChildren: 0 }), stage(3, { approvers: ["admin"] }), stage(4, { openChildren: 5 })];
    expect(codeOf(() => assertCanPass(afterChildren, 1, 4))).toBe("STAGE_APPROVAL_REQUIRED");
  });

  it("with both reasons on one stage the approval error comes first", () => {
    const both = [stage(1), stage(2, { approvers: ["admin"], openChildren: 3 }), stage(3)];
    expect(codeOf(() => assertCanPass(both, 2, 3))).toBe("STAGE_APPROVAL_REQUIRED");
    // Approved but children still open: now it is the children.
    const approvedOnly = [stage(1), stage(2, { approvers: ["admin"], approved: true, openChildren: 3 }), stage(3)];
    expect(codeOf(() => assertCanPass(approvedOnly, 2, 3))).toBe("STAGE_CHILDREN_OPEN");
    // Both met: free.
    const none = [stage(1), stage(2, { approvers: ["admin"], approved: true, openChildren: 0 }), stage(3)];
    expect(codeOf(() => assertCanPass(none, 2, 3))).toBeNull();
  });

  it("withApproved fills openChildren from a map (missing = 0) or keeps the stage's own", () => {
    const stages = [{ id: "a", position: 1 }, { id: "b", position: 2 }];
    const filled = withApproved(stages, new Set(["a"]), new Map([["b", 4]]));
    expect(filled.map((s) => [s.approved, s.openChildren])).toEqual([[true, 0], [false, 4]]);
    const own = withApproved([{ id: "b", position: 2, openChildren: 7 }], new Set());
    expect(own[0]?.openChildren).toBe(7);
  });

  it("nextBlockedBy names the reason and the count", () => {
    const stages = [
      { id: "s1", name: "One", position: 1, approvers: [] as string[] },
      { id: "s2", name: "Two", position: 2, approvers: [] as string[] },
      { id: "s3", name: "Three", position: 3, approvers: ["admin"] },
    ];
    expect(nextBlockedBy(stages, new Set(), 1, new Map([["s2", 3]]))).toEqual({ stageId: "s2", stageName: "Two", stagePosition: 2, reason: "children", openChildren: 3 });
    expect(nextBlockedBy(stages, new Set(), 1)).toEqual({ stageId: "s3", stageName: "Three", stagePosition: 3, reason: "approval", openChildren: 0 });
    // Both on one stage: the approval reason wins, the count is still reported.
    expect(nextBlockedBy(stages, new Set(), 3, new Map([["s3", 2]]))).toEqual({ stageId: "s3", stageName: "Three", stagePosition: 3, reason: "approval", openChildren: 2 });
    expect(nextBlockedBy(stages, new Set(["s3"]), 3, new Map())).toBeNull();
  });
});

describe("finished and open work", () => {
  const event = (o: Partial<Parameters<typeof isFinishedEvent>[0]> = {}) => ({
    state: "active",
    currentPosition: 3,
    stageCount: 3,
    lastStageNeedsApproval: false,
    lastStageApproved: false,
    ...o,
  });

  it("a task is finished when done", () => {
    expect(isFinishedTask({ status: "done" })).toBe(true);
    for (const status of ["todo", "in_progress", "blocked"]) {
      expect(isFinishedTask({ status })).toBe(false);
      expect(isOpenTask({ status })).toBe(true);
    }
    expect(isOpenTask({ status: "done" })).toBe(false);
  });

  it("an event is finished on its last stage, with the stage approved if it needs it", () => {
    expect(isFinishedEvent(event())).toBe(true);
    expect(isFinishedEvent(event({ currentPosition: 2 }))).toBe(false);
    expect(isFinishedEvent(event({ lastStageNeedsApproval: true, lastStageApproved: false }))).toBe(false);
    expect(isFinishedEvent(event({ lastStageNeedsApproval: true, lastStageApproved: true }))).toBe(true);
    // Approval that isn't needed doesn't matter either way.
    expect(isFinishedEvent(event({ lastStageNeedsApproval: false, lastStageApproved: true }))).toBe(true);
  });

  it("a cancelled event doesn't block; a postponed one does, wherever it sits", () => {
    expect(isOpenEvent(event({ state: "cancelled", currentPosition: 1 }))).toBe(false);
    expect(isOpenEvent(event({ state: "cancelled" }))).toBe(false);
    expect(isOpenEvent(event({ state: "postponed", currentPosition: 1 }))).toBe(true);
    expect(isOpenEvent(event({ state: "postponed" }))).toBe(true);
    expect(isFinishedEvent(event({ state: "postponed" }))).toBe(false);
  });

  it("an active event is open until finished", () => {
    expect(isOpenEvent(event({ currentPosition: 1 }))).toBe(true);
    expect(isOpenEvent(event())).toBe(false);
    expect(isOpenEvent(event({ lastStageNeedsApproval: true }))).toBe(true);
  });

  it("a one-stage event is finished from the start", () => {
    expect(isFinishedEvent(event({ currentPosition: 1, stageCount: 1 }))).toBe(true);
  });
});

describe("assertDepth", () => {
  it("allows a child of a level 1 or 2 item, refuses a child of a level 3 one", () => {
    expect(codeOf(() => assertDepth(1))).toBeNull();
    expect(codeOf(() => assertDepth(2))).toBeNull();
    const err = errorOf(() => assertDepth(3));
    expect(err?.code).toBe("WORK_TOO_DEEP");
    expect(err?.status).toBe(409);
  });
});

describe("who may add a child, and to what", () => {
  const ADMIN = { userId: "admin", role: "admin" } as const;
  const SMM = { userId: "rohan", role: "social_media_manager" } as const;
  const OTHER_SMM = { userId: "sara", role: "marketing_manager" } as const;
  const EDITOR = { userId: "ed", role: "editor" } as const;

  const eventParent = (o: Partial<ParentFacts> = {}): ParentFacts => ({
    kind: "event",
    id: "e1",
    title: "10 reels",
    depth: 1,
    state: "active",
    clientId: "c1",
    clientStatus: "active",
    teamIds: ["rohan"],
    assigneeId: null,
    assignedBy: null,
    stageIds: ["s1", "s2"],
    parent: null,
    ...o,
  });
  const taskParent = (o: Partial<ParentFacts> = {}): ParentFacts => ({
    kind: "task",
    id: "t1",
    title: "Edit reel",
    depth: 1,
    state: "in_progress",
    clientId: "c1",
    clientStatus: "active",
    teamIds: ["rohan"],
    assigneeId: "ed",
    assignedBy: "rohan",
    stageIds: ["k1", "k2"],
    parent: null,
    ...o,
  });

  it("an event: the Admin and a manager on the team", () => {
    expect(assertCanAddChild(ADMIN, "event", eventParent(), "s2").id).toBe("e1");
    expect(assertCanAddChild(SMM, "event", eventParent(), "s1").id).toBe("e1");
  });

  it("an event the caller can't see is a 404, the same as a missing one", () => {
    const hidden = errorOf(() => assertCanAddChild(OTHER_SMM, "event", eventParent(), "s1"));
    const missing = errorOf(() => assertCanAddChild(SMM, "event", null, "s1"));
    expect(hidden).toEqual({ code: "EVENT_NOT_FOUND", status: 404, message: "Event not found" });
    expect(missing).toEqual(hidden);
    expect(errorOf(() => assertCanAddChild(EDITOR, "event", eventParent(), "s1"))?.status).toBe(404);
  });

  it("a task: its assignee, its creator and the Admin may; a team manager who only sees it may not (403)", () => {
    expect(assertCanAddChild(ADMIN, "task", taskParent(), "k1").id).toBe("t1");
    expect(assertCanAddChild(SMM, "task", taskParent(), "k1").id).toBe("t1"); // creator
    expect(assertCanAddChild(EDITOR, "task", taskParent(), "k2").id).toBe("t1"); // assignee
    const seesOnly = errorOf(() => assertCanAddChild({ userId: "sara", role: "marketing_manager" }, "task", taskParent({ teamIds: ["sara"] }), "k1"));
    expect(seesOnly).toMatchObject({ code: "STAFF_TASK_FORBIDDEN", status: 403 });
  });

  it("a task the caller can't see is a 404 with the task code", () => {
    const err = errorOf(() => assertCanAddChild({ userId: "x", role: "editor" }, "task", taskParent(), "k1"));
    expect(err).toEqual({ code: "STAFF_TASK_NOT_FOUND", status: 404, message: "Task not found" });
    expect(codeOf(() => assertCanAddChild(SMM, "task", null, "k1"))).toBe("STAFF_TASK_NOT_FOUND");
  });

  it("a cancelled or postponed event is EVENT_NOT_ACTIVE (stricter than cancelled alone)", () => {
    expect(errorOf(() => assertCanAddChild(SMM, "event", eventParent({ state: "cancelled" }), "s1"))).toMatchObject({ code: "EVENT_NOT_ACTIVE", status: 409 });
    expect(codeOf(() => assertCanAddChild(SMM, "event", eventParent({ state: "postponed" }), "s1"))).toBe("EVENT_NOT_ACTIVE");
  });

  it("a done task is STAFF_TASK_DONE", () => {
    expect(errorOf(() => assertCanAddChild(ADMIN, "task", taskParent({ state: "done" }), "k1"))).toMatchObject({ code: "STAFF_TASK_DONE", status: 409 });
  });

  it("an event of an archived client is read-only", () => {
    expect(codeOf(() => assertCanAddChild(ADMIN, "event", eventParent({ clientStatus: "archived" }), "s1"))).toBe("CLIENT_ARCHIVED");
  });

  it("the stage must be one of the parent's own", () => {
    expect(errorOf(() => assertCanAddChild(SMM, "event", eventParent(), "somebody-elses"))).toMatchObject({ code: "WORK_PARENT_STAGE_INVALID", status: 400 });
    expect(codeOf(() => assertCanAddChild(ADMIN, "task", taskParent(), "s1"))).toBe("WORK_PARENT_STAGE_INVALID");
  });

  it("a level 3 parent can't have children", () => {
    expect(codeOf(() => assertCanAddChild(ADMIN, "event", eventParent({ depth: 3 }), "s1"))).toBe("WORK_TOO_DEEP");
    expect(codeOf(() => assertCanAddChild(ADMIN, "task", taskParent({ depth: 2 }), "k1"))).toBeNull();
  });

  it("refusals come in a fixed order: 404, 403, state, stage, depth", () => {
    // Cancelled + wrong stage + too deep: the state is reported first.
    expect(codeOf(() => assertCanAddChild(SMM, "event", eventParent({ state: "cancelled", depth: 3 }), "nope"))).toBe("EVENT_NOT_ACTIVE");
    // Wrong stage + too deep: the stage first.
    expect(codeOf(() => assertCanAddChild(SMM, "event", eventParent({ depth: 3 }), "nope"))).toBe("WORK_PARENT_STAGE_INVALID");
    // Unseen beats everything.
    expect(codeOf(() => assertCanAddChild(OTHER_SMM, "event", eventParent({ state: "cancelled", depth: 3 }), "nope"))).toBe("EVENT_NOT_FOUND");
  });
});

describe("a child event's client", () => {
  it("is the parent's", () => {
    expect(childEventClientId({ clientId: "c1" }, "c1")).toBe("c1");
  });

  it("a task without a client can't have child events (400), before the client is compared", () => {
    expect(errorOf(() => childEventClientId({ clientId: null }, "c1"))).toMatchObject({ code: "WORK_CHILD_EVENT_NEEDS_CLIENT", status: 400 });
  });

  it("a different client is a 400 mismatch", () => {
    expect(errorOf(() => childEventClientId({ clientId: "c1" }, "c2"))).toMatchObject({ code: "WORK_CHILD_CLIENT_MISMATCH", status: 400 });
  });
});

describe("what a detail shows", () => {
  const SMM = { userId: "rohan", role: "social_media_manager" } as const;
  const ADMIN = { userId: "admin", role: "admin" } as const;

  const row = (o: Partial<WorkChildRow>): WorkChildRow => ({
    kind: "event",
    id: "x",
    title: "Reel",
    stageId: "s2",
    stageName: "Production",
    stagePosition: 2,
    currentStageName: "Rough cut",
    currentPosition: 1,
    stageCount: 3,
    status: null,
    state: "active",
    finished: false,
    assigneeName: null,
    createdAt: "2026-11-05T10:00:00.000Z",
    teamIds: ["rohan"],
    assigneeId: null,
    assignedBy: null,
    ...o,
  });

  it("lists only children the caller sees and counts the rest, never describing them", () => {
    const rows = [
      row({ id: "mine", title: "Mine" }),
      row({ id: "other-client", title: "Secret client reel", teamIds: ["sara"] }),
      row({ kind: "task", id: "t-mine", title: "Cut it", status: "todo", state: null, assigneeName: "Ed", assigneeId: "ed", assignedBy: "rohan", teamIds: [] }),
      row({ kind: "task", id: "t-hidden", title: "Private task", status: "todo", state: null, assigneeId: "ed", assignedBy: "sara", teamIds: ["sara"] }),
    ];
    const { children, hiddenChildren } = visibleChildren(SMM, rows, 4);
    expect(children.map((c) => c.id).sort()).toEqual(["mine", "t-mine"]);
    expect(hiddenChildren).toBe(2);
    // No internal field leaks, and the hidden ones' titles appear nowhere.
    expect(JSON.stringify(children)).not.toContain("Secret");
    expect(JSON.stringify(children)).not.toContain("Private");
    for (const c of children) expect(Object.keys(c)).not.toEqual(expect.arrayContaining(["teamIds"]));
    expect(children[0]).not.toHaveProperty("assigneeId");
    expect(children[0]).not.toHaveProperty("createdAt");
    expect(children[0]).not.toHaveProperty("stagePosition");
  });

  it("the Admin sees them all", () => {
    const rows = [row({ id: "a", teamIds: ["zed"] }), row({ kind: "task", id: "b", teamIds: [], assigneeId: "q", assignedBy: "r" })];
    expect(visibleChildren(ADMIN, rows, 2)).toMatchObject({ hiddenChildren: 0 });
    expect(visibleChildren(ADMIN, rows, 2).children).toHaveLength(2);
  });

  it("an assignee sees the task they were given even without any client team", () => {
    const own = row({ kind: "task", id: "t", assigneeId: "ed", assignedBy: "rohan", teamIds: [], state: null, status: "todo" });
    expect(visibleChildren({ userId: "ed", role: "editor" }, [own], 1).children).toHaveLength(1);
    expect(visibleChildren({ userId: "nope", role: "editor" }, [own], 1)).toMatchObject({ children: [], hiddenChildren: 1 });
  });

  it("counts children beyond the cut-off list as not shown", () => {
    expect(visibleChildren(ADMIN, [row({ id: "a" })], 450).hiddenChildren).toBe(449);
  });

  it("sorts by the parent's stage, then oldest first", () => {
    const rows = [
      row({ id: "late", stagePosition: 3, stageName: "Delivery" }),
      row({ id: "b", stagePosition: 2, createdAt: "2026-11-05T12:00:00.000Z" }),
      row({ id: "a", stagePosition: 2, createdAt: "2026-11-05T11:00:00.000Z" }),
    ];
    expect(visibleChildren(ADMIN, rows, 3).children.map((c) => c.id)).toEqual(["a", "b", "late"]);
  });

  it("the parent stub appears only for a caller who can see the parent", () => {
    const parent: WorkParentRecord = { kind: "event", id: "e1", title: "10 reels", stageId: "s2", stageName: "Production", teamIds: ["rohan"], assigneeId: null, assignedBy: null };
    expect(visibleParent(SMM, parent)).toEqual({ kind: "event", id: "e1", title: "10 reels", stageId: "s2", stageName: "Production" });
    expect(visibleParent({ userId: "sara", role: "marketing_manager" }, parent)).toBeNull();
    expect(visibleParent({ userId: "ed", role: "editor" }, parent)).toBeNull();
    expect(visibleParent(ADMIN, parent)?.title).toBe("10 reels");
    expect(visibleParent(ADMIN, null)).toBeNull();
    const task: WorkParentRecord = { kind: "task", id: "t1", title: "Edit", stageId: "k1", stageName: "Todo", teamIds: [], assigneeId: "ed", assignedBy: "rohan" };
    expect(visibleParent({ userId: "ed", role: "editor" }, task)?.id).toBe("t1");
    expect(visibleParent({ userId: "stranger", role: "editor" }, task)).toBeNull();
    // The stub carries no internal field.
    expect(Object.keys(visibleParent(SMM, parent)!).sort()).toEqual(["id", "kind", "stageId", "stageName", "title"]);
  });
});
