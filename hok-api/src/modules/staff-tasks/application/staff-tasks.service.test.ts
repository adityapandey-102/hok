import { beforeEach, describe, expect, it } from "vitest";
import { StaffTasksService, type StaffTasksCaller } from "./staff-tasks.service";
import { AppError } from "../../../common/errors/app-error";
import type { AuditEvent } from "../../../common/audit/audit-logger";
import type { Role } from "../../../domain";
import type { StaffTaskDetail, StaffTaskEntity } from "../domain/staff-task.entity";
import type { AssigneeCandidate, TaskEventRef } from "../domain/staff-task.rules";
import type {
  NewStaffTaskRecord,
  StaffTaskChangeDecision,
  StaffTaskListFilters,
  StaffTasksRepositoryPort,
  StaffTaskUpdateEntry,
} from "./ports/staff-tasks-repository.port";
import type { StaffTaskNotifier } from "./ports/staff-task-notifier.port";
import type { StaffTaskQueryDto } from "../api/dto/staff-task.dto";

/** StaffTasksService against an in-memory fake: management by the Admin and creators, the visibility scope, the assignment ladder, editor brief, status flow, timeline. */

const ADMIN: StaffTasksCaller = { userId: "admin", role: "admin" };
const MEERA: StaffTasksCaller = { userId: "meera", role: "editor" };
const ARJUN: StaffTasksCaller = { userId: "arjun", role: "developer" };
const ROHAN: StaffTasksCaller = { userId: "rohan", role: "social_media_manager" };
/** A second manager, on client c2's team only. */
const PIA: StaffTasksCaller = { userId: "pia", role: "marketing_manager" };
const DRIVE = "https://drive.google.com/drive/folders/raw";

function task(o: Partial<StaffTaskEntity> = {}): StaffTaskEntity {
  return {
    id: "t1",
    title: "Edit the Diwali reel",
    description: null,
    assigneeId: "meera",
    assigneeName: "Meera",
    assigneeRole: "editor",
    assignedBy: "admin",
    assignedByName: "Aisha",
    clientId: null,
    clientName: null,
    teamIds: [],
    eventId: null,
    dueAt: null,
    priority: "medium",
    status: "todo",
    rawFilesUrl: DRIVE,
    referenceUrl: null,
    script: null,
    referenceLinks: [],
    completedAt: null,
    version: 1,
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
    ...o,
  };
}

class FakeRepo implements StaffTasksRepositoryPort {
  tasks = new Map<string, StaffTaskEntity>([
    ["t1", task()],
    ["t2", task({ id: "t2", title: "Fix the site", assigneeId: "arjun", assigneeName: "Arjun", assigneeRole: "developer", rawFilesUrl: null })],
  ]);
  people = new Map<string, AssigneeCandidate>(
    (
      [
        ["admin", "admin", true],
        ["meera", "editor", true],
        ["arjun", "developer", true],
        ["rohan", "social_media_manager", true],
        ["pia", "marketing_manager", true],
        ["gone", "editor", false],
      ] as [string, Role, boolean][]
    ).map(([id, role, active]) => [id, { id, role, active }]),
  );
  /** client id -> team (profile ids). */
  clients = new Map<string, string[]>([
    ["c1", ["rohan"]],
    ["c2", ["pia"]],
  ]);
  events = new Map<string, TaskEventRef>([["e1", { id: "e1", clientId: "c1", title: "Shoot", teamIds: ["rohan"] }]]);
  entries: (StaffTaskUpdateEntry & { taskId: string; from?: string; to?: string })[] = [];
  comments: { taskId: string; authorId: string; comment: string }[] = [];
  created: NewStaffTaskRecord[] = [];
  lastFilters: StaffTaskListFilters | null = null;

  findMany(filters: StaffTaskListFilters) {
    this.lastFilters = filters;
    return Promise.resolve([]);
  }
  countMany() {
    return Promise.resolve(0);
  }
  findById(id: string) {
    return Promise.resolve(this.tasks.get(id) ?? null);
  }
  findDetail(id: string): Promise<StaffTaskDetail | null> {
    const t = this.tasks.get(id);
    return Promise.resolve(t ? { ...t, eventTitle: null, updates: [] } : null);
  }
  findAssigneeCandidate(id: string) {
    return Promise.resolve(this.people.get(id) ?? null);
  }
  findClient(id: string) {
    const teamIds = this.clients.get(id);
    return Promise.resolve(teamIds ? { id, teamIds } : null);
  }
  findEvent(id: string) {
    return Promise.resolve(this.events.get(id) ?? null);
  }
  create(record: NewStaffTaskRecord) {
    this.created.push(record);
    const p = this.people.get(record.assigneeId)!;
    this.tasks.set("new", task({ ...record, id: "new", assigneeRole: p.role, assigneeName: p.id }));
    return Promise.resolve("new");
  }
  update(id: string, decide: StaffTaskChangeDecision) {
    const current = this.tasks.get(id);
    if (!current) return Promise.reject(new AppError(404, "nf", "STAFF_TASK_NOT_FOUND"));
    const c = decide(current);
    if (c.entry) this.entries.push({ ...c.entry, taskId: id, from: current.status, to: c.status });
    const assigneeRole = c.assigneeId ? this.people.get(c.assigneeId)!.role : current.assigneeRole;
    this.tasks.set(id, {
      ...current,
      ...c.fields,
      ...(c.assigneeId ? { assigneeId: c.assigneeId, assigneeRole } : {}),
      ...(c.status ? { status: c.status, completedAt: c.status === "done" ? "now" : null } : {}),
      version: current.version + 1,
    });
    return Promise.resolve();
  }
  addComment(id: string, guard: (t: StaffTaskEntity) => void, authorId: string, comment: string) {
    const current = this.tasks.get(id);
    if (!current) return Promise.reject(new AppError(404, "nf", "STAFF_TASK_NOT_FOUND"));
    guard(current);
    this.comments.push({ taskId: id, authorId, comment });
    return Promise.resolve();
  }
  delete(id: string, guard: (t: StaffTaskEntity) => void) {
    const current = this.tasks.get(id)!;
    guard(current);
    this.tasks.delete(id);
    return Promise.resolve(current);
  }
}

class RecordingNotifier implements StaffTaskNotifier {
  calls: string[] = [];
  taskAssigned(e: { assigneeId: string }) {
    this.calls.push(`assigned:${e.assigneeId}`);
    return Promise.resolve();
  }
  statusChanged(e: { from: string; to: string; actorId: string }) {
    this.calls.push(`status:${e.from}->${e.to} by ${e.actorId}`);
    return Promise.resolve();
  }
  commentAdded(e: { actorId: string }) {
    this.calls.push(`comment by ${e.actorId}`);
    return Promise.resolve();
  }
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return err.code;
  }
}

const query = (q: Partial<StaffTaskQueryDto> = {}): StaffTaskQueryDto => ({
  status: undefined,
  open: false,
  relation: undefined,
  priority: undefined,
  assigneeId: undefined,
  role: undefined,
  clientId: undefined,
  overdue: false,
  dueFrom: undefined,
  dueTo: undefined,
  search: undefined,
  limit: 20,
  offset: 0,
  ...q,
});

let repo: FakeRepo;
let audits: AuditEvent[];
let notifier: RecordingNotifier;
let service: StaffTasksService;
const NOW = new Date("2026-10-14T12:00:00Z");

beforeEach(() => {
  repo = new FakeRepo();
  audits = [];
  notifier = new RecordingNotifier();
  service = new StaffTasksService(repo, { record: (e) => (audits.push(e), Promise.resolve()) }, notifier, () => NOW);
});

describe("list (row scope)", () => {
  it("a task-only person's list is scoped to them (assignee or creator, no team); filters are theirs to use, ANDed with the scope", async () => {
    await service.list(MEERA, query({ assigneeId: "arjun", role: "developer", clientId: "c1", status: "todo" }));
    expect(repo.lastFilters).toMatchObject({
      scope: { kind: "own", userId: "meera", viaTeam: false },
      callerId: "meera",
      assigneeId: "arjun",
      role: "developer",
      clientId: "c1",
      status: "todo",
      now: NOW.toISOString(),
    });
  });

  it("a client manager's scope includes their teams", async () => {
    await service.list(ROHAN, query({ relation: "team" }));
    expect(repo.lastFilters).toMatchObject({ scope: { kind: "own", userId: "rohan", viaTeam: true }, relation: "team" });
  });

  it("the Admin's scope is everything, and the filters are free", async () => {
    await service.list(ADMIN, query({ assigneeId: "arjun", role: "developer", overdue: true, relation: "created" }));
    expect(repo.lastFilters).toMatchObject({ scope: { kind: "all" }, assigneeId: "arjun", role: "developer", overdue: true, relation: "created" });
  });

  it("the team filter is for client managers: a task-only role gets a 400", async () => {
    expect(await codeOf(service.list(MEERA, query({ relation: "team" })))).toBe("VALIDATION_ERROR");
    expect(await codeOf(service.list(MEERA, query({ relation: "assigned" })))).toBeNull();
  });
});

describe("get (visibility)", () => {
  it("the assignee and the Admin see a task; anyone else gets 404", async () => {
    expect((await service.get(MEERA, "t1")).id).toBe("t1");
    expect((await service.get(ADMIN, "t1")).id).toBe("t1");
    expect(await codeOf(service.get(ARJUN, "t1"))).toBe("STAFF_TASK_NOT_FOUND");
    expect(await codeOf(service.get(ROHAN, "t1"))).toBe("STAFF_TASK_NOT_FOUND");
  });

  it("the creator sees what they created; a client manager sees their clients' tasks, another team's are 404", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer" }));
    repo.tasks.set("t4", task({ id: "t4", assignedBy: "admin", assigneeId: "arjun", assigneeRole: "developer", clientId: "c1", teamIds: ["rohan"] }));
    expect((await service.get(ROHAN, "t3")).id).toBe("t3");
    expect((await service.get(ROHAN, "t4")).id).toBe("t4");
    expect(await codeOf(service.get(PIA, "t3"))).toBe("STAFF_TASK_NOT_FOUND");
    expect(await codeOf(service.get(PIA, "t4"))).toBe("STAFF_TASK_NOT_FOUND");
  });

  it("a person moved to a task-only role keeps no team visibility", async () => {
    repo.tasks.set("t4", task({ id: "t4", assigneeId: "arjun", assigneeRole: "developer", clientId: "c1", teamIds: ["rohan"] }));
    expect(await codeOf(service.get({ userId: "rohan", role: "editor" }, "t4"))).toBe("STAFF_TASK_NOT_FOUND");
  });

  it("canManage: the Admin and the creator", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer" }));
    expect((await service.get(ADMIN, "t3")).canManage).toBe(true);
    expect((await service.get(ROHAN, "t3")).canManage).toBe(true);
    expect((await service.get(ARJUN, "t3")).canManage).toBe(false);
    expect((await service.get(MEERA, "t1")).canManage).toBe(false);
  });
});

describe("create (Admin and client managers)", () => {
  it("creates an editor task with its brief, audits it, and fires the 'assigned' hook", async () => {
    await service.create(ADMIN, { title: "Cut the reel", assigneeId: "meera", rawFilesUrl: DRIVE, script: "Open on the product." });
    expect(repo.created[0]).toMatchObject({ assigneeId: "meera", assignedBy: "admin", rawFilesUrl: DRIVE, script: "Open on the product.", priority: "medium" });
    expect(audits.map((a) => a.action)).toEqual(["staff_task.created"]);
    expect(notifier.calls).toEqual(["assigned:meera"]);
  });

  it("an editor task needs no raw files link any more; others still can't carry the brief", async () => {
    await service.create(ADMIN, { title: "x", assigneeId: "meera" });
    expect(repo.created[0]).toMatchObject({ assigneeId: "meera", rawFilesUrl: null });
    expect(await codeOf(service.create(ADMIN, { title: "x", assigneeId: "arjun", script: "nope" }))).toBe("STAFF_TASK_EDITOR_FIELDS_INVALID");
  });

  it("refuses an inactive or unknown assignee and bad links", async () => {
    expect(await codeOf(service.create(ADMIN, { title: "x", assigneeId: "gone", rawFilesUrl: DRIVE }))).toBe("STAFF_TASK_ASSIGNEE_INVALID");
    expect(await codeOf(service.create(ADMIN, { title: "x", assigneeId: "nobody" }))).toBe("STAFF_TASK_ASSIGNEE_INVALID");
    expect(await codeOf(service.create(ADMIN, { title: "x", assigneeId: "arjun", clientId: "c9" }))).toBe("STAFF_TASK_CLIENT_INVALID");
    expect(await codeOf(service.create(ADMIN, { title: "x", assigneeId: "arjun", clientId: "c2", eventId: "e1" }))).toBe("STAFF_TASK_EVENT_INVALID");
  });

  it("an event alone links its client", async () => {
    await service.create(ADMIN, { title: "x", assigneeId: "arjun", eventId: "e1" });
    expect(repo.created[0]).toMatchObject({ clientId: "c1", eventId: "e1" });
  });

  it("task-only roles may not create, edit, reassign, reopen or delete (403 FORBIDDEN)", async () => {
    for (const caller of [MEERA, ARJUN]) {
      expect(await codeOf(service.create(caller, { title: "x", assigneeId: "arjun" }))).toBe("FORBIDDEN");
      expect(await codeOf(service.update(caller, "t1", { title: "x", version: 1 }))).toBe("FORBIDDEN");
      expect(await codeOf(service.reopen(caller, "t1", { status: "todo", version: 1 }))).toBe("FORBIDDEN");
      expect(await codeOf(service.delete(caller, "t1"))).toBe("FORBIDDEN");
    }
  });

  it("the ladder: Admin -> a manager is fine; Admin -> Admin and manager -> manager are 400 STAFF_TASK_ASSIGNEE_NOT_ALLOWED", async () => {
    await service.create(ADMIN, { title: "x", assigneeId: "rohan" });
    expect(repo.created[0]).toMatchObject({ assigneeId: "rohan" });
    expect(await codeOf(service.create(ADMIN, { title: "x", assigneeId: "admin" }))).toBe("STAFF_TASK_ASSIGNEE_NOT_ALLOWED");
    expect(await codeOf(service.create(ROHAN, { title: "x", assigneeId: "pia" }))).toBe("STAFF_TASK_ASSIGNEE_NOT_ALLOWED");
    expect(await codeOf(service.create(ROHAN, { title: "x", assigneeId: "rohan" }))).toBe("STAFF_TASK_ASSIGNEE_NOT_ALLOWED");
    expect(await codeOf(service.create(ROHAN, { title: "x", assigneeId: "admin" }))).toBe("STAFF_TASK_ASSIGNEE_NOT_ALLOWED");
  });

  it("a manager creates a task for a task-only person; they are the creator", async () => {
    await service.create(ROHAN, { title: "Cut the reel", assigneeId: "meera" });
    expect(repo.created[0]).toMatchObject({ assigneeId: "meera", assignedBy: "rohan" });
    expect(notifier.calls).toEqual(["assigned:meera"]);
  });

  it("a manager may link only their own clients and those clients' events; anything else is 400 STAFF_TASK_CLIENT_INVALID", async () => {
    await service.create(ROHAN, { title: "x", assigneeId: "arjun", clientId: "c1", eventId: "e1" });
    expect(repo.created[0]).toMatchObject({ clientId: "c1", eventId: "e1" });
    expect(await codeOf(service.create(ROHAN, { title: "x", assigneeId: "arjun", clientId: "c2" }))).toBe("STAFF_TASK_CLIENT_INVALID");
    expect(await codeOf(service.create(PIA, { title: "x", assigneeId: "arjun", eventId: "e1" }))).toBe("STAFF_TASK_CLIENT_INVALID");
    expect(await codeOf(service.create(ROHAN, { title: "x", assigneeId: "arjun", clientId: "c9" }))).toBe("STAFF_TASK_CLIENT_INVALID");
    // The Admin links any client.
    await service.create(ADMIN, { title: "x", assigneeId: "arjun", clientId: "c2" });
    expect(repo.created.at(-1)).toMatchObject({ clientId: "c2" });
  });
});

describe("update / reassign (Admin or the creator)", () => {
  it("needs at least one field, and the current version", async () => {
    expect(await codeOf(service.update(ADMIN, "t1", { version: 1 }))).toBe("VALIDATION_NO_FIELDS");
    expect(await codeOf(service.update(ADMIN, "t1", { title: "y", version: 9 }))).toBe("STAFF_TASK_MODIFIED");
    await service.update(ADMIN, "t1", { title: "New title", priority: "high", version: 1 });
    expect(repo.tasks.get("t1")).toMatchObject({ title: "New title", priority: "high", version: 2, rawFilesUrl: DRIVE });
    expect(audits[0]).toMatchObject({ action: "staff_task.updated", metadata: { fields: ["title", "priority"] } });
  });

  it("reassigning from an editor to a developer clears the brief, logs a timeline entry and fires 'assigned'", async () => {
    await service.update(ADMIN, "t1", { assigneeId: "arjun", version: 1 });
    expect(repo.tasks.get("t1")).toMatchObject({ assigneeId: "arjun", rawFilesUrl: null, script: null });
    expect(repo.entries).toEqual([expect.objectContaining({ kind: "reassigned", authorId: "admin" })]);
    expect(audits.map((a) => a.action)).toEqual(["staff_task.reassigned"]);
    expect(notifier.calls).toEqual(["assigned:arjun"]);
  });

  it("reassigning to an editor needs no raw files link; one may still be sent", async () => {
    await service.update(ADMIN, "t2", { assigneeId: "meera", version: 1 });
    expect(repo.tasks.get("t2")).toMatchObject({ assigneeId: "meera", rawFilesUrl: null });
    await service.update(ADMIN, "t2", { rawFilesUrl: DRIVE, version: 2 });
    expect(repo.tasks.get("t2")).toMatchObject({ rawFilesUrl: DRIVE });
  });

  it("the ladder judges a reassignment against the caller: an Admin can pick a manager, a manager cannot", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "meera", assigneeRole: "editor" }));
    expect(await codeOf(service.update(ROHAN, "t3", { assigneeId: "pia", version: 1 }))).toBe("STAFF_TASK_ASSIGNEE_NOT_ALLOWED");
    await service.update(ROHAN, "t3", { assigneeId: "arjun", version: 1 });
    expect(repo.tasks.get("t3")).toMatchObject({ assigneeId: "arjun" });
    await service.update(ADMIN, "t3", { assigneeId: "pia", version: 2 });
    expect(repo.tasks.get("t3")).toMatchObject({ assigneeId: "pia" });
  });

  it("keeping the same (higher-level) assignee while editing other fields is not blocked by the ladder", async () => {
    repo.tasks.set("t5", task({ id: "t5", assignedBy: "admin", assigneeId: "pia", assigneeRole: "marketing_manager", rawFilesUrl: null }));
    await service.update(ADMIN, "t5", { assigneeId: "pia", title: "Renamed", version: 1 });
    expect(repo.tasks.get("t5")).toMatchObject({ title: "Renamed" });
  });

  it("the creator manages their own task; a team manager who only sees it gets 403; an outsider 404; task-only staff 403 on the capability", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer", clientId: "c1", teamIds: ["rohan", "pia"], rawFilesUrl: null }));
    await service.update(ROHAN, "t3", { title: "Mine", version: 1 });
    expect(repo.tasks.get("t3")).toMatchObject({ title: "Mine" });
    expect(await codeOf(service.update(PIA, "t3", { title: "Hers", version: 2 }))).toBe("STAFF_TASK_FORBIDDEN");
    expect(await codeOf(service.reopen(PIA, "t3", { status: "todo", version: 2 }))).toBe("STAFF_TASK_FORBIDDEN");
    expect(await codeOf(service.delete(PIA, "t3"))).toBe("STAFF_TASK_FORBIDDEN");
    repo.tasks.set("t6", task({ id: "t6", assignedBy: "admin", assigneeId: "arjun", assigneeRole: "developer", rawFilesUrl: null }));
    expect(await codeOf(service.update(ROHAN, "t6", { title: "x", version: 1 }))).toBe("STAFF_TASK_NOT_FOUND");
    expect(await codeOf(service.delete(ROHAN, "t6"))).toBe("STAFF_TASK_NOT_FOUND");
    expect(await codeOf(service.update(ARJUN, "t3", { title: "x", version: 1 }))).toBe("FORBIDDEN");
  });

  it("a manager editing a task keeps to their own clients: relinking to another team's client is 400", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer", rawFilesUrl: null }));
    expect(await codeOf(service.update(ROHAN, "t3", { clientId: "c2", version: 1 }))).toBe("STAFF_TASK_CLIENT_INVALID");
    await service.update(ROHAN, "t3", { clientId: "c1", version: 1 });
    expect(repo.tasks.get("t3")).toMatchObject({ clientId: "c1" });
  });

  it("reassigning to the current assignee writes no timeline entry", async () => {
    await service.update(ADMIN, "t1", { assigneeId: "meera", version: 1 });
    expect(repo.entries).toEqual([]);
    expect(notifier.calls).toEqual([]);
  });

  it("changing the client unlinks an event of the old client", async () => {
    repo.tasks.set("t2", { ...repo.tasks.get("t2")!, clientId: "c1", eventId: "e1" });
    await service.update(ADMIN, "t2", { clientId: "c2", version: 1 });
    expect(repo.tasks.get("t2")).toMatchObject({ clientId: "c2", eventId: null });
  });
});

describe("status changes (assignee or Admin)", () => {
  it("the creator and team managers see the task but cannot move it: 403 STAFF_TASK_FORBIDDEN", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer", clientId: "c1", teamIds: ["rohan", "pia"], rawFilesUrl: null }));
    expect(await codeOf(service.changeStatus(ROHAN, "t3", { status: "done", version: 1 }))).toBe("STAFF_TASK_FORBIDDEN");
    expect(await codeOf(service.changeStatus(PIA, "t3", { status: "done", version: 1 }))).toBe("STAFF_TASK_FORBIDDEN");
    await service.changeStatus(ARJUN, "t3", { status: "done", version: 1 });
    expect(repo.tasks.get("t3")).toMatchObject({ status: "done" });
  });

  it("the assignee moves through the flow with comments; each move is a timeline entry", async () => {
    await service.changeStatus(MEERA, "t1", { status: "in_progress", comment: "Starting", version: 1 });
    await service.changeStatus(MEERA, "t1", { status: "blocked", comment: "Waiting for music", version: 2 });
    await service.changeStatus(MEERA, "t1", { status: "done", version: 3 });
    expect(repo.entries.map((e) => [e.kind, e.from, e.to, e.comment])).toEqual([
      ["status", "todo", "in_progress", "Starting"],
      ["status", "in_progress", "blocked", "Waiting for music"],
      ["status", "blocked", "done", null],
    ]);
    expect(repo.tasks.get("t1")).toMatchObject({ status: "done", completedAt: "now" });
    expect(notifier.calls).toEqual(["status:todo->in_progress by meera", "status:in_progress->blocked by meera", "status:blocked->done by meera"]);
  });

  it("someone else's task is 404 even with a stale version; a stale version on your own is 409", async () => {
    expect(await codeOf(service.changeStatus(ARJUN, "t1", { status: "done", version: 99 }))).toBe("STAFF_TASK_NOT_FOUND");
    expect(await codeOf(service.changeStatus(MEERA, "t1", { status: "done", version: 99 }))).toBe("STAFF_TASK_MODIFIED");
  });

  it("a done task can't be moved -- only reopened by the Admin", async () => {
    repo.tasks.set("t1", task({ status: "done", completedAt: "x" }));
    expect(await codeOf(service.changeStatus(MEERA, "t1", { status: "todo", version: 1 }))).toBe("STAFF_TASK_DONE");
    expect(await codeOf(service.changeStatus(ADMIN, "t1", { status: "todo", version: 1 }))).toBe("STAFF_TASK_DONE");
    await service.reopen(ADMIN, "t1", { status: "in_progress", comment: "One more cut", version: 1 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "in_progress", completedAt: null });
    expect(repo.entries.at(-1)).toMatchObject({ kind: "reopened", comment: "One more cut" });
    expect(await codeOf(service.reopen(ADMIN, "t1", { status: "todo", version: 2 }))).toBe("STAFF_TASK_NOT_DONE");
  });
});

describe("comments", () => {
  it("the creator comments; a team manager who only sees the task gets 403", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer", clientId: "c1", teamIds: ["rohan", "pia"], rawFilesUrl: null }));
    await service.comment(ROHAN, "t3", { body: "Please prioritise" });
    expect(repo.comments.map((c) => c.authorId)).toEqual(["rohan"]);
    expect(await codeOf(service.comment(PIA, "t3", { body: "hi" }))).toBe("STAFF_TASK_FORBIDDEN");
    expect(await codeOf(service.comment({ userId: "x", role: "social_media_manager" }, "t3", { body: "hi" }))).toBe("STAFF_TASK_NOT_FOUND");
  });

  it("the assignee and the Admin comment; anyone else gets 404", async () => {
    await service.comment(MEERA, "t1", { body: "First cut uploaded" });
    await service.comment(ADMIN, "t1", { body: "Looks good" });
    expect(repo.comments.map((c) => c.authorId)).toEqual(["meera", "admin"]);
    expect(await codeOf(service.comment(ARJUN, "t1", { body: "hi" }))).toBe("STAFF_TASK_NOT_FOUND");
    expect(notifier.calls).toEqual(["comment by meera", "comment by admin"]);
  });
});

describe("delete (Admin or the creator)", () => {
  it("removes the task and audits it", async () => {
    await service.delete(ADMIN, "t2");
    expect(repo.tasks.has("t2")).toBe(false);
    expect(audits[0]).toMatchObject({ action: "staff_task.deleted", entityId: "t2", metadata: { assigneeId: "arjun", status: "todo" } });
  });
});
