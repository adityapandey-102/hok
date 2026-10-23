import { beforeEach, describe, expect, it } from "vitest";
import { PersonalEventsService, type PersonalEventsCaller } from "./personal-events.service";
import { AppError } from "../../../common/errors/app-error";
import type { AuditEvent } from "../../../common/audit/audit-logger";
import type { PersonalEventEntity } from "../domain/personal-event.entity";
import type { NewPersonalEvent, PersonalEventChanges, PersonalEventFilters, PersonalEventsRepositoryPort } from "./ports/personal-events-repository.port";

const ADMIN: PersonalEventsCaller = { userId: "admin", role: "admin", timeZone: "Asia/Kolkata" };
const ROHAN: PersonalEventsCaller = { userId: "rohan", role: "social_media_manager", timeZone: "Europe/London" };
const SARA: PersonalEventsCaller = { userId: "sara", role: "marketing_manager", timeZone: "Asia/Dubai" };
const EDITOR: PersonalEventsCaller = { userId: "meera", role: "editor", timeZone: "UTC" };

function entry(o: Partial<PersonalEventEntity> = {}): PersonalEventEntity {
  return {
    id: "p1",
    ownerId: "rohan",
    ownerName: "Rohan",
    clientId: null,
    clientName: null,
    title: "Planning",
    startsAt: "2026-10-20T09:00:00.000Z",
    endsAt: "2026-10-20T10:00:00.000Z",
    timeZone: "Europe/London",
    description: null,
    version: 1,
    createdAt: "2026-10-15T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
    ...o,
  };
}

class FakeRepo implements PersonalEventsRepositoryPort {
  rows = new Map([["p1", entry()]]);
  clientOwners = new Map([
    ["c-rohan", "rohan"],
    ["c-sara", "sara"],
  ]);
  lastFilters: PersonalEventFilters | null = null;
  findMany(f: PersonalEventFilters) {
    this.lastFilters = f;
    return Promise.resolve([...this.rows.values()]);
  }
  countMany() {
    return Promise.resolve(this.rows.size);
  }
  findById(id: string) {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  findClientTeam(id: string) {
    const ownerId = this.clientOwners.get(id);
    return Promise.resolve(ownerId ? { teamIds: [ownerId] } : null);
  }
  create(r: NewPersonalEvent) {
    this.rows.set("new", entry({ ...r, id: "new" }));
    return Promise.resolve("new");
  }
  update(id: string, decide: (c: PersonalEventEntity) => PersonalEventChanges) {
    const current = this.rows.get(id);
    if (!current) return Promise.reject(new AppError(404, "nf", "PERSONAL_EVENT_NOT_FOUND"));
    this.rows.set(id, { ...current, ...(decide(current) as Partial<PersonalEventEntity>), version: current.version + 1 });
    return Promise.resolve();
  }
  delete(id: string, guard: (c: PersonalEventEntity) => void) {
    const current = this.rows.get(id);
    if (!current) return Promise.reject(new AppError(404, "nf", "PERSONAL_EVENT_NOT_FOUND"));
    guard(current);
    this.rows.delete(id);
    return Promise.resolve();
  }
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return err.code;
  }
}

describe("PersonalEventsService", () => {
  let repo: FakeRepo;
  let audit: AuditEvent[];
  let service: PersonalEventsService;
  const body = { title: "Team sync", startsAt: "2026-10-21T09:00:00Z", endsAt: "2026-10-21T10:00:00Z" };

  beforeEach(() => {
    repo = new FakeRepo();
    audit = [];
    service = new PersonalEventsService(repo, { record: (e) => (audit.push(e), Promise.resolve()) });
  });

  it("lists only the caller's entries for a manager; the Admin may pick an owner", async () => {
    await service.list(ROHAN, { limit: 50, offset: 0, ownerId: "sara" });
    expect(repo.lastFilters?.ownerId).toBe("rohan");
    await service.list(ADMIN, { limit: 50, offset: 0, ownerId: "sara" });
    expect(repo.lastFilters?.ownerId).toBe("sara");
  });

  it("creates for the caller in their profile zone, and links only their own client", async () => {
    const created = await service.create(ROHAN, { ...body, clientId: "c-rohan" });
    expect(created).toMatchObject({ ownerId: "rohan", timeZone: "Europe/London", clientId: "c-rohan" });
    expect(audit[0]).toMatchObject({ action: "personal_event.created" });
    expect(await codeOf(service.create(ROHAN, { ...body, clientId: "c-sara" }))).toBe("CLIENT_NOT_FOUND");
    expect(await codeOf(service.create(ROHAN, { ...body, endsAt: "2026-10-21T08:00:00Z" }))).toBe("PERSONAL_EVENT_TIMES_INVALID");
  });

  it("another manager's entry is 404 on read, edit and delete; the Admin may edit it", async () => {
    expect(await codeOf(service.get(SARA, "p1"))).toBe("PERSONAL_EVENT_NOT_FOUND");
    expect(await codeOf(service.update(SARA, "p1", { title: "x", version: 1 }))).toBe("PERSONAL_EVENT_NOT_FOUND");
    expect(await codeOf(service.delete(SARA, "p1"))).toBe("PERSONAL_EVENT_NOT_FOUND");
    expect((await service.update(ADMIN, "p1", { title: "Admin fix", version: 1 })).title).toBe("Admin fix");
  });

  it("an Admin editing someone's entry can only link THAT owner's client", async () => {
    expect(await codeOf(service.update(ADMIN, "p1", { clientId: "c-sara", version: 1 }))).toBe("CLIENT_NOT_FOUND");
    expect((await service.update(ADMIN, "p1", { clientId: "c-rohan", version: 1 })).clientId).toBe("c-rohan");
  });

  it("checks the version, the merged times, and an empty edit; deletes the owner's entry", async () => {
    expect(await codeOf(service.update(ROHAN, "p1", { title: "x", version: 9 }))).toBe("PERSONAL_EVENT_MODIFIED");
    expect(await codeOf(service.update(ROHAN, "p1", { endsAt: "2026-10-20T08:00:00Z", version: 1 }))).toBe("PERSONAL_EVENT_TIMES_INVALID");
    expect(await codeOf(service.update(ROHAN, "p1", { version: 1 }))).toBe("VALIDATION_NO_FIELDS");
    await service.delete(ROHAN, "p1");
    expect(repo.rows.has("p1")).toBe(false);
  });

  it("task-only staff have no personal calendar", async () => {
    expect(await codeOf(service.create(EDITOR, body))).toBe("FORBIDDEN");
  });
});
