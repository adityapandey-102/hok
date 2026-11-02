import { describe, expect, it } from "vitest";
import { CalendarService } from "./calendar.service";
import type { CalendarEventItem, CalendarPersonalItem, CalendarTaskItem, CalendarTodoItem } from "../domain/calendar.entity";
import type {
  CalendarEventFilters,
  CalendarPersonalFilters,
  CalendarRepositoryPort,
  CalendarTaskFilters,
} from "./ports/calendar-repository.port";

function ev(id: string, startsAt: string): CalendarEventItem {
  return {
    kind: "event",
    id,
    title: id,
    startsAt,
    endsAt: startsAt,
    timeZone: "UTC",
    clientId: "c1",
    clientName: "Acme",
    ownerId: "rohan",
    eventType: "shoot",
    state: "active",
    currentStageName: "Planned",
    currentStagePosition: 1,
    stageCount: 3,
  };
}
function pe(id: string, startsAt: string): CalendarPersonalItem {
  return { kind: "personal", id, title: id, startsAt, endsAt: startsAt, timeZone: "UTC", clientId: null, clientName: null, ownerId: "rohan" };
}
function tk(id: string, startsAt: string): CalendarTaskItem {
  return {
    kind: "task",
    id,
    title: id,
    startsAt,
    endsAt: startsAt,
    timeZone: "UTC",
    clientId: null,
    clientName: null,
    ownerId: "meera",
    assigneeId: "meera",
    assigneeName: "Meera",
    status: "todo",
    priority: "medium",
  };
}
function td(id: string, startsAt: string): CalendarTodoItem {
  return { kind: "todo", id, title: id, startsAt, endsAt: startsAt, timeZone: "UTC", clientId: null, clientName: null, ownerId: "rohan", urgency: "high", done: false };
}

class FakeRepo implements CalendarRepositoryPort {
  eventCalls: { f: CalendarEventFilters; limit: number }[] = [];
  personalCalls: { f: CalendarPersonalFilters; limit: number }[] = [];
  taskCalls: { f: CalendarTaskFilters; limit: number }[] = [];
  todoCalls: { f: { ownerId: string }; limit: number }[] = [];
  constructor(
    private events: CalendarEventItem[] = [],
    private personal: CalendarPersonalItem[] = [],
    private tasks: CalendarTaskItem[] = [],
    private todos: CalendarTodoItem[] = [],
  ) {}
  eventsInRange(_r: unknown, f: CalendarEventFilters, limit: number) {
    this.eventCalls.push({ f, limit });
    return Promise.resolve(this.events.slice(0, limit));
  }
  personalInRange(_r: unknown, f: CalendarPersonalFilters, limit: number) {
    this.personalCalls.push({ f, limit });
    return Promise.resolve(this.personal.slice(0, limit));
  }
  tasksInRange(_r: unknown, f: CalendarTaskFilters, limit: number) {
    this.taskCalls.push({ f, limit });
    return Promise.resolve(this.tasks.slice(0, limit));
  }
  todosInRange(_r: unknown, f: { ownerId: string }, limit: number) {
    this.todoCalls.push({ f, limit });
    return Promise.resolve(this.todos.slice(0, limit));
  }
}

const RANGE = { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z", include: "all" as const };
const ROHAN = { userId: "rohan", role: "social_media_manager" as const };
const ADMIN = { userId: "admin", role: "admin" as const };
const MEERA = { userId: "meera", role: "editor" as const };

const counts = (r: FakeRepo) => [r.eventCalls.length, r.personalCalls.length, r.taskCalls.length, r.todoCalls.length];

describe("CalendarService.feed", () => {
  it("merges all four kinds by start, scoped to the manager, in four queries", async () => {
    const repo = new FakeRepo(
      [ev("e1", "2026-10-05T10:00:00.000Z")],
      [pe("p1", "2026-10-03T10:00:00.000Z")],
      [tk("t1", "2026-10-04T10:00:00.000Z")],
      [td("d1", "2026-10-02T10:00:00.000Z")],
    );
    const feed = await new CalendarService(repo).feed(ROHAN, { ...RANGE, ownerId: "sara" });
    expect(feed.items.map((i) => i.id)).toEqual(["d1", "p1", "t1", "e1"]);
    expect(feed.truncated).toBe(false);
    expect(counts(repo)).toEqual([1, 1, 1, 1]);
    expect(repo.eventCalls[0]?.f.ownerId).toBe("rohan");
    expect(repo.personalCalls[0]?.f.ownerId).toBe("rohan");
    expect(repo.taskCalls[0]?.f.scope).toEqual({ kind: "own", userId: "rohan", viaTeam: true });
    expect(repo.todoCalls[0]?.f.ownerId).toBe("rohan");
  });

  it("task-only staff get tasks and to-dos (their own scope, no team) and no events or personal entries", async () => {
    const repo = new FakeRepo([ev("e1", "2026-10-05T10:00:00.000Z")], [pe("p1", "2026-10-03T10:00:00.000Z")], [tk("t1", "2026-10-04T10:00:00.000Z")]);
    const feed = await new CalendarService(repo).feed(MEERA, RANGE);
    expect(feed.items.map((i) => i.id)).toEqual(["t1"]);
    expect(counts(repo)).toEqual([0, 0, 1, 1]);
    expect(repo.taskCalls[0]?.f.scope).toEqual({ kind: "own", userId: "meera", viaTeam: false });
    expect(repo.todoCalls[0]?.f.ownerId).toBe("meera");
  });

  it("the Admin reads every task (narrowed by ownerId) but only their OWN to-dos, whatever ownerId says", async () => {
    const repo = new FakeRepo();
    await new CalendarService(repo).feed(ADMIN, { ...RANGE, ownerId: "sara" });
    expect(repo.taskCalls[0]?.f.scope).toEqual({ kind: "all", assigneeId: "sara" });
    expect(repo.todoCalls[0]?.f.ownerId).toBe("admin");
    expect(repo.eventCalls[0]?.f.ownerId).toBe("sara");
  });

  it("include picks one kind", async () => {
    const only = async (include: "events" | "personal" | "tasks" | "todos") => {
      const repo = new FakeRepo();
      await new CalendarService(repo).feed(ROHAN, { ...RANGE, include });
      return counts(repo);
    };
    expect(await only("events")).toEqual([1, 0, 0, 0]);
    expect(await only("personal")).toEqual([0, 1, 0, 0]);
    expect(await only("tasks")).toEqual([0, 0, 1, 0]);
    expect(await only("todos")).toEqual([0, 0, 0, 1]);
  });

  it("event-only filters leave out personal entries, tasks and to-dos", async () => {
    const repo = new FakeRepo([], [pe("p1", "2026-10-03T10:00:00.000Z")], [tk("t1", "2026-10-03T10:00:00.000Z")], [td("d1", "2026-10-03T10:00:00.000Z")]);
    const service = new CalendarService(repo);
    expect((await service.feed(ROHAN, { ...RANGE, eventType: "shoot" })).items).toEqual([]);
    expect((await service.feed(ROHAN, { ...RANGE, state: "active" })).items).toEqual([]);
    expect(counts(repo)).toEqual([2, 0, 0, 0]);
  });

  it("a client filter narrows events, personal entries and tasks, and leaves out to-dos", async () => {
    const repo = new FakeRepo();
    await new CalendarService(repo).feed(ROHAN, { ...RANGE, clientId: "c1" });
    expect(repo.eventCalls[0]?.f.clientId).toBe("c1");
    expect(repo.personalCalls[0]?.f.clientId).toBe("c1");
    expect(repo.taskCalls[0]?.f.clientId).toBe("c1");
    expect(repo.todoCalls).toHaveLength(0);
  });

  it("flags truncation when any kind exceeds the cap", async () => {
    const tasks = [tk("t1", "2026-10-01T10:00:00.000Z"), tk("t2", "2026-10-02T10:00:00.000Z"), tk("t3", "2026-10-03T10:00:00.000Z")];
    const repo = new FakeRepo([], [], tasks);
    const feed = await new CalendarService(repo, 2).feed(ADMIN, RANGE);
    expect(feed.items.filter((i) => i.kind === "task")).toHaveLength(2);
    expect(feed.truncated).toBe(true);
    expect(repo.taskCalls[0]?.limit).toBe(3);
    expect(repo.eventCalls[0]?.limit).toBe(3);
  });

  it("refuses a range over 92 days", async () => {
    await expect(new CalendarService(new FakeRepo()).feed(ADMIN, { ...RANGE, to: "2027-03-01T00:00:00Z" })).rejects.toMatchObject({
      code: "CALENDAR_RANGE_INVALID",
    });
  });
});
