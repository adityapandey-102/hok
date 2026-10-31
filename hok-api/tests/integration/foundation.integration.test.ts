import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app";
import { db } from "../../src/common/database/drizzle-client";
import { profiles } from "../../src/modules/users/infrastructure/profile.schema";
import { closeDb, createFixtureUser, deleteFixtureUser } from "./helpers";

/**
 * M0 foundation, against the real local stack: the API can reach Postgres,
 * documents itself, answers unknown routes in the standard error shape, and
 * the profiles trigger turns a new auth user into a profile with its role and
 * time zone.
 */
const app = createApp();
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await deleteFixtureUser(id);
  await closeDb();
});

describe("health", () => {
  it("is live", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe("ok");
  });

  it("is ready (database reachable)", async () => {
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready" });
  });
});

describe("error shape", () => {
  it("answers an unknown route with a stable code and a request id", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    const body = res.body as { code: string; requestId: unknown };
    expect(body.code).toBe("ROUTE_NOT_FOUND");
    expect(typeof body.requestId).toBe("string");
  });
});

describe("profiles trigger", () => {
  it("creates a profile with the role and time zone given at account creation", async () => {
    const user = await createFixtureUser("marketing_manager", "Trigger Test");
    created.push(user.id);

    const [row] = await db.select().from(profiles).where(eq(profiles.id, user.id));
    expect(row?.role).toBe("marketing_manager");
    expect(row?.fullName).toBe("Trigger Test");
    expect(row?.timeZone).toBe("Asia/Kolkata");
    expect(row?.active).toBe(true);
  });

  it("rejects a role outside the six HOK roles", async () => {
    const user = await createFixtureUser("editor", "Role Check");
    created.push(user.id);
    await expect(
      db.update(profiles).set({ role: "owner_manager" as never }).where(eq(profiles.id, user.id)),
    ).rejects.toThrow();
  });
});
