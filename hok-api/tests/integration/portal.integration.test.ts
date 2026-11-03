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

  it("generates a link whose token is shown once and never stored", async () => {
    const res = await request(app).post(`/api/v1/portal-links/${clientId}`).set("Authorization", ownerAuth);
    expect(res.status).toBe(201);
    token = body(res).token as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body(res).url).toMatch(new RegExp(`/p/${token}$`));
    const stored = await db.execute(sql`select count(*)::int as n from portal_links where token_hash = ${token}`);
    expect((stored.rows[0] as { n: number }).n).toBe(0);
    const again = await request(app).get(`/api/v1/portal-links/${clientId}`).set("Authorization", ownerAuth);
    expect(JSON.stringify(body(again))).not.toContain(token);
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
    expect(Object.keys(final).sort()).toEqual(["createdAt", "id", "stageName", "title", "type", "url"]);
    const text = JSON.stringify(body(await request(app).get(`/api/v1/portal/${token}/events/${eventId}`)));
    for (const secret of ["INTERNAL-NOTE-SECRET", "internal-tag", "UNMARKED", "SIBLING", "OTHER client", "DELETED"]) expect(text).not.toContain(secret);
    // The dashboard and the calendar are unchanged: no assets there.
    expect(JSON.stringify(body(await request(app).get(`/api/v1/portal/${token}`)))).not.toContain("Final photos");
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
