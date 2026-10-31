import { describe, expect, it } from "vitest";
import { EMPTY_TODO_FILTERS, hasTodoFilters, toTodoApiFilters } from "./todoFilters";

const ZONE = "Asia/Kolkata";

describe("toTodoApiFilters", () => {
  it("Open sends no status (the API default), Done and All send theirs", () => {
    expect(toTodoApiFilters(EMPTY_TODO_FILTERS, ZONE).status).toBeUndefined();
    expect(toTodoApiFilters({ ...EMPTY_TODO_FILTERS, tab: "done" }, ZONE).status).toBe("done");
    expect(toTodoApiFilters({ ...EMPTY_TODO_FILTERS, tab: "all" }, ZONE).status).toBe("all");
  });
  it("trims the search, drops blanks and passes the priority", () => {
    const f = toTodoApiFilters({ ...EMPTY_TODO_FILTERS, search: "  shoot ", priority: "high" }, ZONE);
    expect(f).toMatchObject({ search: "shoot", priority: "high" });
    expect(toTodoApiFilters({ ...EMPTY_TODO_FILTERS, search: "  " }, ZONE).search).toBeUndefined();
  });
  it("overdue is a flag; today and this week are the viewer's day boundaries", () => {
    expect(toTodoApiFilters({ ...EMPTY_TODO_FILTERS, due: "overdue" }, ZONE).overdue).toBe(true);
    const today = toTodoApiFilters({ ...EMPTY_TODO_FILTERS, due: "today" }, ZONE);
    const week = toTodoApiFilters({ ...EMPTY_TODO_FILTERS, due: "week" }, ZONE);
    expect(today.dueFrom).toBe(week.dueFrom);
    expect(new Date(today.dueTo!).getTime() - new Date(today.dueFrom!).getTime()).toBe(24 * 3600_000);
    expect(new Date(week.dueTo!).getTime() - new Date(week.dueFrom!).getTime()).toBe(7 * 24 * 3600_000);
    expect(today.dueFrom).toMatch(/\+05:30$|Z$/);
  });
});

describe("hasTodoFilters", () => {
  it("ignores the tab", () => {
    expect(hasTodoFilters({ ...EMPTY_TODO_FILTERS, tab: "done" })).toBe(false);
    expect(hasTodoFilters({ ...EMPTY_TODO_FILTERS, due: "overdue" })).toBe(true);
  });
});
