import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import {
  assertClientUsable,
  assertClientVisible,
  assertDueRange,
  assertEventLinkable,
  assertTodoVersion,
  assertTodoVisible,
  completionChange,
} from "./client-todo.rules";

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? `${e.statusCode}:${e.code}` : "other";
  }
  return "none";
};

describe("row scope", () => {
  it("an admin sees every to-do; a manager only their own clients' (else 404)", () => {
    expect(code(() => assertTodoVisible({ kind: "all" }, { teamIds: ["a"] }))).toBe("none");
    expect(code(() => assertTodoVisible({ kind: "own", userId: "a" }, { teamIds: ["a"] }))).toBe("none");
    expect(code(() => assertTodoVisible({ kind: "own", userId: "b" }, { teamIds: ["a"] }))).toBe("404:CLIENT_TODO_NOT_FOUND");
    expect(code(() => assertTodoVisible({ kind: "all" }, null))).toBe("404:CLIENT_TODO_NOT_FOUND");
  });
  it("a client that is missing or someone else's is CLIENT_NOT_FOUND", () => {
    expect(code(() => assertClientVisible({ kind: "all" }, null))).toBe("404:CLIENT_NOT_FOUND");
    expect(code(() => assertClientVisible({ kind: "own", userId: "b" }, { id: "c", teamIds: ["a"], status: "active" }))).toBe("404:CLIENT_NOT_FOUND");
  });
});

describe("archived clients", () => {
  it("are visible but not usable for new to-dos", () => {
    const archived = { id: "c", teamIds: ["a"], status: "archived" as const };
    expect(code(() => assertClientVisible({ kind: "all" }, archived))).toBe("none");
    expect(code(() => assertClientUsable({ kind: "all" }, archived))).toBe("409:CLIENT_ARCHIVED");
    expect(code(() => assertClientUsable({ kind: "all" }, { ...archived, status: "paused" }))).toBe("none");
  });
});

describe("optimistic lock", () => {
  it("a stale version is 409; an omitted one (delete) is allowed", () => {
    expect(code(() => assertTodoVersion(2, 1))).toBe("409:CLIENT_TODO_MODIFIED");
    expect(code(() => assertTodoVersion(2, 2))).toBe("none");
    expect(code(() => assertTodoVersion(2, undefined))).toBe("none");
  });
});

describe("event link", () => {
  it("must exist and belong to the same client", () => {
    expect(code(() => assertEventLinkable("c1", { id: "e", clientId: "c1" }))).toBe("none");
    expect(code(() => assertEventLinkable("c1", { id: "e", clientId: "c2" }))).toBe("400:CLIENT_TODO_EVENT_INVALID");
    expect(code(() => assertEventLinkable("c1", null))).toBe("400:CLIENT_TODO_EVENT_INVALID");
  });
});

describe("due range", () => {
  it("dueFrom must be before dueTo", () => {
    const a = new Date("2026-10-14T00:00:00Z");
    const b = new Date("2026-10-15T00:00:00Z");
    expect(code(() => assertDueRange(a, b))).toBe("none");
    expect(code(() => assertDueRange(b, a))).toBe("400:CLIENT_TODO_RANGE_INVALID");
    expect(code(() => assertDueRange(a, a))).toBe("400:CLIENT_TODO_RANGE_INVALID");
    expect(code(() => assertDueRange(a, undefined))).toBe("none");
  });
});

describe("completionChange", () => {
  it("stamps on done, clears on reopen, otherwise keeps", () => {
    expect(completionChange("todo", "done")).toBe("stamp");
    expect(completionChange("in_progress", "done")).toBe("stamp");
    expect(completionChange("done", "todo")).toBe("clear");
    expect(completionChange("done", "in_progress")).toBe("clear");
    expect(completionChange("done", "done")).toBe("keep");
    expect(completionChange("todo", "in_progress")).toBe("keep");
  });
});
