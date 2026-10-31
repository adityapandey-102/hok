import { afterAll, beforeAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { authProvider } from "../../src/common/auth/supabase-auth-provider";
import { db } from "../../src/common/database/drizzle-client";
import { profiles } from "../../src/modules/users/infrastructure/profile.schema";
import { bearerFor, closeDb, createFixtureUser, deleteFixtureUser, type FixtureUser } from "./helpers";

/**
 * The Admin's staff-account endpoints (users:manage) end to end: real app,
 * real auth, real Postgres. Covers the paginated/searchable list, create with
 * a generated password that really signs in, edits (time zone validated),
 * deactivate/reactivate at the auth layer, password regeneration and the
 * Admin self-protection rules.
 */
const app = createApp();
let admin: FixtureUser;
let adminAuth: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  admin = await createFixtureUser("admin", "IT Users Admin");
  adminAuth = await bearerFor(admin);
});

afterEach(async () => {
  for (const id of createdUserIds.splice(0)) await deleteFixtureUser(id);
});

afterAll(async () => {
  if (admin) await deleteFixtureUser(admin.id);
  await closeDb();
});

async function fixture(role: FixtureUser["role"], name: string): Promise<FixtureUser> {
  const user = await createFixtureUser(role, name);
  createdUserIds.push(user.id);
  return user;
}

describe("GET /users", () => {
  it("paginates with a total and a bounded page", async () => {
    const res = await request(app).get("/api/v1/users?limit=2&offset=0").set("Authorization", adminAuth);
    expect(res.status).toBe(200);
    const body = res.body as { users: unknown[]; total: number; limit: number; offset: number };
    expect(body).toMatchObject({ limit: 2, offset: 0 });
    expect(body.users.length).toBeLessThanOrEqual(2);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it("clamps an over-large limit to 100 and refuses a non-numeric one", async () => {
    const big = await request(app).get("/api/v1/users?limit=100000").set("Authorization", adminAuth);
    expect((big.body as { limit: number }).limit).toBe(100);
    const bad = await request(app).get("/api/v1/users?limit=abc").set("Authorization", adminAuth);
    expect(bad.status).toBe(400);
  });

  it("searches name or email, filters by role, and refuses an unknown role", async () => {
    const marker = `Zzsearch${Date.now()}`;
    const target = await fixture("editor", `${marker} Editor`);
    await fixture("developer", `${marker} Developer`);

    const byName = await request(app).get(`/api/v1/users?search=${encodeURIComponent(marker)}`).set("Authorization", adminAuth);
    expect((byName.body as { total: number }).total).toBe(2);

    const byRole = await request(app).get(`/api/v1/users?search=${encodeURIComponent(marker)}&role=editor`).set("Authorization", adminAuth);
    const body = byRole.body as { users: { id: string }[]; total: number };
    expect(body.total).toBe(1);
    expect(body.users[0]!.id).toBe(target.id);

    const badRole = await request(app).get("/api/v1/users?role=owner_manager").set("Authorization", adminAuth);
    expect(badRole.status).toBe(400);
  });

  it("is Admin-only: a manager gets 403, no token gets 401", async () => {
    const smm = await fixture("social_media_manager", "IT SMM");
    expect((await request(app).get("/api/v1/users").set("Authorization", await bearerFor(smm))).status).toBe(403);
    expect((await request(app).get("/api/v1/users")).status).toBe(401);
  });
});

describe("GET /users/:id", () => {
  it("returns one user with time zone and last login", async () => {
    const target = await fixture("marketing_agent", "IT Single Fetch");
    const res = await request(app).get(`/api/v1/users/${target.id}`).set("Authorization", adminAuth);
    expect(res.status).toBe(200);
    expect((res.body as { user: unknown }).user).toMatchObject({ id: target.id, timeZone: "Asia/Kolkata", lastLoginAt: null });
  });

  it("404s an unknown id and a non-uuid id with USER_NOT_FOUND", async () => {
    for (const id of ["00000000-0000-4000-8000-000000000000", "abc"]) {
      const res = await request(app).get(`/api/v1/users/${id}`).set("Authorization", adminAuth);
      expect(res.status).toBe(404);
      expect((res.body as { code: string }).code).toBe("USER_NOT_FOUND");
    }
  });
});

describe("POST /users", () => {
  it("creates an account whose generated password really signs in, with the given time zone and phone", async () => {
    const email = `it-create-${Date.now()}@hok.test`;
    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", adminAuth)
      .send({ email, fullName: "Priya Shah", role: "editor", timeZone: "Asia/Dubai", phone: "+971 4 123 4567" });
    expect(res.status).toBe(201);
    const { userId, password } = res.body as { userId: string; password: string };
    createdUserIds.push(userId);
    expect(password).toMatch(/^Priya-/);

    const session = await authProvider.signInWithPassword(email, password);
    expect(session.userId).toBe(userId);

    const [row] = await db.select().from(profiles).where(eq(profiles.id, userId));
    expect(row).toMatchObject({ role: "editor", timeZone: "Asia/Dubai", phone: "+971 4 123 4567", fullName: "Priya Shah" });
  });

  it("refuses a duplicate email (409 USER_EMAIL_TAKEN) and an invalid time zone (400)", async () => {
    const existing = await fixture("editor", "IT Existing Email");
    const dup = await request(app).post("/api/v1/users").set("Authorization", adminAuth).send({ email: existing.email, fullName: "Dup", role: "editor" });
    expect(dup.status).toBe(409);
    expect((dup.body as { code: string }).code).toBe("USER_EMAIL_TAKEN");

    const badZone = await request(app)
      .post("/api/v1/users")
      .set("Authorization", adminAuth)
      .send({ email: `it-badzone-${Date.now()}@hok.test`, fullName: "Bad Zone", role: "editor", timeZone: "Asia/Kolkatta" });
    expect(badZone.status).toBe(400);
  });
});

describe("PATCH /users/:id", () => {
  it("updates name, role, time zone and phone", async () => {
    const target = await fixture("editor", "IT Patch");
    const res = await request(app)
      .patch(`/api/v1/users/${target.id}`)
      .set("Authorization", adminAuth)
      .send({ fullName: "IT Patched", role: "social_media_manager", timeZone: "America/New_York", phone: "9876543210" });
    expect(res.status).toBe(204);
    const [row] = await db.select().from(profiles).where(eq(profiles.id, target.id));
    expect(row).toMatchObject({ fullName: "IT Patched", role: "social_media_manager", timeZone: "America/New_York", phone: "9876543210" });
  });

  it("refuses an empty edit, a bad time zone, and the Admin changing their own role", async () => {
    const target = await fixture("editor", "IT Patch Guard");
    const empty = await request(app).patch(`/api/v1/users/${target.id}`).set("Authorization", adminAuth).send({});
    expect((empty.body as { code: string }).code).toBe("VALIDATION_NO_FIELDS");

    const zone = await request(app).patch(`/api/v1/users/${target.id}`).set("Authorization", adminAuth).send({ timeZone: "Nowhere/City" });
    expect(zone.status).toBe(400);

    const ownRole = await request(app).patch(`/api/v1/users/${admin.id}`).set("Authorization", adminAuth).send({ role: "editor" });
    expect(ownRole.status).toBe(400);
    expect((ownRole.body as { code: string }).code).toBe("USER_CANNOT_CHANGE_OWN_ROLE");
  });
});

describe("deactivate / reactivate", () => {
  it("deactivating blocks sign-in and the live token; reactivating restores sign-in", async () => {
    const target = await fixture("developer", "IT Lifecycle");
    const liveAuth = await bearerFor(target);

    expect((await request(app).post(`/api/v1/users/${target.id}/deactivate`).set("Authorization", adminAuth)).status).toBe(204);
    await expect(authProvider.signInWithPassword(target.email, target.password)).rejects.toThrow();
    // The ban kills the live access token at the provider (GoTrue refuses a banned
    // user's token: 401); an inactive profile alone would be a 403 (see auth tests).
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", liveAuth)).status).toBe(401);

    expect((await request(app).post(`/api/v1/users/${target.id}/reactivate`).set("Authorization", adminAuth)).status).toBe(204);
    const session = await authProvider.signInWithPassword(target.email, target.password);
    expect(session.userId).toBe(target.id);
  });

  it("refuses deactivating yourself", async () => {
    const res = await request(app).post(`/api/v1/users/${admin.id}/deactivate`).set("Authorization", adminAuth);
    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe("USER_CANNOT_DEACTIVATE_SELF");
  });
});

describe("POST /users/:id/generate-password", () => {
  it("issues a working new password for a staff account", async () => {
    const target = await fixture("editor", "Meera Nair");
    const res = await request(app).post(`/api/v1/users/${target.id}/generate-password`).set("Authorization", adminAuth);
    expect(res.status).toBe(201);
    const { password } = res.body as { password: string };
    expect((await authProvider.signInWithPassword(target.email, password)).userId).toBe(target.id);
  });

  it("refuses your own password and another Admin's once they have signed in", async () => {
    const own = await request(app).post(`/api/v1/users/${admin.id}/generate-password`).set("Authorization", adminAuth);
    expect(own.status).toBe(403);
    expect((own.body as { code: string }).code).toBe("USER_PASSWORD_SELF_MANAGED");

    // Another Admin's password: only the Owner may reset it (security audit run 1), and this
    // fixture Admin is not the Owner, so it is refused whether or not they have signed in.
    const otherAdmin = await fixture("admin", "IT Other Admin");
    const before = await request(app).post(`/api/v1/users/${otherAdmin.id}/generate-password`).set("Authorization", adminAuth);
    expect(before.status).toBe(403);
    expect((before.body as { code: string }).code).toBe("USER_OWNER_ONLY");
    await db.update(profiles).set({ lastLoginAt: new Date() }).where(eq(profiles.id, otherAdmin.id));
    const after = await request(app).post(`/api/v1/users/${otherAdmin.id}/generate-password`).set("Authorization", adminAuth);
    expect(after.status).toBe(403);
  });
});
