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

/** StaffTasksService against an in-memory fake: Admin-only management, assignee row scope, editor brief, status flow, timeline. */

const ADMIN: StaffTasksCaller = { userId: "admin", role: "admin" };
const MEERA: StaffTasksCaller = { userId: "meera", role: "editor" };
const ARJUN: StaffTasksCaller = { userId: "arjun", role: "developer" };
const ROHAN: StaffTasksCaller = { userId: "rohan", role: "social_media_manager" };
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
        ["gone", "editor", false],
      ] as [string, Role, boolean][]
    ).map(([id, role, active]) => [id, { id, role, active }]),
  );
  clients = new Set(["c1", "c2"]);
  events = new Map<string, TaskEventRef>([["e1", { id: "e1", clientId: "c1", title: "Shoot" }]]);
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
    return Promise.resolve(this.clients.has(id) ? { id } : null);
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
  it("an assignee's list is pinned to their own tasks; Admin-only filters are ignored", async () => {
    await service.list(MEERA, query({ assigneeId: "arjun", role: "developer", clientId: "c1", status: "todo" }));
    expect(repo.lastFilters).toMatchObject({ assigneeId: "meera", role: undefined, clientId: undefined, status: "todo", now: NOW.toISOString() });
  });

  it("the Admin filters freely", async () => {
    await service.list(ADMIN, query({ assigneeId: "arjun", role: "developer", overdue: true }));
    expect(repo.lastFilters).toMatchObject({ assigneeId: "arjun", role: "developer", overdue: true });
  });
});

describe("get", () => {
  it("the assignee and the Admin see a task; anyone else gets 404", async () => {
    expect((await service.get(MEERA, "t1")).id).toBe("t1");
    expect((await service.get(ADMIN, "t1")).id).toBe("t1");
    expect(await codeOf(service.get(ARJUN, "t1"))).toBe("STAFF_TASK_NOT_FOUND");
    expect(await codeOf(service.get(ROHAN, "t1"))).toBe("STAFF_TASK_NOT_FOUND");
  });
});

describe("create (Admin only)", () => {
  it("creates an editor task with its brief, audits it, and fires the 'assigned' hook", async () => {
    await service.create(ADMIN, { title: "Cut the reel", assigneeId: "meera", rawFilesUrl: DRIVE, script: "Open on the product." });
    expect(repo.created[0]).toMatchObject({ assigneeId: "meera", assignedBy: "admin", rawFilesUrl: DRIVE, script: "Open on the product.", priority: "medium" });
    expect(audits.map((a) => a.action)).toEqual(["staff_task.created"]);
    expect(notifier.calls).toEqual(["assigned:meera"]);
  });

  it("an editor task needs the raw files link; others can't carry the brief", async () => {
    expect(await codeOf(service.create(ADMIN, { title: "x", assigneeId: "meera" }))).toBe("STAFF_TASK_EDITOR_FIELDS_REQUIRED");
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

  it("nobody else may create, edit, reassign, reopen or delete (403)", async () => {
    for (const caller of [MEERA, ARJUN, ROHAN]) {
      expect(await codeOf(service.create(caller, { title: "x", assigneeId: "arjun" }))).toBe("FORBIDDEN");
      expect(await codeOf(service.update(caller, "t1", { title: "x", version: 1 }))).toBe("FORBIDDEN");
      expect(await codeOf(service.reopen(caller, "t1", { status: "todo", version: 1 }))).toBe("FORBIDDEN");
      expect(await codeOf(service.delete(caller, "t1"))).toBe("FORBIDDEN");
    }
  });
});

describe("update / reassign (Admin)", () => {
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

  it("reassigning to an editor needs the raw files link", async () => {
    expect(await codeOf(service.update(ADMIN, "t2", { assigneeId: "meera", version: 1 }))).toBe("STAFF_TASK_EDITOR_FIELDS_REQUIRED");
    await service.update(ADMIN, "t2", { assigneeId: "meera", rawFilesUrl: DRIVE, version: 1 });
    expect(repo.tasks.get("t2")).toMatchObject({ assigneeId: "meera", rawFilesUrl: DRIVE });
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
  it("the assignee and the Admin comment; anyone else gets 404", async () => {
    await service.comment(MEERA, "t1", { body: "First cut uploaded" });
    await service.comment(ADMIN, "t1", { body: "Looks good" });
    expect(repo.comments.map((c) => c.authorId)).toEqual(["meera", "admin"]);
    expect(await codeOf(service.comment(ARJUN, "t1", { body: "hi" }))).toBe("STAFF_TASK_NOT_FOUND");
    expect(notifier.calls).toEqual(["comment by meera", "comment by admin"]);
  });
});

describe("delete (Admin)", () => {
  it("removes the task and audits it", async () => {
    await service.delete(ADMIN, "t2");
    expect(repo.tasks.has("t2")).toBe(false);
    expect(audits[0]).toMatchObject({ action: "staff_task.deleted", entityId: "t2", metadata: { assigneeId: "arjun", status: "todo" } });
  });
});
