import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { ROLES } from "../../../domain";
import {
  assertCanAssign,
  assertCanChangeStatus,
  assertCanComment,
  assertCanManage,
  assertReopenable,
  assertStatusChange,
  assertTaskVersion,
  assertTaskVisible,
  assertValidAssignee,
  canManageTask,
  isOverdue,
  resolveEditorFields,
  resolveTaskLinks,
  restrictLinksToTeam,
  type StaffTaskScope,
} from "./staff-task.rules";
import { STAFF_TASK_STATUSES } from "./staff-task.entity";

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
const EMPTY = { rawFilesUrl: null, referenceUrl: null, script: null };

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

describe("resolveEditorFields (FR-TSK-10)", () => {
  const brief = { rawFilesUrl: "https://drive.google.com/x", referenceUrl: "https://youtu.be/y", script: "Hook, then product." };

  it("an editor task keeps whatever brief it has; none of the three is required", () => {
    expect(resolveEditorFields("editor", brief, brief)).toEqual(brief);
    expect(resolveEditorFields("editor", EMPTY, {})).toEqual(EMPTY);
    expect(resolveEditorFields("editor", { ...EMPTY, script: "Hook." }, { script: "Hook." })).toEqual({ ...EMPTY, script: "Hook." });
  });

  it("sending editor fields for anyone else is 400 STAFF_TASK_EDITOR_FIELDS_INVALID", () => {
    for (const role of ROLES.filter((r) => r !== "editor")) {
      expect(codeOf(() => resolveEditorFields(role, brief, { script: "x" }))).toEqual({ status: 400, code: "STAFF_TASK_EDITOR_FIELDS_INVALID" });
    }
  });

  it("reassigning away from an editor clears the stored brief; explicit nulls are fine", () => {
    expect(resolveEditorFields("developer", brief, {})).toEqual(EMPTY);
    expect(resolveEditorFields("developer", EMPTY, { rawFilesUrl: null, script: null })).toEqual(EMPTY);
  });
});

describe("status changes (FR-TSK-03/04/05)", () => {
  const open = STAFF_TASK_STATUSES.filter((s) => s !== "done");

  it("any open status may move to any other status, including done", () => {
    for (const from of open) {
      for (const to of STAFF_TASK_STATUSES.filter((s) => s !== from)) {
        expect(codeOf(() => assertStatusChange(from, to))).toBeNull();
      }
    }
  });

  it("the same status is 409 STAFF_TASK_STATUS_UNCHANGED", () => {
    expect(codeOf(() => assertStatusChange("todo", "todo"))).toEqual({ status: 409, code: "STAFF_TASK_STATUS_UNCHANGED" });
  });

  it("a done task is closed: 409 STAFF_TASK_DONE until the Admin reopens it", () => {
    for (const to of STAFF_TASK_STATUSES) {
      expect(codeOf(() => assertStatusChange("done", to))).toEqual({ status: 409, code: "STAFF_TASK_DONE" });
    }
  });

  it("only a done task can be reopened (else 409 STAFF_TASK_NOT_DONE)", () => {
    expect(codeOf(() => assertReopenable("done"))).toBeNull();
    for (const s of open) expect(codeOf(() => assertReopenable(s))).toEqual({ status: 409, code: "STAFF_TASK_NOT_DONE" });
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

describe("assertCanChangeStatus / assertCanComment", () => {
  const admin = { userId: "a", role: "admin" } as const;
  const assignee = { userId: "meera", role: "editor" } as const;
  const creator = { userId: "rohan", role: "social_media_manager" } as const;
  const teamManager = { userId: "pia", role: "marketing_manager" } as const;
  const t = { assigneeId: "meera", assignedBy: "rohan" };

  it("status: the assignee or the Admin; the creator and team managers are refused with 403", () => {
    expect(codeOf(() => assertCanChangeStatus(assignee, t))).toBeNull();
    expect(codeOf(() => assertCanChangeStatus(admin, t))).toBeNull();
    expect(codeOf(() => assertCanChangeStatus(creator, t))).toEqual({ status: 403, code: "STAFF_TASK_FORBIDDEN" });
    expect(codeOf(() => assertCanChangeStatus(teamManager, t))).toEqual({ status: 403, code: "STAFF_TASK_FORBIDDEN" });
  });

  it("comment: the assignee, the creator or the Admin; a team manager is refused with 403", () => {
    for (const who of [assignee, creator, admin]) expect(codeOf(() => assertCanComment(who, t))).toBeNull();
    expect(codeOf(() => assertCanComment(teamManager, t))).toEqual({ status: 403, code: "STAFF_TASK_FORBIDDEN" });
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
