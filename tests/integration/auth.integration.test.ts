import { afterAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { and, desc, eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { authProvider } from "../../src/common/auth/supabase-auth-provider";
import { fetchActiveProfile } from "../../src/common/database/profiles";
import { db } from "../../src/common/database/drizzle-client";
import { supabaseClient } from "../../src/common/database/supabase-client";
import { auditLog } from "../../src/common/audit/audit-log.schema";
import { profiles } from "../../src/modules/users/infrastructure/profile.schema";
import { bearerFor, closeDb, createFixtureUser, deleteFixtureUser } from "./helpers";

/**
 * Authentication against the real local Supabase Auth (GoTrue) service and the
 * real Express app -- no mocking of the identity provider. Covers the
 * provider itself, the profiles lookup requireAuth depends on, and the
 * /auth/* endpoints (login bookkeeping, /me read + self-edit, logout,
 * bootstrap gate).
 */
const app = createApp();
const createdUserIds: string[] = [];

afterEach(async () => {
  while (createdUserIds.length) {
    const id = createdUserIds.pop();
    if (id) await deleteFixtureUser(id);
  }
});

afterAll(async () => {
  await closeDb();
});

describe("SupabaseAuthProvider (integration)", () => {
  it("signs in with a real password and returns a verifiable access token", async () => {
    const user = await createFixtureUser("marketing_agent", "IT Agent");
    createdUserIds.push(user.id);

    const session = await authProvider.signInWithPassword(user.email, user.password);
    expect(session.userId).toBe(user.id);
    expect(session.accessToken).toBeTruthy();

    const verified = await authProvider.verifyAccessToken(session.accessToken);
    expect(verified?.userId).toBe(user.id);
  });

  it("rejects sign-in with the wrong password", async () => {
    const user = await createFixtureUser("developer", "IT Developer");
    createdUserIds.push(user.id);
    await expect(authProvider.signInWithPassword(user.email, "definitely-wrong-password")).rejects.toThrow();
  });

  it("rejects verification of a garbage token", async () => {
    expect(await authProvider.verifyAccessToken("not-a-real-token")).toBeNull();
  });

  it("bans a user so their existing credentials can no longer sign in", async () => {
    const user = await createFixtureUser("editor", "IT Editor");
    createdUserIds.push(user.id);
    await authProvider.banUser(user.id);
    await expect(authProvider.signInWithPassword(user.email, user.password)).rejects.toThrow();
  });

  it("refuses a second account with the same email as 409 USER_EMAIL_TAKEN", async () => {
    const user = await createFixtureUser("editor", "IT Duplicate");
    createdUserIds.push(user.id);
    await expect(authProvider.createUser({ email: user.email, password: "Another-pass1", fullName: "Dup", role: "editor" })).rejects.toMatchObject({
      statusCode: 409,
      code: "USER_EMAIL_TAKEN",
    });
  });

  it("loads the matching profiles row (role, time zone, active) that requireAuth depends on", async () => {
    const user = await createFixtureUser("social_media_manager", "IT Profile Lookup");
    createdUserIds.push(user.id);
    const profile = await fetchActiveProfile(user.id);
    expect(profile).toMatchObject({ role: "social_media_manager", timeZone: "Asia/Kolkata", phone: null, avatarUrl: null, active: true });
  });
});

describe("/auth endpoints (integration)", () => {
  it("POST /auth/login returns tokens + profile, records last_login_at and audits the sign-in", async () => {
    const user = await createFixtureUser("marketing_manager", "IT Login");
    createdUserIds.push(user.id);

    const res = await request(app).post("/api/v1/auth/login").send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    const body = res.body as { accessToken: string; refreshToken: string; expiresAt: number; profile: { id: string; role: string; timeZone: string } };
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.expiresAt).toBeGreaterThan(0);
    expect(body.profile).toMatchObject({ id: user.id, role: "marketing_manager", timeZone: "Asia/Kolkata" });

    const [row] = await db.select({ lastLoginAt: profiles.lastLoginAt }).from(profiles).where(eq(profiles.id, user.id));
    expect(row?.lastLoginAt).toBeInstanceOf(Date);

    const audits = await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(and(eq(auditLog.actorId, user.id), eq(auditLog.action, "auth.login")))
      .orderBy(desc(auditLog.createdAt));
    expect(audits.length).toBe(1);
  });

  it("POST /auth/login with a wrong password is a 401 AUTH_INVALID_CREDENTIALS", async () => {
    const user = await createFixtureUser("editor", "IT Wrong Password");
    createdUserIds.push(user.id);
    const res = await request(app).post("/api/v1/auth/login").send({ email: user.email, password: "nope-nope" });
    expect(res.status).toBe(401);
    expect((res.body as { code: string }).code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("GET /auth/me needs a token and returns { profile } with the time zone", async () => {
    expect((await request(app).get("/api/v1/auth/me")).status).toBe(401);

    const user = await createFixtureUser("developer", "IT Me");
    createdUserIds.push(user.id);
    const res = await request(app).get("/api/v1/auth/me").set("Authorization", await bearerFor(user));
    expect(res.status).toBe(200);
    expect((res.body as { profile: { id: string; timeZone: string } }).profile).toMatchObject({ id: user.id, timeZone: "Asia/Kolkata" });
  });

  it("PATCH /auth/me updates the caller's own name, phone, time zone and photo URL", async () => {
    const user = await createFixtureUser("editor", "IT Self Edit");
    createdUserIds.push(user.id);
    const auth = await bearerFor(user);

    const res = await request(app)
      .patch("/api/v1/auth/me")
      .set("Authorization", auth)
      .send({ fullName: "IT Self Edited", timeZone: "Europe/London", phone: "+44 20 7946 0958", avatarUrl: "https://example.com/me.jpg" });
    expect(res.status).toBe(200);
    expect((res.body as { profile: unknown }).profile).toMatchObject({
      fullName: "IT Self Edited",
      timeZone: "Europe/London",
      phone: "+44 20 7946 0958",
      avatarUrl: "https://example.com/me.jpg",
    });

    // null clears
    const cleared = await request(app).patch("/api/v1/auth/me").set("Authorization", auth).send({ phone: null });
    expect((cleared.body as { profile: { phone: unknown } }).profile.phone).toBeNull();
  });

  it("PATCH /auth/me refuses a bad time zone / phone / URL, and can never change role", async () => {
    const user = await createFixtureUser("editor", "IT Self Edit Guard");
    createdUserIds.push(user.id);
    const auth = await bearerFor(user);

    for (const body of [{ timeZone: "Mars/Olympus" }, { timeZone: "+05:30" }, { phone: "call me" }, { avatarUrl: "javascript:alert(1)" }]) {
      const res = await request(app).patch("/api/v1/auth/me").set("Authorization", auth).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((res.body as { code: string }).code).toBe("VALIDATION_ERROR");
    }

    const roleOnly = await request(app).patch("/api/v1/auth/me").set("Authorization", auth).send({ role: "admin" });
    expect(roleOnly.status).toBe(400);
    expect((roleOnly.body as { code: string }).code).toBe("VALIDATION_NO_FIELDS");

    const [row] = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id));
    expect(row?.role).toBe("editor");
  });

  it("POST /auth/logout revokes the session: the refresh token stops working", async () => {
    const user = await createFixtureUser("marketing_agent", "IT Logout");
    createdUserIds.push(user.id);
    const session = await authProvider.signInWithPassword(user.email, user.password);

    const out = await request(app).post("/api/v1/auth/logout").set("Authorization", `Bearer ${session.accessToken}`);
    expect(out.status).toBe(204);

    const refresh = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it("POST /auth/refresh rotates a valid refresh token into a new session with the profile", async () => {
    const user = await createFixtureUser("developer", "IT Refresh");
    createdUserIds.push(user.id);
    const session = await authProvider.signInWithPassword(user.email, user.password);

    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken });
    expect(res.status).toBe(200);
    expect((res.body as { profile: { id: string } }).profile.id).toBe(user.id);
  });

  it("a deactivated account's live token is refused on the next request (403 AUTH_ACCOUNT_DEACTIVATED)", async () => {
    const user = await createFixtureUser("editor", "IT Deactivated Token");
    createdUserIds.push(user.id);
    const auth = await bearerFor(user);
    await db.update(profiles).set({ active: false }).where(eq(profiles.id, user.id));

    const res = await request(app).get("/api/v1/auth/me").set("Authorization", auth);
    expect(res.status).toBe(403);
    expect((res.body as { code: string }).code).toBe("AUTH_ACCOUNT_DEACTIVATED");
  });

  it("bootstrap-status reports adminExists, and bootstrap is refused once an admin exists", async () => {
    // Guarantee at least one admin, whatever state the local DB is in.
    const admin = await createFixtureUser("admin", "IT Existing Admin");
    createdUserIds.push(admin.id);

    const status = await request(app).get("/api/v1/auth/bootstrap-status");
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ adminExists: true });

    const res = await request(app)
      .post("/api/v1/auth/bootstrap")
      .send({ setupKey: "not-the-key", email: `it-bootstrap-${Date.now()}@hok.test`, password: "Secret-123", fullName: "Should Not Exist" });
    expect(res.status).toBe(403);
    // No BOOTSTRAP_TOKEN in the test environment: setup is off before any other check (security audit run 1).
    expect((res.body as { code: string }).code).toBe("AUTH_BOOTSTRAP_DISABLED");
  });

  it("an auth user created without the server-set role gets no profile, even if its own metadata says admin (security audit run 1)", async () => {
    // Simulates a self sign-up: role only in user_metadata (user-controlled), nothing in app_metadata.
    const { data, error } = await supabaseClient.auth.admin.createUser({
      email: `it-selfsignup-${Date.now()}@hok.test`,
      password: "Secret-123-xyz",
      email_confirm: true,
      user_metadata: { full_name: "Self Signup", role: "admin" },
    });
    expect(error).toBeNull();
    createdUserIds.push(data.user!.id);
    const rows = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, data.user!.id));
    expect(rows).toHaveLength(0);
    // And a normal hok-api-created user still gets its role.
    const staff = await createFixtureUser("editor", "IT Role From App Metadata");
    createdUserIds.push(staff.id);
    const [p] = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, staff.id));
    expect(p?.role).toBe("editor");
  });

  it("own password change needs the current password and ends every session (security audit run 1)", async () => {
    const u = await createFixtureUser("editor", "IT Password Change");
    createdUserIds.push(u.id);
    const login = async () => (await request(app).post("/api/v1/auth/login").send({ email: u.email, password: u.password })).body as { accessToken: string; refreshToken: string };
    const a = await login();
    const b = await login();

    const wrong = await request(app).post("/api/v1/auth/password-update").set("Authorization", `Bearer ${a.accessToken}`).send({ currentPassword: "nope", newPassword: "New-Pass-123" });
    expect(wrong.status).toBe(400);
    expect((wrong.body as { code: string }).code).toBe("AUTH_CURRENT_PASSWORD_INVALID");

    const ok = await request(app).post("/api/v1/auth/password-update").set("Authorization", `Bearer ${a.accessToken}`).send({ currentPassword: u.password, newPassword: "New-Pass-123" });
    expect(ok.status).toBe(204);
    // Every old session is gone (the web app signs the current device back in with the new password).
    expect((await request(app).post("/api/v1/auth/refresh").send({ refreshToken: b.refreshToken })).status).toBe(401);
    expect((await request(app).post("/api/v1/auth/refresh").send({ refreshToken: a.refreshToken })).status).toBe(401);
    expect((await request(app).post("/api/v1/auth/login").send({ email: u.email, password: "New-Pass-123" })).status).toBe(200);
  });

  it("password-reset-request answers 204 whether or not the email exists", async () => {
    const res = await request(app).post("/api/v1/auth/password-reset-request").send({ email: `nobody-${Date.now()}@hok.test` });
    expect(res.status).toBe(204);
  });
});
