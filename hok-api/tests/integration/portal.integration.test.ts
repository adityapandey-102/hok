import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { bearerFor, closeDb, createFixtureUser, deleteClientsOwnedBy, deleteFixtureUser, deleteStageTemplates, type FixtureUser } from "./helpers";

/**
 * M8 against the real local stack: the staff side of portal links, the public
 * portal (the token is the only credential), client comments end to end
 * (portal post → manager inbox → status/reply → back on the portal), row
 * scope, the lifecycle, and archive revoking the link for good.
 */
const app = createApp();
let owner: FixtureUser;
let other: FixtureUser;
let editor: FixtureUser;
let ownerAuth: string;
let adminAuth: string;
let admin: FixtureUser;
let otherAuth: string;
let editorAuth: string;
let clientId: string;
let token: string;

type Json = Record<string, unknown>;
const body = (res: request.Response) => res.body as Json;

beforeAll(async () => {
  owner = await createFixtureUser("social_media_manager", "Portal Owner");
  other = await createFixtureUser("marketing_manager", "Other Manager");
  editor = await createFixtureUser("editor", "Portal Editor");
  admin = await createFixtureUser("admin", "Portal Admin");
  [ownerAuth, otherAuth, editorAuth, adminAuth] = await Promise.all([bearerFor(owner), bearerFor(other), bearerFor(editor), bearerFor(admin)]);
  const res = await request(app).post("/api/v1/clients").set("Authorization", ownerAuth).send({ businessName: "Portal Test Bakery" });
  expect(res.status).toBe(201);
  clientId = (body(res).client as Json).id as string;
});

afterAll(async () => {
  await deleteClientsOwnedBy([owner.id, other.id]); // portal_links + comments cascade with the client
  for (const u of [owner, other, editor, admin]) await deleteFixtureUser(u.id);
  await closeDb();
});

describe("portal links (staff)", () => {
  it("has no link at first; another manager gets 404 and task-only staff 403", async () => {
    const mine = await request(app).get(`/api/v1/portal-links/${clientId}`).set("Authorization", ownerAuth);
    expect(mine.status).toBe(200);
    expect(body(mine).link).toBeNull();
    expect((await request(app).get(`/api/v1/portal-links/${clientId}`).set("Authorization", otherAuth)).status).toBe(404);
    expect((await request(app).get(`/api/v1/portal-links/${clientId}`).set("Authorization", editorAuth)).status).toBe(403);
  });

  it("generates a link; the token is stored (plain, for copying) beside its hash, and the lookup goes by the hash", async () => {
    const res = await request(app).post(`/api/v1/portal-links/${clientId}`).set("Authorization", ownerAuth);
    expect(res.status).toBe(201);
    token = body(res).token as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body(res).url).toMatch(new RegExp(`/p/${token}$`));
    // The hash column never holds the raw token; the plain-text column does (decision 2026-11-18).
    const stored = await db.execute(sql`select count(*)::int as n from portal_links where token_hash = ${token}`);
    expect((stored.rows[0] as { n: number }).n).toBe(0);
    const plain = await db.execute(sql`select token from portal_links where client_id = ${clientId} and active`);
    expect(plain.rows).toEqual([{ token }]);
  });

  it("GET returns the active link's url at any time (no-store), and the hash never", async () => {
    const again = await request(app).get(`/api/v1/portal-links/${clientId}`).set("Authorization", ownerAuth);
    expect(again.status).toBe(200);
    expect(again.headers["cache-control"]).toContain("no-store");
    const link = body(again).link as Json;
    expect(link.url).toMatch(new RegExp(`/p/${token}$`));
    expect(link).not.toHaveProperty("token");
    expect(link).not.toHaveProperty("tokenHash");
    const hashRow = await db.execute(sql`select token_hash from portal_links where client_id = ${clientId} and active`);
    expect(JSON.stringify(link)).not.toContain((hashRow.rows[0] as { token_hash: string }).token_hash);
    // Same RBAC as before: another manager 404, task-only staff 403.
    expect((await request(app).get(`/api/v1/portal-links/${clientId}`).set("Authorization", otherAuth)).status).toBe(404);
    expect((await request(app).get(`/api/v1/portal-links/${clientId}`).set("Authorization", editorAuth)).status).toBe(403);
  });

  it("a link made before this round (no stored token) has url null", async () => {
    await db.execute(sql`update portal_links set token = null where client_id = ${clientId} and active`);
    const res = await request(app).get(`/api/v1/portal-links/${clientId}`).set("Authorization", ownerAuth);
    expect((body(res).link as Json).url).toBeNull();
    expect((body(res).link as Json).active).toBe(true);
    // ...and it still works for the client (the lookup is by hash).
    expect((await request(app).get(`/api/v1/portal/${token}`)).status).toBe(200);
    await db.execute(sql`update portal_links set token = ${token} where client_id = ${clientId} and active`);
  });
});

describe("public portal", () => {
  it("opens the dashboard with client-safe fields only", async () => {
    const res = await request(app).get(`/api/v1/portal/${token}`);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("no-store");
    const d = body(res);
    expect((d.client as Json).businessName).toBe("Portal Test Bakery");
    expect(d.manager).toEqual({ firstName: "Portal" });
    expect(JSON.stringify(d)).not.toContain(owner.email);
    // The token and the url never come back from a public route.
    expect(JSON.stringify(d)).not.toContain(token);
    expect(JSON.stringify(d)).not.toContain("/p/");
    expect(d.attention).toEqual({ approvals: [], files: [] });
  });

  it("answers every bad link with the same 404", async () => {
    for (const t of ["x", "A".repeat(43), `${token.slice(0, -1)}Z`]) {
      const res = await request(app).get(`/api/v1/portal/${t}`);
      expect(res.status).toBe(404);
      expect(body(res).code).toBe("PORTAL_LINK_INVALID");
    }
  });

  it("refuses unknown keys and empty comments", async () => {
    expect((await request(app).post(`/api/v1/portal/${token}/comments`).send({ body: "hi", status: "solved" })).status).toBe(400);
    expect((await request(app).post(`/api/v1/portal/${token}/comments`).send({ body: "   " })).status).toBe(400);
  });
});

describe("client comments end to end", () => {
  let commentId: string;
  let version: number;

  it("a client posts a comment; the owner (only) is notified", async () => {
    const res = await request(app).post(`/api/v1/portal/${token}/comments`).send({ body: "Please change the background music" });
    expect(res.status).toBe(201);
    const c = body(res).comment as Json;
    expect(c.status).toBe("received");
    expect(c).not.toHaveProperty("version");
    commentId = c.id as string;
    const n = await db.execute(sql`select user_id from notifications where type = 'client_comment' and payload::text like ${"%" + commentId + "%"}`);
    expect(n.rows.map((r) => (r as { user_id: string }).user_id)).toEqual([owner.id]);
  });

  it("shows in the owner's inbox and counts, never in another manager's", async () => {
    const inbox = await request(app).get(`/api/v1/client-comments?clientId=${clientId}`).set("Authorization", ownerAuth);
    expect(inbox.status).toBe(200);
    const row = (body(inbox).comments as Json[]).find((c) => c.id === commentId)!;
    version = row.version as number;
    expect((await request(app).get("/api/v1/client-comments/counts").set("Authorization", ownerAuth)).body).toMatchObject({ received: 1 });
    expect((await request(app).get(`/api/v1/client-comments/${commentId}`).set("Authorization", otherAuth)).status).toBe(404);
    const theirs = await request(app).get("/api/v1/client-comments").set("Authorization", otherAuth);
    expect((body(theirs).comments as Json[]).some((c) => c.id === commentId)).toBe(false);
    expect((await request(app).get("/api/v1/client-comments").set("Authorization", editorAuth)).status).toBe(403);
  });

  it("searches the inbox by comment text or client name, with LIKE wildcards escaped", async () => {
    const ids = async (search: string) => {
      const res = await request(app).get(`/api/v1/client-comments?search=${encodeURIComponent(search)}`).set("Authorization", ownerAuth);
      expect(res.status).toBe(200);
      return (body(res).comments as Json[]).map((c) => c.id);
    };
    expect(await ids("BACKGROUND music")).toContain(commentId);
    expect(await ids("test bakery")).toContain(commentId);
    expect(await ids("no such words")).not.toContain(commentId);
    expect(await ids("%")).not.toContain(commentId);
    expect((await request(app).get(`/api/v1/client-comments?search=${"x".repeat(101)}`).set("Authorization", ownerAuth)).status).toBe(400);
  });

  it("works through the lifecycle with history, version and transition checks", async () => {
    const stale = await request(app).patch(`/api/v1/client-comments/${commentId}`).set("Authorization", ownerAuth).send({ status: "in_progress", version: version + 5 });
    expect(body(stale).code).toBe("COMMENT_MODIFIED");

    const progress = await request(app).patch(`/api/v1/client-comments/${commentId}`).set("Authorization", ownerAuth).send({ status: "in_progress", version });
    expect(progress.status).toBe(200);
    version = (body(progress).comment as Json).version as number;

    const back = await request(app).patch(`/api/v1/client-comments/${commentId}`).set("Authorization", ownerAuth).send({ status: "received", version });
    expect(body(back).code).toBe("COMMENT_STATUS_TRANSITION_INVALID");

    const solved = await request(app).patch(`/api/v1/client-comments/${commentId}`).set("Authorization", ownerAuth).send({ status: "solved", reply: "Updated, have a listen!", version });
    expect(solved.status).toBe(200);
    expect(body(solved).comment).toMatchObject({ status: "solved", reply: "Updated, have a listen!", repliedByName: "Portal Owner" });

    const hist = await db.execute(sql`select from_status, to_status from client_comment_history where comment_id = ${commentId} order by created_at`);
    expect(hist.rows).toEqual([
      { from_status: "received", to_status: "in_progress" },
      { from_status: "in_progress", to_status: "solved" },
    ]);
  });

  it("shows the status and reply back on the portal, without staff names", async () => {
    const res = await request(app).get(`/api/v1/portal/${token}/comments`);
    const c = (body(res).comments as Json[]).find((x) => x.id === commentId)!;
    expect(c).toMatchObject({ status: "solved", reply: "Updated, have a listen!" });
    expect(JSON.stringify(body(res))).not.toContain("Portal Owner");
  });

  it("refuses a comment about another client's event", async () => {
    const res = await request(app).post(`/api/v1/portal/${token}/comments`).send({ body: "x", eventId: "00000000-0000-4000-8000-000000000000" });
    expect(res.status).toBe(400);
  });
});

describe("shared assets on the portal event page (round 2)", () => {
  let templateId: string;
  let eventId: string;
  let otherClientId: string;
  let otherEventId: string;
  let visibleId: string;
  const created: string[] = [];

  const makeAsset = async (auth: string, over: Json) => {
    const r = await request(app).post("/api/v1/assets").set("Authorization", auth).send({ title: "x", url: "https://example.test/a", type: "photo", ...over });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return (body(r).asset as Json).id as string;
  };
  const eventOf = async (t: string, id: string) => {
    const r = await request(app).get(`/api/v1/portal/${t}/events/${id}`);
    expect(r.status).toBe(200);
    return body(r).event as Json & { assets: Json[] };
  };

  it("lists only assets marked visible on THIS event of THIS client, newest first, with client-safe fields", async () => {
    const t = await request(app).post("/api/v1/stage-templates").set("Authorization", adminAuth).send({ name: `IT Portal Tpl ${Date.now()}`, stages: ["Plan", "Shoot"] });
    templateId = ((body(t).template as Json).id as string);
    created.push(templateId);
    const mkEvent = async (auth: string, cid: string, title: string) => {
      const e = await request(app).post("/api/v1/events").set("Authorization", auth).send({ clientId: cid, templateId, title, type: "shoot", startsAt: "2031-03-01T10:00:00Z", endsAt: "2031-03-01T12:00:00Z" });
      expect(e.status, JSON.stringify(e.body)).toBe(201);
      return body(e).event as Json & { id: string; stages: { id: string; name: string }[] };
    };
    const ev = await mkEvent(ownerAuth, clientId, "Portal Assets Event");
    eventId = ev.id;
    const sibling = await mkEvent(ownerAuth, clientId, "Portal Sibling Event");
    const oc = await request(app).post("/api/v1/clients").set("Authorization", otherAuth).send({ businessName: "Portal Other Client" });
    otherClientId = (body(oc).client as Json).id as string;
    otherEventId = (await mkEvent(otherAuth, otherClientId, "Portal Other Event")).id;

    // Visible, with a stage and internal fields that must never reach the client.
    visibleId = await makeAsset(ownerAuth, {
      clientId, eventId, title: "Final photos", url: "https://example.test/final", comment: "INTERNAL-NOTE-SECRET", tags: ["internal-tag"],
      visibleToClient: true, eventStageId: ev.stages[1]!.id,
    });
    await makeAsset(ownerAuth, { clientId, eventId, title: "Newer shared", url: "https://example.test/newer", type: "video", visibleToClient: true });
    // Not marked, on another event, on another client, and deleted: none of these may appear.
    await makeAsset(ownerAuth, { clientId, eventId, title: "UNMARKED asset", url: "https://example.test/unmarked" });
    await makeAsset(ownerAuth, { clientId, eventId: sibling.id, title: "SIBLING event asset", url: "https://example.test/sib", visibleToClient: true });
    await makeAsset(otherAuth, { clientId: otherClientId, eventId: otherEventId, title: "OTHER client asset", url: "https://example.test/other", visibleToClient: true });
    const gone = await makeAsset(ownerAuth, { clientId, eventId, title: "DELETED asset", url: "https://example.test/gone", visibleToClient: true });
    expect((await request(app).delete(`/api/v1/assets/${gone}`).set("Authorization", ownerAuth)).status).toBe(204);

    const live = await request(app).post(`/api/v1/portal-links/${clientId}`).set("Authorization", ownerAuth);
    token = body(live).token as string;
    const event = await eventOf(token, eventId);
    expect(event.assets.map((a) => a.title)).toEqual(["Newer shared", "Final photos"]);
    const final = event.assets[1]!;
    expect(final).toMatchObject({ id: visibleId, url: "https://example.test/final", type: "photo", stageName: "Shoot" });
    expect(final.stagePosition).toBe(2);
    expect(Object.keys(final).sort()).toEqual(["createdAt", "id", "stagePosition", "stageName", "title", "type", "url"].sort());
    const text = JSON.stringify(body(await request(app).get(`/api/v1/portal/${token}/events/${eventId}`)));
    for (const secret of ["INTERNAL-NOTE-SECRET", "internal-tag", "UNMARKED", "SIBLING", "OTHER client", "DELETED"]) expect(text).not.toContain(secret);
    // The dashboard lists the shared files under "attention" (round 5) and the calendar only counts them; the secrets never leak.
    const dash = JSON.stringify(body(await request(app).get(`/api/v1/portal/${token}`)));
    expect(dash).toContain("Final photos");
    for (const secret of ["INTERNAL-NOTE-SECRET", "internal-tag", "UNMARKED", "OTHER client", "DELETED"]) expect(dash).not.toContain(secret);
    const cal = JSON.stringify(body(await request(app).get(`/api/v1/portal/${token}/events?from=2031-02-20T00:00:00Z&to=2031-03-10T00:00:00Z`)));
    expect(cal).not.toContain("Final photos");
    // Each event lists only its own shared assets.
    expect((await eventOf(token, sibling.id)).assets.map((a) => a.title)).toEqual(["SIBLING event asset"]);
  });

  it("another client's event is a 404, and un-marking removes the asset from the page", async () => {
    expect((await request(app).get(`/api/v1/portal/${token}/events/${otherEventId}`)).status).toBe(404);
    const a = await request(app).get(`/api/v1/assets/${visibleId}`).set("Authorization", ownerAuth);
    const v = (body(a).asset as Json).version as number;
    expect((await request(app).patch(`/api/v1/assets/${visibleId}`).set("Authorization", ownerAuth).send({ visibleToClient: false, version: v })).status).toBe(200);
    expect((await eventOf(token, eventId)).assets.map((x) => x.title)).toEqual(["Newer shared"]);
  });

  afterAll(async () => {
    // Events and assets go with their clients (deleteClientsOwnedBy in the file's afterAll); the templates are fixtures.
    await deleteClientsOwnedBy([other.id]);
    await deleteStageTemplates(created);
  });
});

describe("link lifecycle", () => {
  it("regenerate kills the old token; disable kills the new one", async () => {
    const regen = await request(app).post(`/api/v1/portal-links/${clientId}`).set("Authorization", ownerAuth);
    const fresh = body(regen).token as string;
    expect((await request(app).get(`/api/v1/portal/${token}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/portal/${fresh}`)).status).toBe(200);
    expect((await request(app).post(`/api/v1/portal-links/${clientId}/disable`).set("Authorization", ownerAuth)).status).toBe(200);
    expect((await request(app).get(`/api/v1/portal/${fresh}`)).status).toBe(404);
    token = fresh;
  });

  it("archiving revokes the link for good: unarchiving does not bring it back", async () => {
    const regen = await request(app).post(`/api/v1/portal-links/${clientId}`).set("Authorization", ownerAuth);
    const live = body(regen).token as string;
    const client = await request(app).get(`/api/v1/clients/${clientId}`).set("Authorization", ownerAuth);
    const v = ((body(client).client as Json).version as number);
    expect((await request(app).post(`/api/v1/clients/${clientId}/archive`).set("Authorization", adminAuth).send({ version: v })).status).toBe(200);
    expect((await request(app).get(`/api/v1/portal/${live}`)).status).toBe(404);
    expect((await request(app).post(`/api/v1/portal-links/${clientId}`).set("Authorization", ownerAuth)).status).toBe(409);
    expect((await request(app).post(`/api/v1/clients/${clientId}/unarchive`).set("Authorization", adminAuth).send({})).status).toBe(200);
    expect((await request(app).get(`/api/v1/portal/${live}`)).status).toBe(404);
  });
});

describe("who a comment notifies", () => {
  it("only active client managers on the team: not someone deactivated or moved to a task-only role since joining", async () => {
    const gone = await createFixtureUser("social_media_manager", "Portal Gone");
    try {
      // On the team, then deactivated; and the editor, as if their role changed after joining.
      await db.execute(sql`insert into client_members (client_id, profile_id) values (${clientId}, ${gone.id}), (${clientId}, ${editor.id}), (${clientId}, ${other.id})`);
      await db.execute(sql`update profiles set active = false where id = ${gone.id}`);
      const link = await request(app).post(`/api/v1/portal-links/${clientId}`).set("Authorization", ownerAuth);
      const res = await request(app).post(`/api/v1/portal/${body(link).token as string}/comments`).send({ body: "Who hears this?" });
      expect(res.status).toBe(201);
      const commentId = (body(res).comment as Json).id as string;
      const n = await db.execute(sql`select user_id from notifications where type = 'client_comment' and payload::text like ${"%" + commentId + "%"}`);
      expect(n.rows.map((r) => (r as { user_id: string }).user_id).sort()).toEqual([owner.id, other.id].sort());
    } finally {
      await db.execute(sql`delete from client_members where client_id = ${clientId} and profile_id in (${gone.id}, ${editor.id}, ${other.id})`);
      await deleteFixtureUser(gone.id);
    }
  });
});

describe("round 5: regenerate, shared-file counts, and what needs the client", () => {
  type Stage = { id: string; name: string; position: number };
  type Ev = { id: string; version: number; stages: Stage[] };
  let templateId: string;
  let teamTemplateId: string;
  let xClient: string;
  let yClient: string;
  let xToken: string;
  let yToken: string;
  let e1: Ev;
  let e2: Ev;
  let yEvent: Ev;

  const mkEvent = async (auth: string, cid: string, title: string, day: number, tpl = templateId): Promise<Ev> => {
    const r = await request(app)
      .post("/api/v1/events")
      .set("Authorization", auth)
      .send({ clientId: cid, templateId: tpl, title, type: "shoot", startsAt: `2031-04-${String(day).padStart(2, "0")}T10:00:00Z`, endsAt: `2031-04-${String(day).padStart(2, "0")}T12:00:00Z` });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return body(r).event as Ev;
  };
  const share = async (auth: string, over: Json) => {
    const r = await request(app).post("/api/v1/assets").set("Authorization", auth).send({ title: "x", url: "https://example.test/r5", type: "video", ...over });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return (body(r).asset as Json).id as string;
  };
  const moveTo = async (auth: string, ev: Ev, position: number) => {
    const cur = await request(app).get(`/api/v1/events/${ev.id}`).set("Authorization", auth);
    const version = ((body(cur).event as Json).version as number);
    const r = await request(app).post(`/api/v1/events/${ev.id}/stage`).set("Authorization", auth).send({ stageId: ev.stages[position - 1]!.id, version });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
  };
  const askApproval = async (auth: string, ev: Ev) => {
    const r = await request(app).post("/api/v1/approvals").set("Authorization", auth).send({ subject: "event", subjectId: ev.id });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
  };
  const dashboard = async (t: string) => body(await request(app).get(`/api/v1/portal/${t}`)) as Json & { upcoming: Json[]; attention: { approvals: Json[]; files: Json[] } };
  const detail = async (t: string, id: string) => body(await request(app).get(`/api/v1/portal/${t}/events/${id}`)).event as Json & { assets: Json[] };
  const stamp = Date.now();

  beforeAll(async () => {
    const t = await request(app)
      .post("/api/v1/stage-templates")
      .set("Authorization", adminAuth)
      .send({ name: `IT Portal R5 Tpl ${stamp}`, kind: "event", stages: ["Plan", { name: "Client Review", approvers: ["client"] }, { name: "Team Check", approvers: ["team_managers"] }, "Done"] });
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    templateId = (body(t).template as Json).id as string;
    const t2 = await request(app)
      .post("/api/v1/stage-templates")
      .set("Authorization", adminAuth)
      .send({ name: `IT Portal R5 Team Tpl ${stamp}`, kind: "event", stages: ["Plan", { name: "Team Check", approvers: ["team_managers"] }, "Done"] });
    expect(t2.status, JSON.stringify(t2.body)).toBe(201);
    teamTemplateId = (body(t2).template as Json).id as string;
    const cx = await request(app).post("/api/v1/clients").set("Authorization", ownerAuth).send({ businessName: `Portal R5 X ${stamp}` });
    xClient = (body(cx).client as Json).id as string;
    const cy = await request(app).post("/api/v1/clients").set("Authorization", otherAuth).send({ businessName: `Portal R5 Y ${stamp}` });
    yClient = (body(cy).client as Json).id as string;
    xToken = body(await request(app).post(`/api/v1/portal-links/${xClient}`).set("Authorization", ownerAuth)).token as string;
    yToken = body(await request(app).post(`/api/v1/portal-links/${yClient}`).set("Authorization", otherAuth)).token as string;
    e1 = await mkEvent(ownerAuth, xClient, `R5 First ${stamp}`, 1);
    e2 = await mkEvent(ownerAuth, xClient, `R5 Second ${stamp}`, 2, teamTemplateId);
    yEvent = await mkEvent(otherAuth, yClient, `R5 Stranger ${stamp}`, 3);
  });

  afterAll(async () => {
    await deleteClientsOwnedBy([owner.id, other.id]);
    await deleteStageTemplates([templateId, teamTemplateId]);
  });

  it("regenerate: the old link is off at once, the new one works and GET returns its url", async () => {
    const a = await request(app).post(`/api/v1/portal-links/${xClient}`).set("Authorization", ownerAuth);
    const tokenA = body(a).token as string;
    expect((await request(app).get(`/api/v1/portal/${tokenA}`)).status).toBe(200);
    const b = await request(app).post(`/api/v1/portal-links/${xClient}`).set("Authorization", ownerAuth);
    const tokenB = body(b).token as string;
    expect(tokenB).not.toBe(tokenA);
    const old = await request(app).get(`/api/v1/portal/${tokenA}`);
    expect([old.status, body(old).code]).toEqual([404, "PORTAL_LINK_INVALID"]);
    expect((await request(app).get(`/api/v1/portal/${tokenB}`)).status).toBe(200);
    const current = await request(app).get(`/api/v1/portal-links/${xClient}`).set("Authorization", ownerAuth);
    expect(body(current).link).toMatchObject({ active: true, url: expect.stringMatching(new RegExp(`/p/${tokenB}$`)) as string });
    // The revoked link keeps its row and loses its stored token.
    const rows = await db.execute(sql`select active, revoked_at is not null as revoked, token from portal_links where client_id = ${xClient} order by created_at`);
    expect(rows.rows.slice(-2)).toEqual([
      { active: false, revoked: true, token: null },
      { active: true, revoked: false, token: tokenB },
    ]);
    xToken = tokenB;
  });

  it("counts shared files per event and per stage; never an unshared asset, another client's, or a deleted one", async () => {
    await share(ownerAuth, { clientId: xClient, eventId: e1.id, eventStageId: e1.stages[1]!.id, title: "R5 Reel A", visibleToClient: true });
    await share(ownerAuth, { clientId: xClient, eventId: e1.id, eventStageId: e1.stages[1]!.id, title: "R5 Reel B", visibleToClient: true });
    await share(ownerAuth, { clientId: xClient, eventId: e1.id, eventStageId: e1.stages[3]!.id, title: "R5 Design C", type: "design", visibleToClient: true });
    await share(ownerAuth, { clientId: xClient, eventId: e1.id, title: "R5 Loose D", visibleToClient: true }); // no stage: counted, not in fileStages
    await share(ownerAuth, { clientId: xClient, eventId: e1.id, eventStageId: e1.stages[1]!.id, title: "R5 INTERNAL E" }); // not shared
    const gone = await share(ownerAuth, { clientId: xClient, eventId: e1.id, eventStageId: e1.stages[1]!.id, title: "R5 DELETED F", visibleToClient: true });
    expect((await request(app).delete(`/api/v1/assets/${gone}`).set("Authorization", ownerAuth)).status).toBe(204);
    await share(otherAuth, { clientId: yClient, eventId: yEvent.id, eventStageId: yEvent.stages[1]!.id, title: "R5 STRANGER G", visibleToClient: true });

    const ev = await detail(xToken, e1.id);
    expect(ev).toMatchObject({ fileCount: 4, fileStages: [{ position: 2, count: 2 }, { position: 4, count: 1 }], awaitingYourApproval: false, approvalStagePosition: null });
    const newest = ev.assets[0]!;
    expect(ev.latestFileAt).toBe(newest.createdAt);
    expect(ev.assets.find((a) => a.title === "R5 Reel A")).toMatchObject({ stagePosition: 2, stageName: "Client Review" });
    expect(ev.assets.find((a) => a.title === "R5 Loose D")).toMatchObject({ stagePosition: null, stageName: null });
    // The second event has none.
    expect(await detail(xToken, e2.id)).toMatchObject({ fileCount: 0, fileStages: [], latestFileAt: null });

    const dash = await dashboard(xToken);
    const listed = dash.upcoming.find((e) => e.id === e1.id)!;
    expect(listed).toMatchObject({ fileCount: 4, fileStages: [{ position: 2, count: 2 }, { position: 4, count: 1 }], latestFileAt: newest.createdAt });
    expect(dash.attention.files.map((f) => f.title)).toEqual(["R5 Loose D", "R5 Design C", "R5 Reel B", "R5 Reel A"]);
    expect(dash.attention.files[1]).toMatchObject({ eventId: e1.id, eventTitle: `R5 First ${stamp}`, stageName: "Done", stagePosition: 4, type: "design", url: "https://example.test/r5" });
    expect(dash.attention.files[0]).toMatchObject({ stageName: null, stagePosition: null });
    const text = JSON.stringify(dash);
    for (const secret of ["INTERNAL", "DELETED", "STRANGER", `R5 Stranger ${stamp}`]) expect(text).not.toContain(secret);
    // The calendar carries the counts too.
    const cal = body(await request(app).get(`/api/v1/portal/${xToken}/events?from=2031-03-25T00:00:00Z&to=2031-04-10T00:00:00Z`)).events as Json[];
    expect(cal.find((e) => e.id === e1.id)).toMatchObject({ fileCount: 4 });
  });

  it("only files from the last 30 days are in attention (older ones stay counted on their event)", async () => {
    const old = await share(ownerAuth, { clientId: xClient, eventId: e2.id, title: "R5 Old file", visibleToClient: true });
    await db.execute(sql`update assets set created_at = now() - interval '31 days' where id = ${old}`);
    const dash = await dashboard(xToken);
    expect(dash.attention.files.map((f) => f.title)).not.toContain("R5 Old file");
    expect(dash.upcoming.find((e) => e.id === e2.id)).toMatchObject({ fileCount: 1 });
    await db.execute(sql`delete from assets where id = ${old}`);
  });

  it("a request for the client sets awaitingYourApproval and leads the attention list; a staff-only approval does not", async () => {
    await moveTo(ownerAuth, e1, 2);
    await askApproval(ownerAuth, e1);
    await moveTo(ownerAuth, e2, 2); // "Team Check": approvers team_managers only
    await askApproval(ownerAuth, e2);
    await moveTo(otherAuth, yEvent, 2);
    await askApproval(otherAuth, yEvent); // another client's request

    const dash = await dashboard(xToken);
    const first = dash.upcoming.find((e) => e.id === e1.id)!;
    const second = dash.upcoming.find((e) => e.id === e2.id)!;
    expect(first).toMatchObject({ awaitingYourApproval: true, approvalStagePosition: 2 });
    expect(second).toMatchObject({ awaitingYourApproval: false, approvalStagePosition: null });
    expect(dash.attention.approvals).toEqual([{ eventId: e1.id, eventTitle: `R5 First ${stamp}`, stageName: "Client Review", stagePosition: 2, requestedAt: expect.any(String) as string }]);
    expect(JSON.stringify(dash)).not.toContain(`R5 Stranger ${stamp}`);
    expect(await detail(xToken, e1.id)).toMatchObject({ awaitingYourApproval: true, approvalStagePosition: 2 });
    expect(await detail(xToken, e2.id)).toMatchObject({ awaitingYourApproval: false, approvalStagePosition: null, pendingApproval: null });
    if (dash.current) expect(dash.current).toHaveProperty("awaitingYourApproval");
  });

  it("another client's portal sees only its own files and requests", async () => {
    const dash = await dashboard(yToken);
    expect(dash.attention.approvals.map((a) => a.eventTitle)).toEqual([`R5 Stranger ${stamp}`]);
    expect(dash.attention.files.map((f) => f.title)).toEqual(["R5 STRANGER G"]);
    expect(JSON.stringify(dash)).not.toContain("R5 First");
    expect((await request(app).get(`/api/v1/portal/${yToken}/events/${e1.id}`)).status).toBe(404);
  });

  it("once the client decides, the event stops waiting and leaves the attention list", async () => {
    const pending = (await detail(xToken, e1.id)).pendingApproval as Json;
    const res = await request(app).post(`/api/v1/portal/${xToken}/approvals/${pending.id as string}`).send({ version: pending.version, decision: "approve" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const dash = await dashboard(xToken);
    expect(dash.attention.approvals).toEqual([]);
    expect(dash.upcoming.find((e) => e.id === e1.id)).toMatchObject({ awaitingYourApproval: false, approvalStagePosition: null });
  });
  it("comments can be listed per event: only that event's, paged; another client's or a made-up event is 404; a bad uuid is 400", async () => {
    const post = async (b: Json) => {
      const r = await request(app).post(`/api/v1/portal/${xToken}/comments`).send(b);
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      return (body(r).comment as Json).id as string;
    };
    const general = await post({ body: "R5 general note" });
    const about1a = await post({ body: "R5 about first A", eventId: e1.id });
    const about1b = await post({ body: "R5 about first B", eventId: e1.id });
    const about2 = await post({ body: "R5 about second", eventId: e2.id });
    const ids = async (q: string, t = xToken) => {
      const r = await request(app).get(`/api/v1/portal/${t}/comments${q}`);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      return { ids: (body(r).comments as Json[]).map((c) => c.id), total: body(r).total as number };
    };
    // Newest first, only the named event's.
    expect(await ids(`?eventId=${e1.id}`)).toEqual({ ids: [about1b, about1a], total: 2 });
    expect(await ids(`?eventId=${e2.id}`)).toEqual({ ids: [about2], total: 1 });
    // Paged as before, and the total is the filtered one.
    expect(await ids(`?eventId=${e1.id}&limit=1&offset=1`)).toEqual({ ids: [about1a], total: 2 });
    // Without the filter: all of this client's comments, unchanged.
    const all = await ids("?limit=100");
    expect(all.ids).toEqual(expect.arrayContaining([general, about1a, about1b, about2]));
    // An event that isn't this client's (or doesn't exist) gives the same 404; a bad id is a 400.
    for (const bad of [yEvent.id, "00000000-0000-4000-8000-000000000000"]) {
      const r = await request(app).get(`/api/v1/portal/${xToken}/comments?eventId=${bad}`);
      expect([r.status, body(r).code]).toEqual([404, "EVENT_NOT_FOUND"]);
    }
    expect((await request(app).get(`/api/v1/portal/${xToken}/comments?eventId=not-a-uuid`)).status).toBe(400);
    // The other client never sees these through its own link either.
    expect((await request(app).get(`/api/v1/portal/${yToken}/comments?eventId=${e1.id}`)).status).toBe(404);
    expect((await ids("", yToken)).ids).toEqual([]);
  });
});
