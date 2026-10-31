import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import {
  bearerFor,
  closeDb,
  createFixtureUser,
  deleteClientsOwnedBy,
  deleteFixtureUser,
  deleteStaffTasksFor,
  type FixtureUser,
} from "./helpers";

/**
 * Global search (FR-SYS-01) against the real database: every group is scoped
 * exactly like its page, roles only get the groups they may see, and the
 * term is matched literally (wildcards escaped).
 */
const app = createApp();
let admin: FixtureUser;
let owner: FixtureUser;
let other: FixtureUser;
let editor: FixtureUser;
const auth = {} as Record<"admin" | "owner" | "other" | "editor", string>;
const TAG = `Zq${Date.now().toString(36)}`; // a word nothing else in the database contains

type Hit = { id: string; title: string; subtitle: string | null; url: string };
type Result = { query: string; groups: Record<string, Hit[] | null> };
const search = async (who: keyof typeof auth, q: string) => {
  const res = await request(app).get(`/api/v1/search?q=${encodeURIComponent(q)}`).set("Authorization", auth[who]);
  return res;
};
const titles = (r: request.Response, g: string) => ((r.body as Result).groups[g] ?? []).map((h) => h.title);

beforeAll(async () => {
  [admin, owner, other, editor] = await Promise.all([
    createFixtureUser("admin", "Search Admin"),
    createFixtureUser("social_media_manager", "Search Owner"),
    createFixtureUser("marketing_manager", "Search Other"),
    createFixtureUser("editor", "Search Editor"),
  ]);
  const [a, o, m, e] = await Promise.all([admin, owner, other, editor].map(bearerFor));
  Object.assign(auth, { admin: a!, owner: o!, other: m!, editor: e! });
  for (const [who, name] of [["owner", `${TAG} Bakery`], ["other", `${TAG} Garage`]] as const) {
    expect((await request(app).post("/api/v1/clients").set("Authorization", auth[who]).send({ businessName: name })).status).toBe(201);
  }
  const task = await request(app)
    .post("/api/v1/staff-tasks")
    .set("Authorization", auth.admin)
    .send({ title: `${TAG} 50% edit`, assigneeId: editor.id, rawFilesUrl: "https://drive.example.com/raw" });
  expect(task.status).toBe(201);
});

afterAll(async () => {
  await deleteStaffTasksFor([editor.id]);
  await deleteClientsOwnedBy([owner.id, other.id]);
  for (const u of [admin, owner, other, editor]) await deleteFixtureUser(u.id);
  await closeDb();
});

describe("GET /api/v1/search", () => {
  it("lets the Admin find every client", async () => {
    const res = await search("admin", TAG);
    expect(res.status).toBe(200);
    expect(titles(res, "clients").sort()).toEqual([`${TAG} Bakery`, `${TAG} Garage`]);
    expect((res.body as Result).groups.clients![0]!.url).toMatch(/^\/app\/clients\//);
  });

  it("never shows a manager another manager's client", async () => {
    expect(titles(await search("owner", TAG), "clients")).toEqual([`${TAG} Bakery`]);
    expect(titles(await search("other", TAG), "clients")).toEqual([`${TAG} Garage`]);
  });

  it("gives task-only staff their own tasks and no other groups", async () => {
    const res = await search("editor", TAG);
    expect(titles(res, "tasks")).toEqual([`${TAG} 50% edit`]);
    for (const g of ["clients", "events", "todos", "assets"]) expect((res.body as Result).groups[g], g).toBeNull();
    expect(titles(await search("owner", TAG), "tasks")).toEqual([]);
  });

  it("matches the words literally (a % is not a wildcard)", async () => {
    expect(titles(await search("admin", `${TAG} 50%`), "tasks")).toEqual([`${TAG} 50% edit`]);
    expect(titles(await search("admin", `${TAG} 5%`), "tasks")).toEqual([]);
  });

  it("refuses a too-short query and needs a session", async () => {
    expect((await search("admin", "a")).status).toBe(400);
    expect((await request(app).get(`/api/v1/search?q=${TAG}`)).status).toBe(401);
  });
});
