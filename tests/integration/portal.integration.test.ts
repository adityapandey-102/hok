import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { bearerFor, closeDb, createFixtureUser, deleteClientsOwnedBy, deleteFixtureUser, type FixtureUser } from "./helpers";

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
  [ownerAuth, otherAuth, editorAuth] = await Promise.all([bearerFor(owner), bearerFor(other), bearerFor(editor)]);
  const res = await request(app).post("/api/v1/clients").set("Authorization", ownerAuth).send({ businessName: "Portal Test Bakery" });
  expect(res.status).toBe(201);
  clientId = (body(res).client as Json).id as string;
});

afterAll(async () => {
  await deleteClientsOwnedBy([owner.id, other.id]); // portal_links + comments cascade with the client
  for (const u of [owner, other, editor]) await deleteFixtureUser(u.id);
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
    expect((await request(app).post(`/api/v1/clients/${clientId}/archive`).set("Authorization", ownerAuth).send({ version: v })).status).toBe(200);
    expect((await request(app).get(`/api/v1/portal/${live}`)).status).toBe(404);
    expect((await request(app).post(`/api/v1/portal-links/${clientId}`).set("Authorization", ownerAuth)).status).toBe(409);
    expect((await request(app).post(`/api/v1/clients/${clientId}/unarchive`).set("Authorization", ownerAuth).send({})).status).toBe(200);
    expect((await request(app).get(`/api/v1/portal/${live}`)).status).toBe(404);
  });
});
