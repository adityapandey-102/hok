import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { TodosService } from "./todos.service";
import { todoQueryDtoSchema } from "../api/dto/todo.dto";
import type { TodoEntity } from "../domain/todo.entity";
import type { NewTodoRecord, TodoChanges, TodoFilters, TodosRepositoryPort } from "./ports/todos-repository.port";

/** TodosService against an in-memory fake: owner pinning, the reminder recompute, the version lock. */

const NOW = new Date("2026-11-10T09:00:00Z");
const HOUR = 60 * 60 * 1000;
const ME = { userId: "me" };

function todo(o: Partial<TodoEntity> = {}): TodoEntity {
  return {
    id: "d1",
    title: "Call the printer",
    notes: null,
    dueAt: null,
    urgency: "medium",
    doneAt: null,
    nextRemindAt: null,
    version: 1,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...o,
  };
}

class FakeRepo implements TodosRepositoryPort {
  rows = new Map<string, { ownerId: string; todo: TodoEntity }>([["d1", { ownerId: "me", todo: todo() }]]);
  lastFilters: TodoFilters | null = null;
  created: NewTodoRecord[] = [];

  findMany(filters: TodoFilters) {
    this.lastFilters = filters;
    return Promise.resolve([]);
  }
  countMany() {
    return Promise.resolve(0);
  }
  create(record: NewTodoRecord) {
    this.created.push(record);
    const t = todo({ id: "new", title: record.title, notes: record.notes, dueAt: record.dueAt, urgency: record.urgency, nextRemindAt: record.nextRemindAt });
    this.rows.set("new", { ownerId: record.ownerId, todo: t });
    return Promise.resolve(t);
  }
  update(ownerId: string, id: string, decide: (current: TodoEntity) => TodoChanges) {
    const row = this.rows.get(id);
    if (!row || row.ownerId !== ownerId) return Promise.reject(new AppError(404, "nf", "TODO_NOT_FOUND"));
    const c = decide(row.todo);
    row.todo = { ...row.todo, ...c, version: row.todo.version + 1 };
    return Promise.resolve(row.todo);
  }
  delete(ownerId: string, id: string) {
    const row = this.rows.get(id);
    if (!row || row.ownerId !== ownerId) return Promise.reject(new AppError(404, "nf", "TODO_NOT_FOUND"));
    this.rows.delete(id);
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

let repo: FakeRepo;
let service: TodosService;
const inHours = (h: number) => new Date(NOW.getTime() + h * HOUR).toISOString();

beforeEach(() => {
  repo = new FakeRepo();
  service = new TodosService(repo, () => NOW);
});

describe("list", () => {
  it("is pinned to the caller and defaults to the open to-dos", async () => {
    await service.list(ME, todoQueryDtoSchema.parse({}));
    expect(repo.lastFilters).toEqual({ ownerId: "me", status: "open", dueFrom: undefined, dueTo: undefined });
  });
});

describe("create", () => {
  it("owns it by the caller, defaults the urgency to medium and sets the first reminder (at the due time)", async () => {
    await service.create(ME, { title: "Send invoice", dueAt: inHours(48) });
    expect(repo.created[0]).toMatchObject({ ownerId: "me", urgency: "medium", notes: null, nextRemindAt: inHours(48) });
  });

  it("urgent: the first reminder is 1 day before; no due date means none; low means none", async () => {
    await service.create(ME, { title: "a", dueAt: inHours(72), urgency: "urgent" });
    expect(repo.created[0]?.nextRemindAt).toBe(inHours(48));
    await service.create(ME, { title: "b", urgency: "urgent" });
    expect(repo.created[1]?.nextRemindAt).toBeNull();
    await service.create(ME, { title: "c", dueAt: inHours(72), urgency: "low" });
    expect(repo.created[2]?.nextRemindAt).toBeNull();
  });
});

describe("update", () => {
  it("needs at least one field besides the version", async () => {
    expect(await codeOf(service.update(ME, "d1", { version: 1 }))).toBe("VALIDATION_NO_FIELDS");
  });

  it("a stale version is 409 TODO_MODIFIED", async () => {
    expect(await codeOf(service.update(ME, "d1", { title: "x", version: 5 }))).toBe("TODO_MODIFIED");
  });

  it("another person's to-do (or a missing one) is 404 TODO_NOT_FOUND", async () => {
    expect(await codeOf(service.update({ userId: "someone-else" }, "d1", { title: "x", version: 1 }))).toBe("TODO_NOT_FOUND");
    expect(await codeOf(service.update(ME, "nope", { title: "x", version: 1 }))).toBe("TODO_NOT_FOUND");
    expect(await codeOf(service.delete({ userId: "someone-else" }, "d1"))).toBe("TODO_NOT_FOUND");
  });

  it("changing the due time or urgency recomputes the reminder from now", async () => {
    const updated = await service.update(ME, "d1", { dueAt: inHours(5), urgency: "high", version: 1 });
    expect(updated.nextRemindAt).toBe(inHours(4)); // 1 hour before
  });

  it("a title-only edit leaves the reminder alone", async () => {
    repo.rows.get("d1")!.todo = todo({ dueAt: inHours(5), nextRemindAt: inHours(5) });
    const updated = await service.update(ME, "d1", { title: "Renamed", version: 1 });
    expect(updated.nextRemindAt).toBe(inHours(5));
  });

  it("done clears the reminder; undone recomputes it", async () => {
    repo.rows.get("d1")!.todo = todo({ dueAt: inHours(5), urgency: "high", nextRemindAt: inHours(4) });
    const done = await service.update(ME, "d1", { done: true, version: 1 });
    expect(done).toMatchObject({ doneAt: NOW.toISOString(), nextRemindAt: null });
    const undone = await service.update(ME, "d1", { done: false, version: 2 });
    expect(undone).toMatchObject({ doneAt: null, nextRemindAt: inHours(4) });
  });

  it("done: true on an already done to-do changes nothing about the done stamp", async () => {
    repo.rows.get("d1")!.todo = todo({ doneAt: "2026-11-09T00:00:00.000Z" });
    const again = await service.update(ME, "d1", { done: true, title: "x", version: 1 });
    expect(again.doneAt).toBe("2026-11-09T00:00:00.000Z");
  });
});

describe("delete", () => {
  it("removes the caller's own to-do", async () => {
    await service.delete(ME, "d1");
    expect(repo.rows.has("d1")).toBe(false);
  });
});
