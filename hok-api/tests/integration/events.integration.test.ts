import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { events } from "../../src/modules/events/infrastructure/events.schema";
import {
  bearerFor,
  closeDb,
  createFixtureUser,
  deleteClientsOwnedBy,
  deleteFixtureUser,
  deleteStageTemplates,
  type FixtureUser,
} from "./helpers";

/**
 * Stage templates + events end to end (REQUIREMENTS §5.3): Admin-only
 * template writes, managers seeing active templates only, the stage copy
 * (a later template edit doesn't reach existing events), row scope (another
 * manager's event is 404), stage moves + history, cancel/postpone, the
 * optimistic lock, archived clients making events read-only, and the
 * calendar range query. Needs migration 20261013000004 applied.
 */
const app = createApp();
let admin: FixtureUser;
let smm: FixtureUser;
let mm: FixtureUser;
let editor: FixtureUser;
const auth: Record<string, string> = {};
const templateIds: string[] = [];
let templateId: string;
let smmClientId: string;

interface Body {
  [key: string]: unknown;
}
interface EventBody {
  id: string;
  version: number;
  currentStageId: string;
  state: string;
  stages: { id: string; position: number; name: string }[];
  history: { fromStageId: string | null; toStageId: string; note: string | null; visibleToClient: boolean; changedByName: string | null }[];
  [key: string]: unknown;
}

const as = (role: string, req: request.Test) => req.set("Authorization", auth[role]!);
const stamp = Date.now();

beforeAll(async () => {
  admin = await createFixtureUser("admin", "IT Events Admin");
  smm = await createFixtureUser("social_media_manager", "IT Events SMM");
  mm = await createFixtureUser("marketing_manager", "IT Events MM");
  editor = await createFixtureUser("editor", "IT Events Editor");
  for (const u of [admin, smm, mm, editor]) auth[u.role] = await bearerFor(u);

  const t = await as("admin", request(app).post("/api/v1/stage-templates")).send({
    name: `IT Photo Shoot ${stamp}`,
    stages: ["Planned", "Shoot", "Editing", "Completed"],
  });
  expect(t.status, JSON.stringify(t.body)).toBe(201);
  templateId = (t.body as { template: { id: string } }).template.id;
  templateIds.push(templateId);

  const c = await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Events Client ${stamp}`, timeZone: "Asia/Dubai" });
  smmClientId = (c.body as { client: { id: string } }).client.id;
});

afterAll(async () => {
  const owners = [admin, smm, mm, editor].filter(Boolean).map((u) => u.id);
  await deleteClientsOwnedBy(owners);
  await deleteStageTemplates(templateIds);
  for (const id of owners) await deleteFixtureUser(id);
  await closeDb();
});

async function createEvent(body: Body = {}): Promise<EventBody> {
  const res = await as("social_media_manager", request(app).post("/api/v1/events")).send({
    clientId: smmClientId,
    templateId,
    title: "IT Shoot",
    type: "shoot",
    startsAt: "2026-11-02T10:00:00+04:00",
    endsAt: "2026-11-02T14:00:00+04:00",
    ...body,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return (res.body as { event: EventBody }).event;
}

describe("stage templates", () => {
  it("only the Admin writes; names are unique ignoring case; duplicate stages are refused", async () => {
    expect((await as("social_media_manager", request(app).post("/api/v1/stage-templates")).send({ name: "X", stages: ["A"] })).status).toBe(403);
    const dup = await as("admin", request(app).post("/api/v1/stage-templates")).send({ name: `it photo shoot ${stamp}`, stages: ["A"] });
    expect([dup.status, (dup.body as { code: string }).code]).toEqual([409, "STAGE_TEMPLATE_NAME_TAKEN"]);
    const twice = await as("admin", request(app).post("/api/v1/stage-templates")).send({ name: `IT Twice ${stamp}`, stages: ["A", "a"] });
    expect((twice.body as { code: string }).code).toBe("STAGE_TEMPLATE_STAGES_INVALID");
  });

  it("managers see active templates only; task-only staff get 403", async () => {
    const t = await as("admin", request(app).post("/api/v1/stage-templates")).send({ name: `IT Inactive ${stamp}`, stages: ["A", "B"] });
    const inactive = (t.body as { template: { id: string } }).template.id;
    templateIds.push(inactive);
    await as("admin", request(app).patch(`/api/v1/stage-templates/${inactive}`)).send({ active: false, version: 1 });

    const list = await as("social_media_manager", request(app).get(`/api/v1/stage-templates?search=IT&limit=100`));
    const ids = (list.body as { templates: { id: string }[] }).templates.map((x) => x.id);
    expect(ids).toContain(templateId);
    expect(ids).not.toContain(inactive);
    expect((await as("social_media_manager", request(app).get(`/api/v1/stage-templates/${inactive}`))).status).toBe(404);
    expect((await as("admin", request(app).get(`/api/v1/stage-templates/${inactive}`))).status).toBe(200);
    expect((await as("editor", request(app).get("/api/v1/stage-templates"))).status).toBe(403);

    const fromInactive = await as("social_media_manager", request(app).post("/api/v1/events")).send({
      clientId: smmClientId,
      templateId: inactive,
      title: "x",
      type: "other",
      startsAt: "2026-11-01T10:00:00Z",
      endsAt: "2026-11-01T11:00:00Z",
    });
    expect((fromInactive.body as { code: string }).code).toBe("EVENT_TEMPLATE_INVALID");
  });
});

describe("events", () => {
  it("copies the template's stages, starts at the first, defaults to the client's zone, writes a first history entry", async () => {
    const e = await createEvent();
    expect(e.stages.map((s) => s.name)).toEqual(["Planned", "Shoot", "Editing", "Completed"]);
    expect(e.currentStageId).toBe(e.stages[0]!.id);
    expect(e).toMatchObject({ timeZone: "Asia/Dubai", state: "active", version: 1, startsAt: "2026-11-02T06:00:00.000Z", templateName: `IT Photo Shoot ${stamp}` });
    expect(e.history).toHaveLength(1);
    expect(e.history[0]).toMatchObject({ fromStageId: null, toStageId: e.stages[0]!.id, changedByName: "IT Events SMM" });
  });

  it("a later template edit does not change existing events (FR-EVT-03)", async () => {
    const e = await createEvent();
    const tpl = await as("admin", request(app).get(`/api/v1/stage-templates/${templateId}`));
    const version = (tpl.body as { template: { version: number } }).template.version;
    const edit = await as("admin", request(app).patch(`/api/v1/stage-templates/${templateId}`)).send({ stages: ["Brief", "Shoot", "Done"], version });
    expect(edit.status).toBe(200);
    const again = await as("social_media_manager", request(app).get(`/api/v1/events/${e.id}`));
    expect((again.body as { event: EventBody }).event.stages.map((s) => s.name)).toEqual(["Planned", "Shoot", "Editing", "Completed"]);
  });

  it("moves stages forward and back with history; refuses the same stage, a stale version and a cancelled event", async () => {
    const e = await createEvent();
    const [s1, , s3] = e.stages;
    const fwd = await as("social_media_manager", request(app).post(`/api/v1/events/${e.id}/stage`)).send({ stageId: s3!.id, note: "Editing, preview Friday", visibleToClient: true, version: 1 });
    expect(fwd.status, JSON.stringify(fwd.body)).toBe(200);
    const moved = (fwd.body as { event: EventBody }).event;
    expect(moved).toMatchObject({ currentStageId: s3!.id, version: 2 });
    expect(moved.history[0]).toMatchObject({ fromStageId: s1!.id, toStageId: s3!.id, note: "Editing, preview Friday", visibleToClient: true });

    const back = await as("social_media_manager", request(app).post(`/api/v1/events/${e.id}/stage`)).send({ stageId: s1!.id, version: 2 });
    expect((back.body as { event: EventBody }).event.currentStageId).toBe(s1!.id);

    const same = await as("social_media_manager", request(app).post(`/api/v1/events/${e.id}/stage`)).send({ stageId: s1!.id, version: 3 });
    expect((same.body as { code: string }).code).toBe("EVENT_STAGE_UNCHANGED");
    const stale = await as("social_media_manager", request(app).post(`/api/v1/events/${e.id}/stage`)).send({ stageId: s3!.id, version: 1 });
    expect((stale.body as { code: string }).code).toBe("EVENT_MODIFIED");

    const cancel = await as("social_media_manager", request(app).patch(`/api/v1/events/${e.id}`)).send({ state: "cancelled", version: 3 });
    expect((cancel.body as { event: EventBody }).event).toMatchObject({ state: "cancelled", version: 4 });
    const blocked = await as("social_media_manager", request(app).post(`/api/v1/events/${e.id}/stage`)).send({ stageId: s3!.id, version: 4 });
    expect((blocked.body as { code: string }).code).toBe("EVENT_NOT_ACTIVE");
  });

  it("another manager's event is 404 on read and write; task-only staff 403; the Admin sees it", async () => {
    const e = await createEvent();
    expect((await as("marketing_manager", request(app).get(`/api/v1/events/${e.id}`))).status).toBe(404);
    expect((await as("marketing_manager", request(app).patch(`/api/v1/events/${e.id}`)).send({ title: "x", version: 9 })).status).toBe(404);
    expect((await as("marketing_manager", request(app).post(`/api/v1/events/${e.id}/stage`)).send({ stageId: e.stages[1]!.id, version: 1 })).status).toBe(404);
    expect((await as("editor", request(app).get(`/api/v1/events/${e.id}`))).status).toBe(403);
    expect((await as("admin", request(app).get(`/api/v1/events/${e.id}`))).status).toBe(200);
    const mmCreate = await as("marketing_manager", request(app).post("/api/v1/events")).send({
      clientId: smmClientId,
      templateId,
      title: "x",
      type: "other",
      startsAt: "2026-11-01T10:00:00Z",
      endsAt: "2026-11-01T11:00:00Z",
    });
    expect((mmCreate.body as { code: string }).code).toBe("CLIENT_NOT_FOUND");
  });

  it("refuses bad times, an unknown team member and a zone-less wall time", async () => {
    const send = (b: Body) =>
      as("social_media_manager", request(app).post("/api/v1/events")).send({ clientId: smmClientId, templateId, title: "x", type: "meeting", startsAt: "2026-11-01T10:00:00Z", endsAt: "2026-11-01T11:00:00Z", ...b });
    expect(((await send({ endsAt: "2026-11-01T09:00:00Z" })).body as { code: string }).code).toBe("EVENT_TIMES_INVALID");
    expect(((await send({ endsAt: "2026-12-15T09:00:00Z" })).body as { code: string }).code).toBe("EVENT_TIMES_INVALID");
    expect(((await send({ assignedTeam: ["00000000-0000-4000-8000-000000000000"] })).body as { code: string }).code).toBe("EVENT_TEAM_INVALID");
    expect((await send({ startsAt: "2026-11-01T10:00:00" })).status).toBe(400);
    const withTeam = await send({ assignedTeam: [mm.id] });
    expect((withTeam.body as { event: { team: { fullName: string }[] } }).event.team).toEqual([{ id: mm.id, fullName: "IT Events MM" }]);
  });

  it("the calendar range returns overlapping events earliest first, scoped to the manager, with the current stage", async () => {
    const early = await createEvent({ title: "IT Range A", startsAt: "2027-03-01T22:00:00Z", endsAt: "2027-03-02T02:00:00Z" });
    await createEvent({ title: "IT Range B", startsAt: "2027-03-05T10:00:00Z", endsAt: "2027-03-05T11:00:00Z" });
    await createEvent({ title: "IT Range Outside", startsAt: "2027-04-10T10:00:00Z", endsAt: "2027-04-10T11:00:00Z" });

    const res = await as("social_media_manager", request(app).get("/api/v1/events?from=2027-03-02T00:00:00Z&to=2027-03-31T00:00:00Z&search=IT%20Range"));
    expect(res.status).toBe(200);
    const rows = (res.body as { events: Body[] }).events;
    expect(rows.map((r) => r.title)).toEqual(["IT Range A", "IT Range B"]);
    // (The template was edited by an earlier test, so compare with this event's own copy.)
    expect(rows[0]).toMatchObject({
      id: early.id,
      clientName: `IT Events Client ${stamp}`,
      currentStageName: early.stages[0]!.name,
      currentStagePosition: 1,
      stageCount: early.stages.length,
    });

    const mmView = await as("marketing_manager", request(app).get("/api/v1/events?from=2027-03-02T00:00:00Z&to=2027-03-31T00:00:00Z&search=IT%20Range"));
    expect((mmView.body as { total: number }).total).toBe(0);
    expect((await as("admin", request(app).get("/api/v1/events?from=2027-01-01T00:00:00Z&to=2027-06-01T00:00:00Z"))).status).toBe(400);
  });

  it("an archived client's events are read-only (409 CLIENT_ARCHIVED) until it's unarchived", async () => {
    const c = await as("social_media_manager", request(app).post("/api/v1/clients")).send({ businessName: `IT Archived Events ${stamp}` });
    const clientId = (c.body as { client: { id: string } }).client.id;
    const e = await createEvent({ clientId });
    await as("admin", request(app).post(`/api/v1/clients/${clientId}/archive`)).send({});
    const edit = await as("social_media_manager", request(app).patch(`/api/v1/events/${e.id}`)).send({ title: "x", version: 1 });
    expect([edit.status, (edit.body as { code: string }).code]).toEqual([409, "CLIENT_ARCHIVED"]);
    const move = await as("social_media_manager", request(app).post(`/api/v1/events/${e.id}/stage`)).send({ stageId: e.stages[1]!.id, version: 1 });
    expect((move.body as { code: string }).code).toBe("CLIENT_ARCHIVED");
    expect((await as("social_media_manager", request(app).get(`/api/v1/events/${e.id}`))).status).toBe(200);
  });

  it("the database refuses an event longer than 31 days and a current stage from another event", async () => {
    const a = await createEvent();
    const b = await createEvent();
    await expect(db.update(events).set({ endsAt: new Date("2027-01-01T00:00:00Z") }).where(eq(events.id, a.id))).rejects.toThrow();
    await expect(db.update(events).set({ currentStageId: b.stages[0]!.id }).where(eq(events.id, a.id))).rejects.toThrow();
  });
});
