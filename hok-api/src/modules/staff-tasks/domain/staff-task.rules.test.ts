import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { ROLES } from "../../../domain";
import {
  assertBlocked,
  assertCanAddLink,
  assertCanAssign,
  assertCanBlock,
  assertCanComment,
  assertCanComplete,
  assertCanManage,
  assertCanMoveStage,
  assertCanRaiseBlock,
  assertCanRemoveLink,
  assertCanShare,
  assertLinksRoom,
  assertReopenable,
  assertShareable,
  assertStageMove,
  assertTaskTemplateUsable,
  assertTaskVersion,
  assertTaskVisible,
  assertValidAssignee,
  canManageTask,
  canShareWithClient,
  isOverdue,
  reopenTarget,
  resolveTaskLinks,
  restrictLinksToTeam,
  statusForStage,
  type StaffTaskScope,
  type TaskTemplate,
} from "./staff-task.rules";
import { STAFF_TASK_STATUSES, type StaffTaskStatus, type TaskStage } from "./staff-task.entity";

function codeOf(fn: () => unknown): { status: number; code: string } | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return { status: err.statusCode, code: err.code };
  }
}

const ALL: StaffTaskScope = { kind: "all" };
const MEERA: StaffTaskScope = { kind: "own", userId: "meera", viaTeam: false };
const ROHAN: StaffTaskScope = { kind: "own", userId: "rohan", viaTeam: true };
/** A task-only person who is (still) listed on a client team. */
const LISTED_TASK_ONLY: StaffTaskScope = { kind: "own", userId: "rohan", viaTeam: false };

describe("assertTaskVisible (row scope)", () => {
  const meeras = { id: "t1", assigneeId: "meera", assignedBy: "admin", teamIds: [] as string[] };
  const arjuns = { id: "t2", assigneeId: "arjun", assignedBy: "admin", teamIds: [] as string[] };
  const byMeera = { id: "t3", assigneeId: "arjun", assignedBy: "meera", teamIds: [] as string[] };
  const onRohansTeam = { id: "t4", assigneeId: "arjun", assignedBy: "admin", teamIds: ["rohan", "other"] };

  it("the Admin sees every task; an assignee sees their own", () => {
    expect(assertTaskVisible(ALL, arjuns)).toBe(arjuns);
    expect(assertTaskVisible(MEERA, meeras)).toBe(meeras);
  });

  it("a creator sees the tasks they created", () => {
    expect(assertTaskVisible(MEERA, byMeera)).toBe(byMeera);
  });

  it("a client manager sees tasks of a client whose team they're on; a task-only role does not, even if still listed", () => {
    expect(assertTaskVisible(ROHAN, onRohansTeam)).toBe(onRohansTeam);
    expect(codeOf(() => assertTaskVisible(ROHAN, arjuns))).toEqual({ status: 404, code: "STAFF_TASK_NOT_FOUND" });
    expect(codeOf(() => assertTaskVisible(LISTED_TASK_ONLY, onRohansTeam))).toEqual({ status: 404, code: "STAFF_TASK_NOT_FOUND" });
  });

  it("someone else's task is a 404 STAFF_TASK_NOT_FOUND, the same as a missing one", () => {
    expect(codeOf(() => assertTaskVisible(MEERA, arjuns))).toEqual({ status: 404, code: "STAFF_TASK_NOT_FOUND" });
    expect(codeOf(() => assertTaskVisible(MEERA, null))).toEqual({ status: 404, code: "STAFF_TASK_NOT_FOUND" });
    expect(codeOf(() => assertTaskVisible(ALL, null))).toEqual({ status: 404, code: "STAFF_TASK_NOT_FOUND" });
  });
});

describe("assertTaskVersion", () => {
  it("passes on a match or no version; a stale one is 409 STAFF_TASK_MODIFIED", () => {
    expect(codeOf(() => assertTaskVersion(2, 2))).toBeNull();
    expect(codeOf(() => assertTaskVersion(2, undefined))).toBeNull();
    expect(codeOf(() => assertTaskVersion(2, 1))).toEqual({ status: 409, code: "STAFF_TASK_MODIFIED" });
  });
});

describe("assertValidAssignee (FR-TSK-01: any role, active)", () => {
  it.each([...ROLES])("accepts an active %s", (role) => {
    expect(codeOf(() => assertValidAssignee({ id: "u", role, active: true }))).toBeNull();
  });

  it("refuses a deactivated account and an unknown user", () => {
    expect(codeOf(() => assertValidAssignee({ id: "u", role: "editor", active: false }))).toEqual({ status: 400, code: "STAFF_TASK_ASSIGNEE_INVALID" });
    expect(codeOf(() => assertValidAssignee(null))).toEqual({ status: 400, code: "STAFF_TASK_ASSIGNEE_INVALID" });
  });
});

describe("assertTaskTemplateUsable (round 2)", () => {
  const tpl = (o: Partial<TaskTemplate> = {}): TaskTemplate => ({ id: "t1", name: "Reel edit", active: true, kind: "task", roles: ["editor"], stageNames: ["Cut", "Review"], ...o });

  it("an active task template with stages, offered for the assignee's role", () => {
    expect(codeOf(() => assertTaskTemplateUsable(tpl(), "editor"))).toBeNull();
  });

  it("an empty role list means any role", () => {
    for (const role of ROLES) expect(codeOf(() => assertTaskTemplateUsable(tpl({ roles: [] }), role))).toBeNull();
  });

  it("refuses a missing, inactive, event or stage-less template and a role it isn't offered for (400 STAFF_TASK_TEMPLATE_INVALID)", () => {
    const bad = { status: 400, code: "STAFF_TASK_TEMPLATE_INVALID" };
    expect(codeOf(() => assertTaskTemplateUsable(null, "editor"))).toEqual(bad);
    expect(codeOf(() => assertTaskTemplateUsable(tpl({ active: false }), "editor"))).toEqual(bad);
    expect(codeOf(() => assertTaskTemplateUsable(tpl({ kind: "event" }), "editor"))).toEqual(bad);
    expect(codeOf(() => assertTaskTemplateUsable(tpl({ stageNames: [] }), "editor"))).toEqual(bad);
    expect(codeOf(() => assertTaskTemplateUsable(tpl(), "developer"))).toEqual(bad);
  });
});

describe("stages and the status they imply (round 2)", () => {
  const stages: TaskStage[] = [
    { id: "s1", position: 1, name: "Brief" },
    { id: "s2", position: 2, name: "Cut" },
    { id: "s3", position: 3, name: "Review" },
  ];

  it("statusForStage: stage 1 todo, 2..N in progress, past the last done", () => {
    expect(statusForStage(1, 3)).toBe("todo");
    expect(statusForStage(2, 3)).toBe("in_progress");
    expect(statusForStage(3, 3)).toBe("in_progress");
    expect(statusForStage(4, 3)).toBe("done");
    // A one-stage task is todo until completed.
    expect(statusForStage(1, 1)).toBe("todo");
  });

  it("assertStageMove: any other stage, forward or back", () => {
    expect(assertStageMove({ status: "todo", currentStageId: "s1", stages, targetStageId: "s3" }).id).toBe("s3");
    expect(assertStageMove({ status: "in_progress", currentStageId: "s3", stages, targetStageId: "s1" }).id).toBe("s1");
    expect(assertStageMove({ status: "blocked", currentStageId: "s2", stages, targetStageId: "s3" }).id).toBe("s3");
  });

  it("refuses the current stage (409), another task's stage (400) and a done task (409)", () => {
    expect(codeOf(() => assertStageMove({ status: "todo", currentStageId: "s1", stages, targetStageId: "s1" }))).toEqual({ status: 409, code: "STAFF_TASK_STAGE_UNCHANGED" });
    expect(codeOf(() => assertStageMove({ status: "todo", currentStageId: "s1", stages, targetStageId: "other" }))).toEqual({ status: 400, code: "STAFF_TASK_STAGE_INVALID" });
    expect(codeOf(() => assertStageMove({ status: "done", currentStageId: "s3", stages, targetStageId: "s1" }))).toEqual({ status: 409, code: "STAFF_TASK_DONE" });
  });

  it("completing is only offered from the last stage (409 STAFF_TASK_NOT_AT_LAST_STAGE); a done task is closed", () => {
    expect(codeOf(() => assertCanComplete({ status: "in_progress", currentStagePosition: 3, stageCount: 3 }))).toBeNull();
    expect(codeOf(() => assertCanComplete({ status: "blocked", currentStagePosition: 3, stageCount: 3 }))).toBeNull();
    expect(codeOf(() => assertCanComplete({ status: "in_progress", currentStagePosition: 2, stageCount: 3 }))).toEqual({ status: 409, code: "STAFF_TASK_NOT_AT_LAST_STAGE" });
    expect(codeOf(() => assertCanComplete({ status: "done", currentStagePosition: 3, stageCount: 3 }))).toEqual({ status: 409, code: "STAFF_TASK_DONE" });
  });

  it("blocking: not a done task, not one already blocked; unblocking needs a blocked one", () => {
    expect(codeOf(() => assertCanRaiseBlock("todo"))).toBeNull();
    expect(codeOf(() => assertCanRaiseBlock("in_progress"))).toBeNull();
    expect(codeOf(() => assertCanRaiseBlock("blocked"))).toEqual({ status: 409, code: "STAFF_TASK_ALREADY_BLOCKED" });
    expect(codeOf(() => assertCanRaiseBlock("done"))).toEqual({ status: 409, code: "STAFF_TASK_DONE" });
    expect(codeOf(() => assertBlocked("blocked"))).toBeNull();
    for (const st of STAFF_TASK_STATUSES.filter((x) => x !== "blocked")) {
      expect(codeOf(() => assertBlocked(st))).toEqual({ status: 409, code: "STAFF_TASK_NOT_BLOCKED" });
    }
  });

  it("only a done task can be reopened (else 409 STAFF_TASK_NOT_DONE); it goes to the named stage, default the last", () => {
    expect(codeOf(() => assertReopenable("done"))).toBeNull();
    for (const st of STAFF_TASK_STATUSES.filter((x): x is StaffTaskStatus => x !== "done")) {
      expect(codeOf(() => assertReopenable(st))).toEqual({ status: 409, code: "STAFF_TASK_NOT_DONE" });
    }
    expect(reopenTarget(stages, undefined).id).toBe("s3");
    expect(reopenTarget(stages, "s2").id).toBe("s2");
    expect(codeOf(() => reopenTarget(stages, "nope"))).toEqual({ status: 400, code: "STAFF_TASK_STAGE_INVALID" });
  });
});

describe("links (round 2)", () => {
  const assignee = { userId: "meera", role: "editor" } as const;
  const creator = { userId: "rohan", role: "social_media_manager" } as const;
  const admin = { userId: "a", role: "admin" } as const;
  const teamManager = { userId: "pia", role: "marketing_manager" } as const;
  const t = { assigneeId: "meera", assignedBy: "rohan" };
  const forbidden = { status: 403, code: "STAFF_TASK_FORBIDDEN" };

  it("brief links: the creator or the Admin; delivered links: the assignee or the Admin", () => {
    expect(codeOf(() => assertCanAddLink(creator, t, "brief"))).toBeNull();
    expect(codeOf(() => assertCanAddLink(admin, t, "brief"))).toBeNull();
    expect(codeOf(() => assertCanAddLink(assignee, t, "brief"))).toEqual(forbidden);
    expect(codeOf(() => assertCanAddLink(teamManager, t, "brief"))).toEqual(forbidden);
    expect(codeOf(() => assertCanAddLink(assignee, t, "delivered"))).toBeNull();
    expect(codeOf(() => assertCanAddLink(admin, t, "delivered"))).toBeNull();
    expect(codeOf(() => assertCanAddLink(creator, t, "delivered"))).toEqual(forbidden);
  });

  it("removing: whoever added it, or whoever manages the task", () => {
    expect(codeOf(() => assertCanRemoveLink(assignee, t, { addedById: "meera" }))).toBeNull();
    expect(codeOf(() => assertCanRemoveLink(creator, t, { addedById: "meera" }))).toBeNull();
    expect(codeOf(() => assertCanRemoveLink(admin, t, { addedById: null }))).toBeNull();
    expect(codeOf(() => assertCanRemoveLink(assignee, t, { addedById: "rohan" }))).toEqual(forbidden);
    expect(codeOf(() => assertCanRemoveLink(teamManager, t, { addedById: "meera" }))).toEqual(forbidden);
  });

  it("at most 50 links per task (409 STAFF_TASK_LINKS_LIMIT)", () => {
    expect(codeOf(() => assertLinksRoom(49))).toBeNull();
    expect(codeOf(() => assertLinksRoom(50))).toEqual({ status: 409, code: "STAFF_TASK_LINKS_LIMIT" });
    expect(codeOf(() => assertLinksRoom(45, 6))).toEqual({ status: 409, code: "STAFF_TASK_LINKS_LIMIT" });
  });

  it("sharing with the client: the Admin or a team manager who can write assets; an editor never", () => {
    const onTeam = { eventId: "e1", teamIds: ["rohan", "x"] };
    expect(canShareWithClient(admin, onTeam)).toBe(true);
    expect(canShareWithClient(creator, onTeam)).toBe(true);
    expect(canShareWithClient(teamManager, onTeam)).toBe(false);
    expect(canShareWithClient(assignee, { eventId: "e1", teamIds: ["meera"] })).toBe(false);
    expect(canShareWithClient(admin, { eventId: null, teamIds: [] })).toBe(false);
    expect(codeOf(() => assertCanShare(creator, onTeam))).toBeNull();
    expect(codeOf(() => assertCanShare(assignee, onTeam))).toEqual(forbidden);
    expect(codeOf(() => assertCanShare(creator, { eventId: null, teamIds: ["rohan"] }))).toEqual({ status: 409, code: "STAFF_TASK_NO_EVENT" });
    expect(codeOf(() => assertCanShare(teamManager, onTeam))).toEqual(forbidden);
  });

  it("only a delivered, not-yet-shared link can be shared", () => {
    expect(codeOf(() => assertShareable({ kind: "delivered", sharedAssetId: null }))).toBeNull();
    expect(codeOf(() => assertShareable({ kind: "delivered", sharedAssetId: "a1" }))).toEqual({ status: 409, code: "STAFF_TASK_LINK_ALREADY_SHARED" });
    expect(codeOf(() => assertShareable({ kind: "brief", sharedAssetId: null }))).toEqual({ status: 404, code: "STAFF_TASK_LINK_NOT_FOUND" });
    expect(codeOf(() => assertShareable(null))).toEqual({ status: 404, code: "STAFF_TASK_LINK_NOT_FOUND" });
  });
});

describe("resolveTaskLinks", () => {
  const event = { id: "e1", clientId: "c1", title: "Shoot", teamIds: [] as string[] };

  it("no links at all is fine", () => {
    expect(resolveTaskLinks(null, null, null, null)).toEqual({ clientId: null, eventId: null });
  });

  it("an existing client; an unknown one is 400 STAFF_TASK_CLIENT_INVALID", () => {
    expect(resolveTaskLinks("c1", { id: "c1", teamIds: [] }, null, null)).toEqual({ clientId: "c1", eventId: null });
    expect(codeOf(() => resolveTaskLinks("c9", null, null, null))).toEqual({ status: 400, code: "STAFF_TASK_CLIENT_INVALID" });
  });

  it("an event alone links its client; it must belong to a named client", () => {
    expect(resolveTaskLinks(null, null, "e1", event)).toEqual({ clientId: "c1", eventId: "e1" });
    expect(resolveTaskLinks("c1", { id: "c1", teamIds: [] }, "e1", event)).toEqual({ clientId: "c1", eventId: "e1" });
    expect(codeOf(() => resolveTaskLinks("c2", { id: "c2", teamIds: [] }, "e1", event))).toEqual({ status: 400, code: "STAFF_TASK_EVENT_INVALID" });
  });

  it("an unknown event (or no events table yet) is 400 STAFF_TASK_EVENT_INVALID", () => {
    expect(codeOf(() => resolveTaskLinks(null, null, "e9", null))).toEqual({ status: 400, code: "STAFF_TASK_EVENT_INVALID" });
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  it("past due and not done", () => {
    expect(isOverdue({ dueAt: "2026-10-14T11:59:00Z", status: "in_progress" }, now)).toBe(true);
    expect(isOverdue({ dueAt: "2026-10-14T11:59:00Z", status: "done" }, now)).toBe(false);
    expect(isOverdue({ dueAt: "2026-10-14T12:01:00Z", status: "todo" }, now)).toBe(false);
    expect(isOverdue({ dueAt: null, status: "todo" }, now)).toBe(false);
  });
});

describe("canManageTask / assertCanManage (edit, reassign, reopen, delete)", () => {
  it("the Admin always; the creator while they still hold staff_tasks:assign; nobody else", () => {
    expect(canManageTask({ userId: "a", role: "admin" }, { assignedBy: "someone" })).toBe(true);
    expect(canManageTask({ userId: "rohan", role: "social_media_manager" }, { assignedBy: "rohan" })).toBe(true);
    expect(canManageTask({ userId: "rohan", role: "social_media_manager" }, { assignedBy: "admin" })).toBe(false);
    expect(canManageTask({ userId: "rohan", role: "social_media_manager" }, { assignedBy: null })).toBe(false);
    // Moved to a task-only role: still the creator, but no longer holds the assign capability.
    expect(canManageTask({ userId: "rohan", role: "editor" }, { assignedBy: "rohan" })).toBe(false);
  });

  it("a visible task the caller can't manage is 403 STAFF_TASK_FORBIDDEN (not 404)", () => {
    expect(codeOf(() => assertCanManage({ userId: "rohan", role: "project_manager" }, { assignedBy: "admin" }))).toEqual({ status: 403, code: "STAFF_TASK_FORBIDDEN" });
    expect(codeOf(() => assertCanManage({ userId: "rohan", role: "project_manager" }, { assignedBy: "rohan" }))).toBeNull();
  });
});

describe("assertCanMoveStage / assertCanBlock / assertCanComment", () => {
  const admin = { userId: "a", role: "admin" } as const;
  const assignee = { userId: "meera", role: "editor" } as const;
  const creator = { userId: "rohan", role: "social_media_manager" } as const;
  const teamManager = { userId: "pia", role: "marketing_manager" } as const;
  const t = { assigneeId: "meera", assignedBy: "rohan" };
  const forbidden = { status: 403, code: "STAFF_TASK_FORBIDDEN" };

  it("stage moves (and unblocking): the assignee, the creator or the Admin; a team manager is refused with 403", () => {
    for (const who of [assignee, creator, admin]) expect(codeOf(() => assertCanMoveStage(who, t))).toBeNull();
    expect(codeOf(() => assertCanMoveStage(teamManager, t))).toEqual(forbidden);
  });

  it("blocking: the assignee or the Admin; the creator and team managers are refused with 403", () => {
    expect(codeOf(() => assertCanBlock(assignee, t))).toBeNull();
    expect(codeOf(() => assertCanBlock(admin, t))).toBeNull();
    expect(codeOf(() => assertCanBlock(creator, t))).toEqual(forbidden);
    expect(codeOf(() => assertCanBlock(teamManager, t))).toEqual(forbidden);
  });

  it("comment: the assignee, the creator or the Admin; a team manager is refused with 403", () => {
    for (const who of [assignee, creator, admin]) expect(codeOf(() => assertCanComment(who, t))).toBeNull();
    expect(codeOf(() => assertCanComment(teamManager, t))).toEqual(forbidden);
  });
});

describe("assertCanAssign (the ladder, judged against the caller)", () => {
  it("Admin -> anyone below; manager -> task-only; never sideways or up", () => {
    expect(codeOf(() => assertCanAssign("admin", "social_media_manager"))).toBeNull();
    expect(codeOf(() => assertCanAssign("admin", "editor"))).toBeNull();
    expect(codeOf(() => assertCanAssign("project_manager", "content_writer"))).toBeNull();
    for (const [from, to] of [
      ["admin", "admin"],
      ["social_media_manager", "marketing_manager"],
      ["project_manager", "admin"],
      ["editor", "developer"],
    ] as const) {
      expect(codeOf(() => assertCanAssign(from, to))).toEqual({ status: 400, code: "STAFF_TASK_ASSIGNEE_NOT_ALLOWED" });
    }
  });
});

describe("restrictLinksToTeam (a manager links only their own clients)", () => {
  const rohan = { userId: "rohan", role: "social_media_manager" } as const;
  const admin = { userId: "a", role: "admin" } as const;
  const mine = { id: "c1", teamIds: ["rohan"] };
  const notMine = { id: "c2", teamIds: ["pia"] };
  const myEvent = { id: "e1", clientId: "c1", title: "Shoot", teamIds: ["rohan"] };
  const otherEvent = { id: "e2", clientId: "c2", title: "Reel", teamIds: ["pia"] };

  it("the Admin links anything", () => {
    expect(restrictLinksToTeam(admin, notMine, otherEvent)).toEqual({ client: notMine, event: otherEvent });
  });

  it("a manager keeps a client / event of their team", () => {
    expect(restrictLinksToTeam(rohan, mine, myEvent)).toEqual({ client: mine, event: myEvent });
    expect(restrictLinksToTeam(rohan, null, null)).toEqual({ client: null, event: null });
  });

  it("another team's client is masked (so resolveTaskLinks says no such client); its event is a 400 STAFF_TASK_CLIENT_INVALID", () => {
    expect(restrictLinksToTeam(rohan, notMine, null).client).toBeNull();
    expect(codeOf(() => restrictLinksToTeam(rohan, null, otherEvent))).toEqual({ status: 400, code: "STAFF_TASK_CLIENT_INVALID" });
    const masked = restrictLinksToTeam(rohan, notMine, null);
    expect(codeOf(() => resolveTaskLinks("c2", masked.client, null, null))).toEqual({ status: 400, code: "STAFF_TASK_CLIENT_INVALID" });
  });
});
