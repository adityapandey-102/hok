import { describe, expect, it } from "vitest";
import { searchPlan } from "./search.rules";

describe("searchPlan", () => {
  it("lets the Admin search everything", () => {
    expect(searchPlan({ userId: "a", role: "admin" })).toEqual({
      clients: { kind: "all" },
      events: { kind: "all" },
      tasks: { kind: "all" },
      todos: { kind: "all" },
      assets: { kind: "all" },
    });
  });

  it("scopes a manager to their own clients and their own tasks", () => {
    const own = { kind: "own", userId: "m" };
    expect(searchPlan({ userId: "m", role: "social_media_manager" })).toEqual({ clients: own, events: own, tasks: own, todos: own, assets: own });
  });

  it("gives task-only staff their own tasks and nothing else", () => {
    expect(searchPlan({ userId: "e", role: "editor" })).toEqual({
      clients: null,
      events: null,
      tasks: { kind: "own", userId: "e" },
      todos: null,
      assets: null,
    });
  });
});
