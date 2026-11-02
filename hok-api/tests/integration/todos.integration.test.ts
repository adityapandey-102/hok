import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { todos } from "../../src/modules/todos/infrastructure/todos.schema";
import { bearerFor, closeDb, createFixtureUser, deleteFixtureUser, type FixtureUser } from "./helpers";

/**
 * My to-dos end to end (round 1): private per person, the Admin included.
 * Every route is owner-only (another person's id is a 404), the version is an
 * optimistic lock (409), validation is strict, and the reminder moment
 * (next_remind_at) follows the due time, urgency and done state. Needs
 * migration 20261102000001_todos.sql applied.
 */
const app = createApp();
let admin: FixtureUser;
let editor: FixtureUser;
let smm: FixtureUser;
const auth: Record<string, string> = {};
const as = (role: string, req: request.Test) => req.set("Authorization", auth[role]!);
const codeOf = (res: request.Response) => (res.body as { code?: string }).code;
const HOUR = 3_600_000;

interface Todo {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  urgency: string;
  done: boolean;
  doneAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

async function create(role: string, body: Record<string, unknown> = {}): Promise<Todo> {
  const res = await as(role, request(app).post("/api/v1/todos")).send({ title: "IT todo", ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return (res.body as { todo: Todo }).todo;
}
async function nextRemind(id: string): Promise<number | null> {
  const [row] = await db.select({ at: todos.nextRemindAt }).from(todos).where(eq(todos.id, id));
  return row!.at ? row!.at.getTime() : null;
}

beforeAll(async () => {
  admin = await createFixtureUser("admin", "IT Todos Admin");
  editor = await createFixtureUser("editor", "IT Todos Editor");
  smm = await createFixtureUser("social_media_manager", "IT Todos SMM");
  for (const u of [admin, editor, smm]) auth[u.role] = await bearerFor(u);
});

afterAll(async () => {
  for (const u of [admin, editor, smm].filter(Boolean)) await deleteFixtureUser(u.id); // their to-dos cascade
  await closeDb();
});

describe("every role has its own list", () => {
  it("creates with defaults (medium, open, version 1) and returns the wire shape without internals", async () => {
    for (const role of ["admin", "social_media_manager", "editor"]) {
      const todo = await create(role, { title: `  IT ${role}  `, notes: "n" });
      expect(todo).toMatchObject({ title: `IT ${role}`, notes: "n", dueAt: null, urgency: "medium", done: false, doneAt: null, version: 1 });
      expect(Object.keys(todo).sort()).toEqual(["createdAt", "doneAt", "done", "dueAt", "id", "notes", "title", "updatedAt", "urgency", "version"].sort());
    }
  });

  it("validates strictly: empty or long title, bad urgency, bad date, unknown keys", async () => {
    const bad = async (body: Record<string, unknown>) => (await as("editor", request(app).post("/api/v1/todos")).send(body)).status;
    expect(await bad({ title: "   " })).toBe(400);
    expect(await bad({ title: "x".repeat(201) })).toBe(400);
    expect(await bad({ title: "ok", notes: "n".repeat(2001) })).toBe(400);
    expect(await bad({ title: "ok", urgency: "asap" })).toBe(400);
    expect(await bad({ title: "ok", dueAt: "tomorrow" })).toBe(400);
    expect(await bad({ title: "ok", ownerId: admin.id })).toBe(400);
  });
});

describe("private to the owner, the Admin included", () => {
  it("another person's to-do is 404 TODO_NOT_FOUND on patch and delete, for everyone; the list never shows it", async () => {
    const mine = await create("editor", { title: "IT private" });
    for (const role of ["admin", "social_media_manager"]) {
      const patch = await as(role, request(app).patch(`/api/v1/todos/${mine.id}`)).send({ title: "x", version: 1 });
      expect([patch.status, codeOf(patch)], role).toEqual([404, "TODO_NOT_FOUND"]);
      const del = await as(role, request(app).delete(`/api/v1/todos/${mine.id}`));
      expect([del.status, codeOf(del)], role).toEqual([404, "TODO_NOT_FOUND"]);
      const list = await as(role, request(app).get("/api/v1/todos?status=all&limit=100"));
      expect((list.body as { todos: Todo[] }).todos.map((t) => t.id)).not.toContain(mine.id);
    }
    // Untouched.
    const own = await as("editor", request(app).get("/api/v1/todos?status=all&limit=100"));
    expect((own.body as { todos: Todo[] }).todos.find((t) => t.id === mine.id)).toMatchObject({ title: "IT private", version: 1 });
  });

  it("a malformed id is a 404 too", async () => {
    const res = await as("editor", request(app).patch("/api/v1/todos/abc")).send({ title: "x", version: 1 });
    expect([res.status, codeOf(res)]).toEqual([404, "TODO_NOT_FOUND"]);
  });

  it("needs a login", async () => {
    expect((await request(app).get("/api/v1/todos")).status).toBe(401);
  });
});

describe("edit, tick, delete", () => {
  it("patches with the version (stale = 409 TODO_MODIFIED), needs a field, and ticks done and undone", async () => {
    const todo = await create("editor", { title: "IT edit", dueAt: new Date(Date.now() + 3 * HOUR).toISOString(), urgency: "high" });
    const ok = await as("editor", request(app).patch(`/api/v1/todos/${todo.id}`)).send({ title: "IT edited", notes: "more", version: 1 });
    expect((ok.body as { todo: Todo }).todo).toMatchObject({ title: "IT edited", notes: "more", version: 2 });
    const stale = await as("editor", request(app).patch(`/api/v1/todos/${todo.id}`)).send({ title: "again", version: 1 });
    expect([stale.status, codeOf(stale)]).toEqual([409, "TODO_MODIFIED"]);
    const empty = await as("editor", request(app).patch(`/api/v1/todos/${todo.id}`)).send({ version: 2 });
    expect([empty.status, codeOf(empty)]).toEqual([400, "VALIDATION_NO_FIELDS"]);

    const done = await as("editor", request(app).patch(`/api/v1/todos/${todo.id}`)).send({ done: true, version: 2 });
    const doneTodo = (done.body as { todo: Todo }).todo;
    expect(doneTodo).toMatchObject({ done: true, version: 3 });
    expect(doneTodo.doneAt).not.toBeNull();
    const undone = await as("editor", request(app).patch(`/api/v1/todos/${todo.id}`)).send({ done: false, version: 3 });
    expect((undone.body as { todo: Todo }).todo).toMatchObject({ done: false, doneAt: null, version: 4 });

    // Clearing the notes and the due date.
    const cleared = await as("editor", request(app).patch(`/api/v1/todos/${todo.id}`)).send({ notes: null, dueAt: null, version: 4 });
    expect((cleared.body as { todo: Todo }).todo).toMatchObject({ notes: null, dueAt: null });
  });

  it("deletes (204) and then it is gone (404)", async () => {
    const todo = await create("social_media_manager", { title: "IT delete" });
    expect((await as("social_media_manager", request(app).delete(`/api/v1/todos/${todo.id}`))).status).toBe(204);
    expect((await as("social_media_manager", request(app).delete(`/api/v1/todos/${todo.id}`))).status).toBe(404);
  });
});

describe("the reminder moment follows the due time, urgency and done state", () => {
  it("urgent: 1 day before; high: 1 hour before; medium: at due; low and no due date: none", async () => {
    const due = Date.now() + 3 * 24 * HOUR;
    const dueAt = new Date(due).toISOString();
    const urgent = await create("editor", { dueAt, urgency: "urgent" });
    const high = await create("editor", { dueAt, urgency: "high" });
    const medium = await create("editor", { dueAt });
    const low = await create("editor", { dueAt, urgency: "low" });
    const none = await create("editor", { urgency: "urgent" });
    expect(await nextRemind(urgent.id)).toBe(due - 24 * HOUR);
    expect(await nextRemind(high.id)).toBe(due - HOUR);
    expect(await nextRemind(medium.id)).toBe(due);
    expect(await nextRemind(low.id)).toBeNull();
    expect(await nextRemind(none.id)).toBeNull();

    // Changing the urgency recomputes it; done clears it; undone brings it back; a past due time leaves none.
    await as("editor", request(app).patch(`/api/v1/todos/${urgent.id}`)).send({ urgency: "medium", version: 1 });
    expect(await nextRemind(urgent.id)).toBe(due);
    await as("editor", request(app).patch(`/api/v1/todos/${urgent.id}`)).send({ done: true, version: 2 });
    expect(await nextRemind(urgent.id)).toBeNull();
    await as("editor", request(app).patch(`/api/v1/todos/${urgent.id}`)).send({ done: false, version: 3 });
    expect(await nextRemind(urgent.id)).toBe(due);
    await as("editor", request(app).patch(`/api/v1/todos/${urgent.id}`)).send({ dueAt: new Date(Date.now() - HOUR).toISOString(), version: 4 });
    expect(await nextRemind(urgent.id)).toBeNull();
    // A title-only change leaves the moment alone.
    await as("editor", request(app).patch(`/api/v1/todos/${high.id}`)).send({ title: "renamed", version: 1 });
    expect(await nextRemind(high.id)).toBe(due - HOUR);
  });
});

describe("GET /todos", () => {
  it("filters open / done / all, orders open by due (nulls last) and done by done_at, pages with a total", async () => {
    const stamp = Date.now();
    const soon = await create("social_media_manager", { title: `IT list soon ${stamp}`, dueAt: new Date(stamp + HOUR).toISOString() });
    const later = await create("social_media_manager", { title: `IT list later ${stamp}`, dueAt: new Date(stamp + 5 * HOUR).toISOString() });
    const undated = await create("social_media_manager", { title: `IT list undated ${stamp}` });
    const finished = await create("social_media_manager", { title: `IT list finished ${stamp}` });
    await as("social_media_manager", request(app).patch(`/api/v1/todos/${finished.id}`)).send({ done: true, version: 1 });

    const list = async (q: string) =>
      (await as("social_media_manager", request(app).get(`/api/v1/todos?${q}`))).body as { todos: Todo[]; total: number; limit: number; offset: number };
    const open = await list("limit=100");
    const mine = (r: { todos: Todo[] }) => r.todos.filter((t) => t.title.endsWith(String(stamp))).map((t) => t.id);
    expect(mine(open)).toEqual([soon.id, later.id, undated.id]);
    expect(mine(await list("status=done&limit=100"))).toEqual([finished.id]);
    expect(mine(await list("status=all&limit=100"))).toEqual([soon.id, later.id, undated.id, finished.id]);

    const range = await list(`dueFrom=${encodeURIComponent(new Date(stamp + 2 * HOUR).toISOString())}&dueTo=${encodeURIComponent(new Date(stamp + 6 * HOUR).toISOString())}&limit=100`);
    expect(mine(range)).toEqual([later.id]);

    const page = await list("limit=1&offset=1");
    expect(page).toMatchObject({ limit: 1, offset: 1 });
    expect(page.todos).toHaveLength(1);
    expect(page.total).toBeGreaterThanOrEqual(3);
  });

  it("parses strictly: a bad status or non-numeric limit is 400; an over-large limit is clamped to 100", async () => {
    expect((await as("editor", request(app).get("/api/v1/todos?status=nope"))).status).toBe(400);
    expect((await as("editor", request(app).get("/api/v1/todos?limit=abc"))).status).toBe(400);
    expect(((await as("editor", request(app).get("/api/v1/todos?limit=999"))).body as { limit: number }).limit).toBe(100);
  });
});
