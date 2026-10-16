import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { ROLES } from "../../../domain";
import {
  assertReopenable,
  assertStatusChange,
  assertTaskVersion,
  assertTaskVisible,
  assertValidAssignee,
  isOverdue,
  resolveEditorFields,
  resolveTaskLinks,
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
const MEERA: StaffTaskScope = { kind: "own", userId: "meera" };
const EMPTY = { rawFilesUrl: null, referenceUrl: null, script: null };

describe("assertTaskVisible (row scope)", () => {
  const meeras = { id: "t1", assigneeId: "meera" };
  const arjuns = { id: "t2", assigneeId: "arjun" };

  it("the Admin sees every task; an assignee sees their own", () => {
    expect(assertTaskVisible(ALL, arjuns)).toBe(arjuns);
    expect(assertTaskVisible(MEERA, meeras)).toBe(meeras);
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

  it("an editor task keeps its brief; only the raw files link is required", () => {
    expect(resolveEditorFields("editor", brief, brief)).toEqual(brief);
    const minimal = { ...EMPTY, rawFilesUrl: "https://drive.google.com/x" };
    expect(resolveEditorFields("editor", minimal, minimal)).toEqual(minimal);
  });

  it("an editor task without the raw files link is 400 STAFF_TASK_EDITOR_FIELDS_REQUIRED", () => {
    expect(codeOf(() => resolveEditorFields("editor", EMPTY, {}))).toEqual({ status: 400, code: "STAFF_TASK_EDITOR_FIELDS_REQUIRED" });
    expect(codeOf(() => resolveEditorFields("editor", { ...brief, rawFilesUrl: null }, { rawFilesUrl: null }))).toEqual({
      status: 400,
      code: "STAFF_TASK_EDITOR_FIELDS_REQUIRED",
    });
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
  const event = { id: "e1", clientId: "c1", title: "Shoot" };

  it("no links at all is fine", () => {
    expect(resolveTaskLinks(null, null, null, null)).toEqual({ clientId: null, eventId: null });
  });

  it("an existing client; an unknown one is 400 STAFF_TASK_CLIENT_INVALID", () => {
    expect(resolveTaskLinks("c1", { id: "c1" }, null, null)).toEqual({ clientId: "c1", eventId: null });
    expect(codeOf(() => resolveTaskLinks("c9", null, null, null))).toEqual({ status: 400, code: "STAFF_TASK_CLIENT_INVALID" });
  });

  it("an event alone links its client; it must belong to a named client", () => {
    expect(resolveTaskLinks(null, null, "e1", event)).toEqual({ clientId: "c1", eventId: "e1" });
    expect(resolveTaskLinks("c1", { id: "c1" }, "e1", event)).toEqual({ clientId: "c1", eventId: "e1" });
    expect(codeOf(() => resolveTaskLinks("c2", { id: "c2" }, "e1", event))).toEqual({ status: 400, code: "STAFF_TASK_EVENT_INVALID" });
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
