import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { bearerFor, closeDb, createFixtureUser, deleteClientsOwnedBy, deleteFixtureUser, deleteStageTemplates, type FixtureUser } from "./helpers";

/**
 * Asset links end to end (REQUIREMENTS section 5.5): URL validation, tags
 * (reusable per client, case-insensitive, replaced on edit), search/filters
 * (title, comment, tag, type, tag filter, date range, event), row scope
 * (another manager's asset is 404), the optimistic lock, soft delete, the
 * event-must-be-the-same-client rule, and archived clients making assets
 * read-only. Needs migration 20261014100001 applied.
 */
const app = createApp();
let admin: FixtureUser;
let smm: FixtureUser;
let mm: FixtureUser;
let editor: FixtureUser;
const auth: Record<string, string> = {};
let clientId: string;
let otherClientId: string;
let templateId: string;
const stamp = Date.now();

const as = (role: string, req: request.Test) => req.set("Authorization", auth[role]!);

interface AssetBody {
  id: string;
  version: number;
  tags: string[];
  title: string;
  type: string;
  createdByName: string;
  eventId: string | null;
  eventTitle: string | null;
  [key: string]: unknown;
}

beforeAll(async () => {
  admin = await createFixtureUser("admin", "IT Assets Admin");
  smm = await createFixtureUser("social_media_manager", "IT Assets SMM");
  mm = await createFixtureUser("marketing_manager", "IT Assets MM");
  editor = await createFixtureUser("editor", "IT Assets Editor");
  for (const u of [admin, smm, mm, editor]) auth[u.role] = await bearerFor(u);
  const c = await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Assets Client ${stamp}` });
  clientId = (c.body as { client: { id: string } }).client.id;
  const o = await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Assets Other ${stamp}` });
  otherClientId = (o.body as { client: { id: string } }).client.id;
  const t = await as("admin", request(app).post("/api/v1/stage-templates")).send({ name: `IT Assets Tpl ${stamp}`, stages: ["A", "B"] });
  templateId = (t.body as { template: { id: string } }).template.id;
});

afterAll(async () => {
  const owners = [admin, smm, mm, editor].filter(Boolean).map((u) => u.id);
  await deleteClientsOwnedBy(owners);
  if (templateId) await deleteStageTemplates([templateId]);
  for (const id of owners) await deleteFixtureUser(id);
  await closeDb();
});

async function create(body: Record<string, unknown> = {}, role = "social_media_manager"): Promise<AssetBody> {
  const res = await as(role, request(app).post("/api/v1/assets")).send({
    clientId,
    title: `IT asset ${stamp}`,
    url: "https://drive.google.com/drive/folders/it",
    type: "video",
    ...body,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return (res.body as { asset: AssetBody }).asset;
}

describe("assets (integration)", () => {
  it("creates a link with tags, a comment and the creator's name", async () => {
    const a = await create({ comment: "Raw clips", tags: ["Reels", "reels", " Festive "] });
    expect(a.tags).toEqual(["Festive", "Reels"]);
    expect(a.version).toBe(1);
    expect(a.createdByName).toBe("IT Assets SMM");
  });

  it("rejects non-http(s) URLs, bad types and too many tags with 400", async () => {
    for (const url of ["javascript:alert(1)", "data:text/html,x", "ftp://a/b", "notaurl"]) {
      const res = await as("social_media_manager", request(app).post("/api/v1/assets")).send({ clientId, title: "x", url, type: "other" });
      expect(res.status, url).toBe(400);
    }
    const bad = await as("social_media_manager", request(app).post("/api/v1/assets")).send({ clientId, title: "x", url: "https://a.test", type: "gif" });
    expect(bad.status).toBe(400);
    const many = await as("social_media_manager", request(app).post("/api/v1/assets")).send({
      clientId, title: "x", url: "https://a.test", type: "other", tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
    });
    expect(many.status).toBe(400);
  });

  it("reuses a client's tag case-insensitively and suggests tags with counts", async () => {
    await create({ title: "Second", tags: ["REELS"] });
    const s = await as("social_media_manager", request(app).get(`/api/v1/assets/tags?clientId=${clientId}&q=ree`));
    expect(s.status).toBe(200);
    const tags = (s.body as { tags: { name: string; uses: number }[] }).tags;
    expect(tags).toHaveLength(1);
    expect(tags[0]!.name).toBe("Reels");
    expect(tags[0]!.uses).toBeGreaterThanOrEqual(2);
  });

  it("searches title, comment and tag; filters by type, tag, date and client", async () => {
    await create({ title: `Unique-${stamp}`, comment: `findme-${stamp}`, type: "design", tags: [`tag-${stamp}`] });
    const q = async (qs: string) => (await as("social_media_manager", request(app).get(`/api/v1/assets?clientId=${clientId}&${qs}`))).body as { assets: AssetBody[]; total: number };
    expect((await q(`search=Unique-${stamp}`)).total).toBe(1);
    expect((await q(`search=findme-${stamp}`)).total).toBe(1);
    expect((await q(`search=TAG-${stamp}`)).total).toBe(1);
    expect((await q(`tag=TAG-${stamp}`)).total).toBe(1);
    expect((await q(`type=design`)).assets.every((a) => a.type === "design")).toBe(true);
    expect((await q(`from=2099-01-01T00:00:00Z`)).total).toBe(0);
    expect((await q(`to=2000-01-01T00:00:00Z`)).total).toBe(0);
    expect((await q(`search=50%25_zz`)).total).toBe(0); // wildcards are escaped
    const bad = await as("social_media_manager", request(app).get("/api/v1/assets?from=2026-10-15T00:00:00Z&to=2026-10-14T00:00:00Z"));
    expect(bad.status).toBe(400);
    expect((bad.body as { code: string }).code).toBe("ASSET_RANGE_INVALID");
    const unknownType = await as("social_media_manager", request(app).get("/api/v1/assets?type=gif"));
    expect(unknownType.status).toBe(400);
  });

  it("paginates with a total and caps the page size", async () => {
    const res = await as("social_media_manager", request(app).get(`/api/v1/assets?clientId=${clientId}&limit=1&offset=1`));
    const body = res.body as { assets: unknown[]; total: number; limit: number; offset: number };
    expect(body.assets).toHaveLength(1);
    expect(body.total).toBeGreaterThan(1);
    const capped = await as("social_media_manager", request(app).get("/api/v1/assets?limit=100000"));
    expect((capped.body as { limit: number }).limit).toBe(100);
  });

  it("links an event of the same client only", async () => {
    const ev = await as("social_media_manager", request(app).post("/api/v1/events")).send({
      clientId, templateId, title: `IT Asset Event ${stamp}`, type: "shoot", startsAt: "2031-01-01T10:00:00Z", endsAt: "2031-01-01T11:00:00Z",
    });
    expect(ev.status, JSON.stringify(ev.body)).toBe(201);
    const eventId = (ev.body as { event: { id: string } }).event.id;
    const a = await create({ eventId });
    expect(a.eventId).toBe(eventId);
    expect(a.eventTitle).toBe(`IT Asset Event ${stamp}`);
    const byEvent = await as("social_media_manager", request(app).get(`/api/v1/assets?eventId=${eventId}`));
    expect((byEvent.body as { total: number }).total).toBe(1);
    // The same event on another client's asset is refused.
    const wrong = await as("social_media_manager", request(app).post("/api/v1/assets")).send({
      clientId: otherClientId, title: "x", url: "https://a.test", type: "other", eventId,
    });
    expect(wrong.status).toBe(400);
    expect((wrong.body as { code: string }).code).toBe("ASSET_EVENT_INVALID");
    // Unlink on edit.
    const un = await as("social_media_manager", request(app).patch(`/api/v1/assets/${a.id}`)).send({ eventId: null, version: a.version });
    expect(un.status).toBe(200);
    expect((un.body as { asset: AssetBody }).asset.eventId).toBeNull();
  });

  it("row scope: another manager's asset is 404, task-only staff 403, admin sees all", async () => {
    const a = await create();
    expect((await as("marketing_manager", request(app).get(`/api/v1/assets/${a.id}`))).status).toBe(404);
    expect((await as("marketing_manager", request(app).patch(`/api/v1/assets/${a.id}`)).send({ title: "x", version: 1 })).status).toBe(404);
    expect((await as("marketing_manager", request(app).delete(`/api/v1/assets/${a.id}`))).status).toBe(404);
    expect((await as("marketing_manager", request(app).post("/api/v1/assets")).send({ clientId, title: "x", url: "https://a.test", type: "other" })).status).toBe(404);
    const mmList = await as("marketing_manager", request(app).get("/api/v1/assets?limit=100"));
    expect((mmList.body as { assets: AssetBody[] }).assets.some((x) => x.id === a.id)).toBe(false);
    expect((await as("editor", request(app).get("/api/v1/assets"))).status).toBe(403);
    expect((await as("admin", request(app).get(`/api/v1/assets/${a.id}`))).status).toBe(200);
    expect((await request(app).get("/api/v1/assets")).status).toBe(401);
    expect((await as("admin", request(app).get("/api/v1/assets/not-a-uuid"))).status).toBe(404);
  });

  it("edits with the optimistic lock and replaces tags", async () => {
    const a = await create({ tags: ["one", "two"] });
    const ok = await as("social_media_manager", request(app).patch(`/api/v1/assets/${a.id}`)).send({ title: "Renamed", tags: ["Two", "three"], version: a.version });
    expect(ok.status).toBe(200);
    const edited = (ok.body as { asset: AssetBody }).asset;
    expect(edited.version).toBe(a.version + 1);
    expect(edited.tags).toEqual(["three", "two"]); // "Two" reuses the existing "two" tag
    const stale = await as("social_media_manager", request(app).patch(`/api/v1/assets/${a.id}`)).send({ title: "Again", version: a.version });
    expect(stale.status).toBe(409);
    expect((stale.body as { code: string }).code).toBe("ASSET_MODIFIED");
    const none = await as("social_media_manager", request(app).patch(`/api/v1/assets/${a.id}`)).send({ version: edited.version });
    expect(none.status).toBe(400);
  });

  it("soft delete hides the asset from get and lists, and a second delete is 404", async () => {
    const a = await create({ title: `Gone-${stamp}` });
    const stale = await as("social_media_manager", request(app).delete(`/api/v1/assets/${a.id}?version=99`));
    expect(stale.status).toBe(409);
    expect((await as("social_media_manager", request(app).delete(`/api/v1/assets/${a.id}?version=${a.version}`))).status).toBe(204);
    expect((await as("social_media_manager", request(app).get(`/api/v1/assets/${a.id}`))).status).toBe(404);
    const list = await as("social_media_manager", request(app).get(`/api/v1/assets?search=Gone-${stamp}`));
    expect((list.body as { total: number }).total).toBe(0);
    expect((await as("social_media_manager", request(app).delete(`/api/v1/assets/${a.id}`))).status).toBe(404);
  });

  it("an archived client's assets are read-only but still readable; unarchiving restores writes", async () => {
    const c = await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Assets Archive ${stamp}` });
    const cid = (c.body as { client: { id: string } }).client.id;
    const a = await create({ clientId: cid });
    const arch = await as("admin", request(app).post(`/api/v1/clients/${cid}/archive`)).send({});
    expect(arch.status).toBe(200);
    expect((await as("social_media_manager", request(app).get(`/api/v1/assets/${a.id}`))).status).toBe(200);
    const edit = await as("social_media_manager", request(app).patch(`/api/v1/assets/${a.id}`)).send({ title: "x", version: a.version });
    expect(edit.status).toBe(409);
    expect((edit.body as { code: string }).code).toBe("CLIENT_ARCHIVED");
    expect((await as("social_media_manager", request(app).delete(`/api/v1/assets/${a.id}`))).status).toBe(409);
    const add = await as("social_media_manager", request(app).post("/api/v1/assets")).send({ clientId: cid, title: "x", url: "https://a.test", type: "other" });
    expect(add.status).toBe(409);
    await as("admin", request(app).post(`/api/v1/clients/${cid}/unarchive`)).send({});
    expect((await as("social_media_manager", request(app).patch(`/api/v1/assets/${a.id}`)).send({ title: "ok", version: a.version })).status).toBe(200);
  });
});
