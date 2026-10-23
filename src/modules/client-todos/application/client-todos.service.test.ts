import { beforeEach, describe, expect, it } from "vitest";
import { ClientTodosService, type ClientTodosCaller } from "./client-todos.service";
import { AppError } from "../../../common/errors/app-error";
import { AUDIT_ACTIONS } from "../../../common/audit/audit-actions";
import type { AuditEvent, AuditLogger } from "../../../common/audit/audit-logger";
import type { ClientTodoEntity } from "../domain/client-todo.entity";
import type { TodoClient, TodoEvent } from "../domain/client-todo.rules";
import type { ClientTodoChangeDecision, ClientTodoListFilters, ClientTodosRepositoryPort, NewClientTodoRecord } from "./ports/client-todos-repository.port";

/** Unit coverage against an in-memory fake: scope, guarded writes, completion, audit. SQL is covered by the integration suite. */

const ADMIN: ClientTodosCaller = { userId: "admin", role: "admin" };
const ROHAN: ClientTodosCaller = { userId: "rohan", role: "social_media_manager" };
const SARA: ClientTodosCaller = { userId: "sara", role: "marketing_manager" };
const EDITOR: ClientTodosCaller = { userId: "meera", role: "editor" };

function todo(o: Partial<ClientTodoEntity> = {}): ClientTodoEntity {
  return {
    id: "t1",
    clientId: "c1",
    teamIds: ["rohan"],
    clientStatus: "active",
    eventId: null,
    eventTitle: null,
    title: "Get the product list",
    description: null,
    dueAt: null,
    priority: "medium",
    status: "todo",
    completedAt: null,
    createdBy: "rohan",
    createdByName: "Rohan",
    version: 1,
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
    ...o,
  };
}

class FakeRepo implements ClientTodosRepositoryPort {
  rows = new Map<string, ClientTodoEntity>();
  clients = new Map<string, TodoClient>([
    ["c1", { id: "c1", teamIds: ["rohan"], status: "active" }],
    ["c9", { id: "c9", teamIds: ["rohan"], status: "archived" }],
  ]);
  eventsById = new Map<string, TodoEvent>([
    ["e1", { id: "e1", clientId: "c1" }],
    ["e2", { id: "e2", clientId: "other" }],
  ]);
  lastFilters: ClientTodoListFilters | null = null;
  findMany(f: ClientTodoListFilters) {
    this.lastFilters = f;
    return Promise.resolve([...this.rows.values()]);
  }
  countMany() {
    return Promise.resolve(this.rows.size);
  }
  findById(id: string) {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  findClient(id: string) {
    return Promise.resolve(this.clients.get(id) ?? null);
  }
  findEvent(id: string) {
    return Promise.resolve(this.eventsById.get(id) ?? null);
  }
  create(r: NewClientTodoRecord, guard: (c: TodoClient) => void) {
    guard(this.clients.get(r.clientId)!);
    const row = todo({ ...r, id: `t${this.rows.size + 1}`, teamIds: this.clients.get(r.clientId)!.teamIds });
    this.rows.set(row.id, row);
    return Promise.resolve(row.id);
  }
  update(id: string, decide: ClientTodoChangeDecision) {
    const cur = this.rows.get(id);
    if (!cur) return Promise.reject(new AppError(404, "To-do not found", "CLIENT_TODO_NOT_FOUND"));
    const ch = decide(cur);
    if (ch.deleted) {
      this.rows.delete(id);
      return Promise.resolve(cur);
    }
    const completedAt = ch.completion === "stamp" ? "2026-10-17T10:00:00.000Z" : ch.completion === "clear" ? null : cur.completedAt;
    const next = { ...cur, ...ch.fields, completedAt, version: cur.version + 1 };
    this.rows.set(id, next);
    return Promise.resolve(next);
  }
}

class FakeAudit implements AuditLogger {
  events: AuditEvent[] = [];
  record(e: AuditEvent) {
    this.events.push(e);
    return Promise.resolve();
  }
}

const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return e instanceof AppError ? e.statusCode : 500;
  }
};

describe("ClientTodosService", () => {
  let repo: FakeRepo;
  let audit: FakeAudit;
  let svc: ClientTodosService;
  beforeEach(() => {
    repo = new FakeRepo();
    audit = new FakeAudit();
    svc = new ClientTodosService(repo, audit, () => new Date("2026-10-17T12:00:00Z"));
    repo.rows.set("t1", todo());
  });
  const query = { limit: 20, offset: 0, overdue: false };

  it("the default list is the open list; an explicit status is exact; overdue uses the service clock", async () => {
    await svc.list(ROHAN, "c1", query);
    expect(repo.lastFilters).toMatchObject({ clientId: "c1", openOnly: true, status: undefined, now: "2026-10-17T12:00:00.000Z" });
    await svc.list(ROHAN, "c1", { ...query, status: "done", overdue: true });
    expect(repo.lastFilters).toMatchObject({ openOnly: false, status: "done", overdue: true });
    await svc.list(ROHAN, "c1", { ...query, status: "all" });
    expect(repo.lastFilters).toMatchObject({ openOnly: false, status: undefined });
  });

  it("refuses a reversed due range", async () => {
    expect(await status(svc.list(ADMIN, "c1", { ...query, dueFrom: "2026-10-15T00:00:00Z", dueTo: "2026-10-14T00:00:00Z" }))).toBe(400);
  });

  it("another manager's client is a 404 (list and create); the owner and admin can read; task-only staff get 403", async () => {
    expect(await status(svc.list(SARA, "c1", query))).toBe(404);
    expect(await status(svc.list(ROHAN, "c1", query))).toBe(200);
    expect(await status(svc.list(ADMIN, "c1", query))).toBe(200);
    expect(await status(svc.list(EDITOR, "c1", query))).toBe(403);
    expect(await status(svc.list(ADMIN, "nope", query))).toBe(404);
    expect(await status(svc.create(SARA, "c1", { title: "x" }))).toBe(404);
  });

  it("creates under an own client with defaults, audits without the text, and refuses archived clients and foreign events", async () => {
    const t = await svc.create(ROHAN, "c1", { title: "Book studio", eventId: "e1" });
    expect(t.priority).toBe("medium");
    expect(t.status).toBe("todo");
    expect(audit.events[0]).toMatchObject({ action: AUDIT_ACTIONS.CLIENT_TODO_CREATED, metadata: { clientId: "c1" } });
    expect(JSON.stringify(audit.events)).not.toContain("Book studio");
    expect(await status(svc.create(ROHAN, "c9", { title: "x" }))).toBe(409);
    expect(await status(svc.create(ROHAN, "c1", { title: "x", eventId: "e2" }))).toBe(400);
    expect(await status(svc.create(ROHAN, "c1", { title: "x", eventId: "missing" }))).toBe(400);
  });

  it("marking done stamps completed_at, reopening clears it, and the lock/scope rules apply", async () => {
    const done = await svc.update(ROHAN, "t1", { status: "done", version: 1 });
    expect(done.status).toBe("done");
    expect(done.completedAt).not.toBeNull();
    expect(await status(svc.update(ROHAN, "t1", { title: "x", version: 1 }))).toBe(409);
    const reopened = await svc.update(ROHAN, "t1", { status: "todo", version: 2 });
    expect(reopened.completedAt).toBeNull();
    // Visibility before version.
    expect(await status(svc.update(SARA, "t1", { title: "x", version: 99 }))).toBe(404);
    expect(await status(svc.update(EDITOR, "t1", { title: "x", version: 3 }))).toBe(403);
    expect(await status(svc.update(ADMIN, "t1", { title: "x", version: 3 }))).toBe(200);
    expect(audit.events.at(-1)).toMatchObject({ action: AUDIT_ACTIONS.CLIENT_TODO_UPDATED, metadata: { fields: ["title"] } });
  });

  it("an empty patch is a 400; an archived client's to-do is read-only", async () => {
    expect(await status(svc.update(ROHAN, "t1", { version: 1 }))).toBe(400);
    repo.rows.set("t9", todo({ id: "t9", clientId: "c9", clientStatus: "archived" }));
    expect(await status(svc.update(ROHAN, "t9", { title: "x", version: 1 }))).toBe(409);
    expect(await status(svc.remove(ROHAN, "t9", {}))).toBe(409);
  });

  it("deletes with an optional version and audits the trace", async () => {
    expect(await status(svc.remove(ROHAN, "t1", { version: 5 }))).toBe(409);
    expect(await status(svc.remove(SARA, "t1", {}))).toBe(404);
    expect(await status(svc.remove(ROHAN, "t1", { version: 1 }))).toBe(200);
    expect(audit.events.at(-1)).toMatchObject({ action: AUDIT_ACTIONS.CLIENT_TODO_DELETED, entityId: "t1" });
    expect(await status(svc.remove(ROHAN, "t1", {}))).toBe(404);
  });
});
