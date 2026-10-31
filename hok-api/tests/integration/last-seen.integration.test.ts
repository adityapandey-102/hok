import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq, sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { resetLastSeenNotes } from "../../src/common/database/last-seen";
import { profiles } from "../../src/modules/users/infrastructure/profile.schema";
import { bearerFor, closeDb, createFixtureUser, deleteFixtureUser, type FixtureUser } from "./helpers";

/**
 * Last seen (FR-SYS-03): any authenticated call records it on the person's own
 * row, at most once per window; the Admin reads it on users and the team page.
 */
const app = createApp();
let admin: FixtureUser;
let staff: FixtureUser;
let adminAuth: string;
let staffAuth: string;

const lastSeen = async (id: string) => (await db.select({ at: profiles.lastSeenAt }).from(profiles).where(eq(profiles.id, id)))[0]!.at;
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

beforeAll(async () => {
  [admin, staff] = await Promise.all([createFixtureUser("admin", "Seen Admin"), createFixtureUser("editor", "Seen Editor")]);
  [adminAuth, staffAuth] = await Promise.all([bearerFor(admin), bearerFor(staff)]);
  resetLastSeenNotes();
});

afterAll(async () => {
  for (const u of [admin, staff]) await deleteFixtureUser(u.id);
  await closeDb();
});

describe("last seen", () => {
  it("is null until the person uses HOK, then recorded by any authenticated call", async () => {
    expect(await lastSeen(staff.id)).toBeNull();
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", staffAuth)).status).toBe(200);
    await settle();
    const first = await lastSeen(staff.id);
    expect(first).not.toBeNull();
    expect(Date.now() - first!.getTime()).toBeLessThan(60_000);
  });

  it("writes at most once per window, even after the in-memory note is forgotten", async () => {
    const before = await lastSeen(staff.id);
    await request(app).get("/api/v1/auth/me").set("Authorization", staffAuth);
    resetLastSeenNotes(); // as after a restart / on another instance: the SQL condition still holds
    await request(app).get("/api/v1/auth/me").set("Authorization", staffAuth);
    await settle();
    expect((await lastSeen(staff.id))!.getTime()).toBe(before!.getTime());
  });

  it("shows on the Admin's user and team views", async () => {
    await db.update(profiles).set({ lastSeenAt: sql`now() - interval '50 days'` }).where(eq(profiles.id, staff.id));
    const user = await request(app).get(`/api/v1/users/${staff.id}`).set("Authorization", adminAuth);
    expect(user.status).toBe(200);
    expect(Date.parse((user.body as { user: { lastSeenAt: string } }).user.lastSeenAt)).toBeLessThan(Date.now() - 45 * 86_400_000);
    const team = await request(app).get("/api/v1/dashboard/team?search=seen%20editor").set("Authorization", adminAuth);
    expect((team.body as { members: { lastSeenAt: string | null }[] }).members[0]!.lastSeenAt).not.toBeNull();
  });
});
