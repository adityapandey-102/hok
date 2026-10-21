import { describe, expect, it } from "vitest";
import type { ReportRepositoryPort } from "./ports/report-repository.port";
import { ReportsService } from "./reports.service";

const NOW = () => new Date("2026-10-21T10:00:00Z");

function fakeRepo(over: Partial<ReportRepositoryPort> = {}) {
  const calls: string[] = [];
  const repo: ReportRepositoryPort = {
    teamStatus: () => {
      calls.push("teamStatus");
      return Promise.resolve([
        { userId: "a", name: "Ann", role: "editor", lastSeenAt: new Date("2026-10-21T09:00:00Z"), openTasks: 2, overdue: 1, activityLast24h: 0 },
        { userId: "b", name: "Bo", role: "developer", lastSeenAt: null, openTasks: 0, overdue: 0, activityLast24h: 5 },
      ]);
    },
    teamStatusCount: () => {
      calls.push("teamStatusCount");
      return Promise.resolve(2);
    },
    person: (id) => {
      calls.push("person");
      return Promise.resolve(id === "missing" ? null : { userId: id, name: "Ann", role: "editor", lastSeenAt: null });
    },
    staffFigures: (_id, _m, weeks) => {
      calls.push("staffFigures");
      return Promise.resolve({ assigned: 4, completed: 3, onTime: 2, late: 1, avgDaysToComplete: 1.5, openNow: 1, overdueNow: 0, weeks: weeks.map(() => ({ assigned: 1, completed: 0 })) });
    },
    client: (id) => {
      calls.push("client");
      return Promise.resolve(id === "missing" ? null : { clientId: id, name: "Cafe", ownerId: "o", ownerName: "Owner" });
    },
    clientFigures: () => {
      calls.push("clientFigures");
      return Promise.resolve({
        events: { total: 1, byState: { active: 1, cancelled: 0, postponed: 0 }, byType: { shoot: 1, campaign: 0, meeting: 0, content_posting: 0, other: 0 } },
        stageMoves: 2,
        comments: { received: 1, solved: 1, replied: 1, avgFirstReplyHours: 3, byStatus: { received: 0, in_progress: 0, solved: 1 } },
        todos: { done: 1, open: 2 },
        assetsAdded: 3,
      });
    },
    ...over,
  };
  return { repo, calls };
}

describe("ReportsService", () => {
  it("team status: two reads, the rule applied, the window returned", async () => {
    const { repo, calls } = fakeRepo();
    const page = await new ReportsService(repo, NOW).teamStatusPage({}, 20, 0);
    expect(calls.sort()).toEqual(["teamStatus", "teamStatusCount"]);
    expect(page.members.map((m) => m.status)).toEqual(["working", "idle"]);
    expect(page).toMatchObject({ total: 2, limit: 20, offset: 0, rule: { windowHours: 24 } });
    expect(page.members[0]!.lastSeenAt).toBe("2026-10-21T09:00:00.000Z");
  });

  it("staff report: the weeks carry their day labels and the figures", async () => {
    const { repo } = fakeRepo();
    const r = await new ReportsService(repo, NOW).staffReport("a", "2026-10", "UTC");
    expect(r).toMatchObject({ assigned: 4, completed: 3, onTime: 2, late: 1, avgDaysToComplete: 1.5 });
    expect(r.weeks).toHaveLength(5);
    expect(r.weeks[0]).toMatchObject({ startDay: "2026-10-01", endDay: "2026-10-04", assigned: 1 });
  });

  it("staff report: a bad month is 400 before anything is read; a missing person is 404", async () => {
    const { repo, calls } = fakeRepo();
    const svc = new ReportsService(repo, NOW);
    await expect(svc.staffReport("a", "2026-04", "UTC")).rejects.toMatchObject({ statusCode: 400, code: "REPORT_MONTH_OUT_OF_RANGE" });
    expect(calls).toEqual([]);
    await expect(svc.staffReport("missing", "2026-10", "UTC")).rejects.toMatchObject({ statusCode: 404, code: "USER_NOT_FOUND" });
  });

  it("client report: shaped with the client and the figures; missing is 404", async () => {
    const { repo } = fakeRepo();
    const svc = new ReportsService(repo, NOW);
    expect(await svc.clientReport("c", "2026-10", "UTC")).toMatchObject({ client: { name: "Cafe", ownerName: "Owner" }, stageMoves: 2, assetsAdded: 3 });
    await expect(svc.clientReport("missing", "2026-10", "UTC")).rejects.toMatchObject({ statusCode: 404, code: "CLIENT_NOT_FOUND" });
    await expect(svc.clientReport("c", "2027-01", "UTC")).rejects.toMatchObject({ code: "REPORT_MONTH_OUT_OF_RANGE" });
  });
});
