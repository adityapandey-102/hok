import { describe, expect, it } from "vitest";
import type { Role } from "../../../domain";
import type { DashboardRepositoryPort } from "./ports/dashboard-repository.port";
import { DashboardService } from "./dashboard.service";

const counts = { todo: 1, in_progress: 0, blocked: 0, done: 2 };

/** A fake that records which reads ran and with which owner / assignee. */
function fakeRepo() {
  const calls: string[] = [];
  const log = <T>(name: string, scope: string | undefined, value: T): Promise<T> => {
    calls.push(scope ? `${name}:${scope}` : name);
    return Promise.resolve(value);
  };
  const repo: DashboardRepositoryPort = {
    taskSummary: (id) => log("taskSummary", id, { counts, dueToday: 1, overdue: 0 }),
    openTasks: (f) => log("openTasks", f.assigneeId ?? (f.overdueOnly ? "overdue" : "all"), []),
    recentTaskComments: (id) => log("recentTaskComments", id, []),
    clientSummary: (id) => log("clientSummary", id, { clientCount: 3, received: 2, inProgress: 1 }),
    events: (_r, owner) => log("events", owner ?? "firm", []),
    eventsByStage: (id) => log("eventsByStage", id, []),
    latestComments: (owner) => log("latestComments", owner ?? "firm", []),
    firmTotals: () => log("firmTotals", undefined, { totals: { clients: 9, activeEvents: 4, openTasks: 5, unresolvedComments: 2 }, tasksByStatus: counts }),
    team: () => log("team", undefined, []),
  };
  return { repo, calls };
}

const NOW = () => new Date("2026-10-16T06:00:00Z");
const viewer = (role: Role) => ({ userId: "u1", role, timeZone: "Asia/Kolkata" });

describe("DashboardService", () => {
  it("gives task-only staff just their own tasks (3 reads)", async () => {
    const { repo, calls } = fakeRepo();
    const d = await new DashboardService(repo, NOW).get(viewer("editor"));
    expect(d.clients).toBeNull();
    expect(d.firm).toBeNull();
    expect(d.tasks).toMatchObject({ counts, dueToday: 1, overdue: 0, open: [], recentComments: [] });
    expect(calls.sort()).toEqual(["openTasks:u1", "recentTaskComments:u1", "taskSummary:u1"]);
  });

  it("gives managers their own clients, never the firm (7 reads)", async () => {
    const { repo, calls } = fakeRepo();
    const d = await new DashboardService(repo, NOW).get(viewer("social_media_manager"));
    expect(d.firm).toBeNull();
    expect(d.clients).toMatchObject({ clientCount: 3, unresolvedComments: { received: 2, inProgress: 1 } });
    expect(calls).toHaveLength(7);
    expect(calls.filter((c) => c.endsWith(":firm") || c === "firmTotals" || c === "team")).toEqual([]);
  });

  it("gives Admin the firm plus their own clients and tasks (12 reads)", async () => {
    const { repo, calls } = fakeRepo();
    const d = await new DashboardService(repo, NOW).get(viewer("admin"));
    expect(d.firm?.totals).toEqual({ clients: 9, activeEvents: 4, openTasks: 5, unresolvedComments: 2 });
    expect(d.clients?.clientCount).toBe(3);
    expect(calls).toHaveLength(12);
    expect(calls).toEqual(expect.arrayContaining(["events:firm", "latestComments:firm", "openTasks:overdue", "events:u1", "clientSummary:u1"]));
  });

  it("computes today in the viewer's zone", async () => {
    const { repo } = fakeRepo();
    const d = await new DashboardService(repo, NOW).get(viewer("editor"));
    expect(d.window.today).toBe("2026-10-16");
    expect(d.window.todayStart).toBe("2026-10-15T18:30:00.000Z");
  });
});
