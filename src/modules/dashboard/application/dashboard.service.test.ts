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
    clientSummary: (id) => log("clientSummary", id, { clientCount: 3, received: 2, inProgress: 1, weekEventCount: 4 }),
    events: (_r, owner) => log("events", owner ?? "firm", []),
    eventsByStage: (id) => log("eventsByStage", id, []),
    latestComments: (owner) => log("latestComments", owner ?? "firm", []),
    firmTotals: () =>
      log("firmTotals", undefined, {
        totals: { clients: 9, activeEvents: 4, openTasks: 5, overdueTasks: 1, unresolvedComments: 2, weekEvents: 3, teamSize: 6 },
        tasksByStatus: counts,
      }),
    team: (_now, f, limit, offset) => log("team", f.search ?? (limit === 5 && offset === 0 ? "dashboard" : "page"), []),
    teamCount: () => log("teamCount", undefined, 7),
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

  it("gives Admin the firm alone on the overview (5 reads)", async () => {
    const { repo, calls } = fakeRepo();
    const d = await new DashboardService(repo, NOW).get(viewer("admin"));
    expect(d.firm?.totals).toEqual({ clients: 9, activeEvents: 4, openTasks: 5, overdueTasks: 1, unresolvedComments: 2, weekEvents: 3, teamSize: 6 });
    expect(d.clients).toBeNull();
    expect(d.tasks).toBeNull();
    expect(calls.sort()).toEqual(["events:firm", "firmTotals", "latestComments:firm", "openTasks:overdue", "team:dashboard"]);
  });

  it("gives Admin their own clients and tasks on 'mine' (7 reads, no firm)", async () => {
    const { repo, calls } = fakeRepo();
    const d = await new DashboardService(repo, NOW).get(viewer("admin"), "mine");
    expect(d.view).toBe("mine");
    expect(d.firm).toBeNull();
    expect(d.clients?.weekEventCount).toBe(4);
    expect(calls).toHaveLength(7);
    expect(calls).toEqual(expect.arrayContaining(["events:u1", "clientSummary:u1", "taskSummary:u1"]));
  });

  it("computes today in the viewer's zone", async () => {
    const { repo } = fakeRepo();
    const d = await new DashboardService(repo, NOW).get(viewer("editor"));
    expect(d.window.today).toBe("2026-10-16");
    expect(d.window.todayStart).toBe("2026-10-15T18:30:00.000Z");
  });

  it("pages the team workload with its filter, in two reads", async () => {
    const { repo, calls } = fakeRepo();
    const page = await new DashboardService(repo, NOW).teamPage({ search: "mee" }, 20, 40);
    expect(page).toEqual({ members: [], total: 7, limit: 20, offset: 40 });
    expect(calls.sort()).toEqual(["team:mee", "teamCount"]);
  });
});
