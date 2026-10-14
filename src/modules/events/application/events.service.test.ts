import { beforeEach, describe, expect, it } from "vitest";
import { EventsService, type EventsCaller } from "./events.service";
import { AppError } from "../../../common/errors/app-error";
import type { AuditEvent } from "../../../common/audit/audit-logger";
import type { EventDetail, EventEntity, EventStage } from "../domain/event.entity";
import type { EventClient, EventTemplate } from "../domain/event.rules";
import type { EventChanges, EventListFilters, EventsRepositoryPort, NewEventRecord, StageMoveEntry } from "./ports/events-repository.port";
import type { EventQueryDto } from "../api/dto/event.dto";

/** EventsService against an in-memory fake: row scope via the client's owner, template copy, guarded edits and stage moves. */

const ADMIN: EventsCaller = { userId: "admin", role: "admin" };
const ROHAN: EventsCaller = { userId: "rohan", role: "social_media_manager" };
const SARA: EventsCaller = { userId: "sara", role: "marketing_manager" };

const STAGES: EventStage[] = [
  { id: "s1", position: 1, name: "Planned" },
  { id: "s2", position: 2, name: "Shoot" },
  { id: "s3", position: 3, name: "Editing" },
];

function event(o: Partial<EventEntity> = {}): EventEntity {
  return {
    id: "e1",
    clientId: "c1",
    clientName: "Acme",
    ownerId: "rohan",
    clientStatus: "active",
    title: "Diwali shoot",
    type: "shoot",
    startsAt: "2026-10-20T04:30:00.000Z",
    endsAt: "2026-10-20T10:30:00.000Z",
    timeZone: "Asia/Kolkata",
    location: null,
    description: null,
    assignedTeam: [],
    templateId: "t1",
    templateName: "Photo Shoot",
    currentStageId: "s1",
    stageCount: 3,
    state: "active",
    version: 1,
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
    ...o,
  };
}

class FakeRepo implements EventsRepositoryPort {
  events = new Map<string, EventEntity>([["e1", event()]]);
  history: (StageMoveEntry & { from: string; to: string })[] = [];
  clients = new Map<string, EventClient>([
    ["c1", { id: "c1", ownerId: "rohan", status: "active", timeZone: "Asia/Kolkata" }],
    ["c2", { id: "c2", ownerId: "sara", status: "active", timeZone: "Asia/Dubai" }],
    ["c3", { id: "c3", ownerId: "rohan", status: "archived", timeZone: "UTC" }],
  ]);
  templates = new Map<string, EventTemplate>([
    ["t1", { id: "t1", name: "Photo Shoot", active: true, stageNames: ["Planned", "Shoot", "Editing"] }],
    ["t2", { id: "t2", name: "Old", active: false, stageNames: ["A"] }],
  ]);
  activeProfiles = new Set(["rohan", "neha"]);
  created: NewEventRecord[] = [];
  lastFilters: EventListFilters | null = null;

  findMany(filters: EventListFilters) {
    this.lastFilters = filters;
    return Promise.resolve([]);
  }
  countMany() {
    return Promise.resolve(0);
  }
  findDetail(id: string): Promise<EventDetail | null> {
    const e = this.events.get(id);
    return Promise.resolve(e ? { ...e, stages: STAGES, history: [], team: [] } : null);
  }
  findClient(id: string) {
    return Promise.resolve(this.clients.get(id) ?? null);
  }
  findTemplate(id: string) {
    return Promise.resolve(this.templates.get(id) ?? null);
  }
  findActiveProfileIds(ids: readonly string[]) {
    return Promise.resolve(new Set(ids.filter((i) => this.activeProfiles.has(i))));
  }
  create(record: NewEventRecord, guard: (client: EventClient) => void) {
    guard(this.clients.get(record.clientId)!);
    this.created.push(record);
    const client = this.clients.get(record.clientId)!;
    this.events.set("new", event({ id: "new", clientId: record.clientId, ownerId: client.ownerId, timeZone: record.timeZone, title: record.title }));
    return Promise.resolve("new");
  }
  update(id: string, decide: (current: EventEntity) => EventChanges) {
    const current = this.events.get(id);
    if (!current) return Promise.reject(new AppError(404, "nf", "EVENT_NOT_FOUND"));
    this.events.set(id, { ...current, ...(decide(current) as Partial<EventEntity>), version: current.version + 1 });
    return Promise.resolve();
  }
  moveStage(id: string, decide: (current: EventEntity, stages: EventStage[]) => EventStage, entry: StageMoveEntry) {
    const current = this.events.get(id)!;
    const target = decide(current, STAGES);
    this.history.push({ ...entry, from: current.currentStageId, to: target.id });
    this.events.set(id, { ...current, currentStageId: target.id, version: current.version + 1 });
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

const query = (q: Partial<EventQueryDto> = {}): EventQueryDto => ({
  limit: 50,
  offset: 0,
  clientId: undefined,
  ownerId: undefined,
  from: undefined,
  to: undefined,
  state: undefined,
  type: undefined,
  search: undefined,
  ...q,
});

const newEvent = {
  clientId: "c1",
  templateId: "t1",
  title: "Launch",
  type: "campaign" as const,
  startsAt: "2026-11-01T09:00:00+05:30",
  endsAt: "2026-11-01T12:00:00+05:30",
};

describe("EventsService", () => {
  let repo: FakeRepo;
  let audit: AuditEvent[];
  let service: EventsService;

  beforeEach(() => {
    repo = new FakeRepo();
    audit = [];
    service = new EventsService(repo, { record: (e) => (audit.push(e), Promise.resolve()) });
  });

  describe("list", () => {
    it("pins a manager to their own clients' events; the Admin may filter by owner; the range is validated", async () => {
      await service.list(ROHAN, query({ ownerId: "sara" }));
      expect(repo.lastFilters?.ownerId).toBe("rohan");
      await service.list(ADMIN, query({ ownerId: "sara", from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" }));
      expect(repo.lastFilters).toMatchObject({ ownerId: "sara", range: { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" } });
      expect(await codeOf(service.list(ADMIN, query({ from: "2026-10-01T00:00:00Z" })))).toBe("EVENT_RANGE_INVALID");
    });
  });

  describe("get", () => {
    it("is a 404 for another manager's event", async () => {
      expect((await service.get(ROHAN, "e1")).id).toBe("e1");
      expect(await codeOf(service.get(SARA, "e1"))).toBe("EVENT_NOT_FOUND");
      expect((await service.get(ADMIN, "e1")).stages).toHaveLength(3);
    });
  });

  describe("create", () => {
    it("copies the template's stages in order, defaults to the client's time zone, and audits", async () => {
      await service.create(ROHAN, newEvent);
      expect(repo.created[0]).toMatchObject({ stageNames: ["Planned", "Shoot", "Editing"], templateName: "Photo Shoot", timeZone: "Asia/Kolkata", createdBy: "rohan" });
      expect(audit[0]).toMatchObject({ action: "event.created", entityId: "new" });
    });

    it("refuses another manager's client (404), an archived client (409), an inactive template, bad times and an unknown team member", async () => {
      expect(await codeOf(service.create(ROHAN, { ...newEvent, clientId: "c2" }))).toBe("CLIENT_NOT_FOUND");
      expect(await codeOf(service.create(ROHAN, { ...newEvent, clientId: "c3" }))).toBe("CLIENT_ARCHIVED");
      expect(await codeOf(service.create(ROHAN, { ...newEvent, templateId: "t2" }))).toBe("EVENT_TEMPLATE_INVALID");
      expect(await codeOf(service.create(ROHAN, { ...newEvent, endsAt: "2026-11-01T08:00:00+05:30" }))).toBe("EVENT_TIMES_INVALID");
      expect(await codeOf(service.create(ROHAN, { ...newEvent, assignedTeam: ["neha", "ghost"] }))).toBe("EVENT_TEAM_INVALID");
    });

    it("lets the Admin create under any client", async () => {
      await service.create(ADMIN, { ...newEvent, clientId: "c2" });
      expect(repo.created[0]?.timeZone).toBe("Asia/Dubai");
    });
  });

  describe("update", () => {
    it("reschedules, cancels and checks times against the stored ones", async () => {
      const updated = await service.update(ROHAN, "e1", { state: "cancelled", endsAt: "2026-10-20T12:00:00Z", version: 1 });
      expect(updated).toMatchObject({ state: "cancelled", version: 2 });
      expect(audit[0]).toMatchObject({ action: "event.updated", metadata: { fields: ["endsAt", "state"] } });
      expect(await codeOf(service.update(ROHAN, "e1", { endsAt: "2026-10-19T00:00:00Z", version: 2 }))).toBe("EVENT_TIMES_INVALID");
    });

    it("404 for another manager (even with a stale version), 409 when stale, 409 when the client is archived", async () => {
      expect(await codeOf(service.update(SARA, "e1", { title: "x", version: 9 }))).toBe("EVENT_NOT_FOUND");
      expect(await codeOf(service.update(ROHAN, "e1", { title: "x", version: 9 }))).toBe("EVENT_MODIFIED");
      repo.events.set("e1", event({ clientStatus: "archived" }));
      expect(await codeOf(service.update(ROHAN, "e1", { title: "x", version: 1 }))).toBe("CLIENT_ARCHIVED");
      expect(await codeOf(service.update(ROHAN, "e1", { version: 1 }))).toBe("VALIDATION_NO_FIELDS");
    });
  });

  describe("moveStage", () => {
    it("moves forward and back, recording each move with its note and visibility", async () => {
      await service.moveStage(ROHAN, "e1", { stageId: "s3", note: "Editing now", visibleToClient: true, version: 1 });
      await service.moveStage(ROHAN, "e1", { stageId: "s2", note: null, visibleToClient: false, version: 2 });
      expect(repo.history).toEqual([
        { note: "Editing now", visibleToClient: true, changedBy: "rohan", from: "s1", to: "s3" },
        { note: null, visibleToClient: false, changedBy: "rohan", from: "s3", to: "s2" },
      ]);
    });

    it("refuses the same stage, a foreign stage, a cancelled event, a stale version and another manager", async () => {
      expect(await codeOf(service.moveStage(ROHAN, "e1", { stageId: "s1", note: null, visibleToClient: false, version: 1 }))).toBe("EVENT_STAGE_UNCHANGED");
      expect(await codeOf(service.moveStage(ROHAN, "e1", { stageId: "zz", note: null, visibleToClient: false, version: 1 }))).toBe("EVENT_STAGE_INVALID");
      expect(await codeOf(service.moveStage(ROHAN, "e1", { stageId: "s2", note: null, visibleToClient: false, version: 7 }))).toBe("EVENT_MODIFIED");
      expect(await codeOf(service.moveStage(SARA, "e1", { stageId: "s2", note: null, visibleToClient: false, version: 1 }))).toBe("EVENT_NOT_FOUND");
      repo.events.set("e1", event({ state: "postponed" }));
      expect(await codeOf(service.moveStage(ROHAN, "e1", { stageId: "s2", note: null, visibleToClient: false, version: 1 }))).toBe("EVENT_NOT_ACTIVE");
    });
  });
});
