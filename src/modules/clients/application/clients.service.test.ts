import { beforeEach, describe, expect, it } from "vitest";
import { ClientsService, type ClientsCaller } from "./clients.service";
import { AppError } from "../../../common/errors/app-error";
import { AUDIT_ACTIONS } from "../../../common/audit/audit-actions";
import type { AuditEvent, AuditLogger } from "../../../common/audit/audit-logger";
import type { ClientEntity } from "../domain/client.entity";
import type { OwnerCandidate } from "../domain/client-ownership.rules";
import type {
  ClientChangeDecision,
  ClientListFilters,
  ClientListPage,
  ClientsRepositoryPort,
  NewClientRecord,
} from "./ports/clients-repository.port";
import type { CreateClientDto } from "../api/dto/create-client.dto";
import type { ClientQueryDto } from "../api/dto/client-query.dto";

/**
 * Unit coverage for ClientsService against an in-memory fake: row scope (a
 * manager's other-owner lookups are 404s, their list is pinned to themselves),
 * owner choice on create, the guarded writes (version, archived state,
 * contract dates against the stored values), reassign and its audit.
 * Repository SQL is covered by the integration suite.
 */

const ADMIN: ClientsCaller = { userId: "admin", role: "admin" };
const ROHAN: ClientsCaller = { userId: "rohan", role: "social_media_manager" };
const SARA: ClientsCaller = { userId: "sara", role: "marketing_manager" };
const EDITOR: ClientsCaller = { userId: "meera", role: "editor" };

function client(overrides: Partial<ClientEntity> = {}): ClientEntity {
  return {
    id: "c1",
    ownerId: "rohan",
    ownerName: "Rohan",
    businessName: "Acme",
    logoUrl: null,
    industry: null,
    contactPerson: null,
    phone: null,
    email: null,
    address: null,
    website: null,
    socialHandles: {},
    services: [],
    contractStart: null,
    contractEnd: null,
    timeZone: "Asia/Kolkata",
    notes: null,
    status: "active",
    archivedAt: null,
    version: 1,
    createdAt: "2026-10-13T00:00:00.000Z",
    updatedAt: "2026-10-13T00:00:00.000Z",
    ...overrides,
  };
}

class FakeClientsRepository implements ClientsRepositoryPort {
  rows = new Map<string, ClientEntity>();
  people = new Map<string, OwnerCandidate>([
    ["admin", { id: "admin", role: "admin", active: true }],
    ["rohan", { id: "rohan", role: "social_media_manager", active: true }],
    ["sara", { id: "sara", role: "marketing_manager", active: true }],
    ["meera", { id: "meera", role: "editor", active: true }],
    ["gone", { id: "gone", role: "social_media_manager", active: false }],
  ]);
  lastFilters: ClientListFilters | null = null;
  writes = 0;

  findMany(filters: ClientListFilters, page: ClientListPage) {
    this.lastFilters = filters;
    return Promise.resolve([...this.rows.values()].slice(page.offset, page.offset + page.limit));
  }
  countMany() {
    return Promise.resolve(this.rows.size);
  }
  findById(id: string) {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  create(record: NewClientRecord) {
    const row = client({ ...record, id: `c${this.rows.size + 1}`, ownerName: record.ownerId });
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }
  update(id: string, decide: ClientChangeDecision) {
    const current = this.rows.get(id);
    if (!current) return Promise.reject(new AppError(404, "Client not found", "CLIENT_NOT_FOUND"));
    const changes = decide(current);
    const empty =
      Object.keys(changes.fields ?? {}).length === 0 && !changes.status && !changes.ownerId && changes.archivedAt === undefined;
    if (empty) return Promise.resolve(current); // like the real repository: nothing written, version unchanged
    this.writes += 1;
    const next: ClientEntity = {
      ...current,
      ...changes.fields,
      ...(changes.status ? { status: changes.status } : {}),
      ...(changes.ownerId ? { ownerId: changes.ownerId } : {}),
      ...(changes.archivedAt === "now" ? { archivedAt: "2026-10-14T00:00:00.000Z" } : changes.archivedAt === null ? { archivedAt: null } : {}),
      version: current.version + 1,
    };
    this.rows.set(id, next);
    return Promise.resolve(next);
  }
  findOwnerCandidate(userId: string) {
    return Promise.resolve(this.people.get(userId) ?? null);
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

const query = (q: Partial<ClientQueryDto> = {}): ClientQueryDto => ({ limit: 20, offset: 0, search: undefined, status: undefined, industry: undefined, ownerId: undefined, ...q });

describe("ClientsService", () => {
  let repo: FakeClientsRepository;
  let audit: AuditLogger & { events: AuditEvent[] };
  let service: ClientsService;

  beforeEach(() => {
    repo = new FakeClientsRepository();
    repo.rows.set("c1", client());
    repo.rows.set("c2", client({ id: "c2", ownerId: "sara", ownerName: "Sara" }));
    const events: AuditEvent[] = [];
    audit = { events, record: (e) => (events.push(e), Promise.resolve()) };
    service = new ClientsService(repo, audit, "Asia/Kolkata");
  });

  describe("list", () => {
    it("pins a manager's list to their own clients, ignoring any ownerId filter", async () => {
      await service.list(ROHAN, query({ ownerId: "sara" }));
      expect(repo.lastFilters?.ownerId).toBe("rohan");
    });

    it("lets the Admin filter by owner, or see everyone", async () => {
      await service.list(ADMIN, query({ ownerId: "sara" }));
      expect(repo.lastFilters?.ownerId).toBe("sara");
      const all = await service.list(ADMIN, query());
      expect(repo.lastFilters?.ownerId).toBeUndefined();
      expect(all).toMatchObject({ total: 2, limit: 20, offset: 0 });
    });

    it("refuses task-only staff even if a route forgot the capability", async () => {
      expect(await codeOf(service.list(EDITOR, query()))).toBe("FORBIDDEN");
    });
  });

  describe("get", () => {
    it("returns the owner's client, and any client to the Admin", async () => {
      expect((await service.get(ROHAN, "c1")).id).toBe("c1");
      expect((await service.get(ADMIN, "c2")).id).toBe("c2");
    });

    it("is a 404 for another manager's client", async () => {
      expect(await codeOf(service.get(ROHAN, "c2"))).toBe("CLIENT_NOT_FOUND");
    });
  });

  describe("create", () => {
    const dto = (d: Partial<CreateClientDto> = {}): CreateClientDto => ({ businessName: "New Co", ...d });

    it("makes the creator the owner, starts active, defaults the time zone, and audits", async () => {
      const created = await service.create(ROHAN, dto());
      expect(created).toMatchObject({ ownerId: "rohan", status: "active", timeZone: "Asia/Kolkata", services: [], socialHandles: {} });
      expect(audit.events).toEqual([expect.objectContaining({ action: AUDIT_ACTIONS.CLIENT_CREATED, entityId: created.id, metadata: { ownerId: "rohan" } })]);
    });

    it("lets the Admin create for an active client manager", async () => {
      expect((await service.create(ADMIN, dto({ ownerId: "sara" }))).ownerId).toBe("sara");
    });

    it("refuses an Admin choosing task-only staff or a deactivated manager", async () => {
      expect(await codeOf(service.create(ADMIN, dto({ ownerId: "meera" })))).toBe("CLIENT_OWNER_INVALID");
      expect(await codeOf(service.create(ADMIN, dto({ ownerId: "gone" })))).toBe("CLIENT_OWNER_INVALID");
      expect(await codeOf(service.create(ADMIN, dto({ ownerId: "nobody" })))).toBe("CLIENT_OWNER_INVALID");
    });

    it("refuses a manager creating for someone else", async () => {
      expect(await codeOf(service.create(ROHAN, dto({ ownerId: "sara" })))).toBe("CLIENT_OWNER_FORBIDDEN");
    });

    it("refuses a contract that ends before it starts", async () => {
      expect(await codeOf(service.create(ROHAN, dto({ contractStart: "2026-06-01", contractEnd: "2026-05-01" })))).toBe("CLIENT_CONTRACT_DATES_INVALID");
    });
  });

  describe("update", () => {
    it("applies the edit, bumps the version and audits the field names (not values)", async () => {
      const updated = await service.update(ROHAN, "c1", { notes: "secret", status: "paused", version: 1 });
      expect(updated).toMatchObject({ notes: "secret", status: "paused", version: 2 });
      expect(audit.events[0]).toMatchObject({ action: AUDIT_ACTIONS.CLIENT_UPDATED, metadata: { fields: ["notes", "status"] } });
    });

    it("refuses an empty edit (400 VALIDATION_NO_FIELDS)", async () => {
      expect(await codeOf(service.update(ROHAN, "c1", { version: 1 }))).toBe("VALIDATION_NO_FIELDS");
    });

    it("is a 404 on another manager's client -- even with a stale version", async () => {
      expect(await codeOf(service.update(ROHAN, "c2", { notes: "x", version: 99 }))).toBe("CLIENT_NOT_FOUND");
      expect(repo.writes).toBe(0);
    });

    it("refuses a stale version (409 CLIENT_MODIFIED)", async () => {
      expect(await codeOf(service.update(ROHAN, "c1", { notes: "x", version: 2 }))).toBe("CLIENT_MODIFIED");
    });

    it("refuses editing an archived client (409 CLIENT_ARCHIVED)", async () => {
      repo.rows.set("c1", client({ status: "archived", archivedAt: "2026-10-13T00:00:00.000Z" }));
      expect(await codeOf(service.update(ROHAN, "c1", { notes: "x", version: 1 }))).toBe("CLIENT_ARCHIVED");
    });

    it("checks contract dates against the stored value when only one side changes", async () => {
      repo.rows.set("c1", client({ contractStart: "2026-06-01" }));
      expect(await codeOf(service.update(ROHAN, "c1", { contractEnd: "2026-05-01", version: 1 }))).toBe("CLIENT_CONTRACT_DATES_INVALID");
      expect(await codeOf(service.update(ROHAN, "c1", { contractStart: null, contractEnd: "2026-05-01", version: 1 }))).toBeNull();
    });
  });

  describe("archive / unarchive", () => {
    it("archives (stamping archived_at), then unarchives back to active", async () => {
      const archived = await service.archive(ROHAN, "c1", { version: 1 });
      expect(archived).toMatchObject({ status: "archived", version: 2 });
      expect(archived.archivedAt).not.toBeNull();
      const back = await service.unarchive(ROHAN, "c1", {});
      expect(back).toMatchObject({ status: "active", archivedAt: null, version: 3 });
      expect(audit.events.map((e) => e.action)).toEqual([AUDIT_ACTIONS.CLIENT_ARCHIVED, AUDIT_ACTIONS.CLIENT_UNARCHIVED]);
    });

    it("refuses archiving twice and unarchiving an active client", async () => {
      await service.archive(ROHAN, "c1", {});
      expect(await codeOf(service.archive(ROHAN, "c1", {}))).toBe("CLIENT_ARCHIVED");
      expect(await codeOf(service.unarchive(SARA, "c2", {}))).toBe("CLIENT_NOT_ARCHIVED");
    });

    it("is a 404 for another manager's client", async () => {
      expect(await codeOf(service.archive(SARA, "c1", {}))).toBe("CLIENT_NOT_FOUND");
    });
  });

  describe("reassign", () => {
    it("moves the client to another active manager and audits from/to", async () => {
      const moved = await service.reassign(ADMIN, "c1", { ownerId: "sara", version: 1 });
      expect(moved).toMatchObject({ ownerId: "sara", version: 2 });
      expect(audit.events).toEqual([
        expect.objectContaining({ action: AUDIT_ACTIONS.CLIENT_REASSIGNED, entityId: "c1", metadata: { from: "rohan", to: "sara" } }),
      ]);
    });

    it("works on an archived client", async () => {
      repo.rows.set("c1", client({ status: "archived", archivedAt: "2026-10-13T00:00:00.000Z" }));
      expect((await service.reassign(ADMIN, "c1", { ownerId: "admin" })).ownerId).toBe("admin");
    });

    it("reassigning to the current owner writes nothing and audits nothing", async () => {
      const same = await service.reassign(ADMIN, "c1", { ownerId: "rohan" });
      expect(same.version).toBe(1);
      expect(repo.writes).toBe(0);
      expect(audit.events).toEqual([]);
    });

    it("refuses an invalid target (task-only, deactivated, unknown)", async () => {
      expect(await codeOf(service.reassign(ADMIN, "c1", { ownerId: "meera" }))).toBe("CLIENT_OWNER_INVALID");
      expect(await codeOf(service.reassign(ADMIN, "c1", { ownerId: "gone" }))).toBe("CLIENT_OWNER_INVALID");
      expect(await codeOf(service.reassign(ADMIN, "c1", { ownerId: "nobody" }))).toBe("CLIENT_OWNER_INVALID");
    });

    it("refuses a manager (Admin only) and a stale version", async () => {
      expect(await codeOf(service.reassign(ROHAN, "c1", { ownerId: "sara" }))).toBe("FORBIDDEN");
      expect(await codeOf(service.reassign(ADMIN, "c1", { ownerId: "sara", version: 5 }))).toBe("CLIENT_MODIFIED");
    });

    it("is a 404 for a client that doesn't exist", async () => {
      expect(await codeOf(service.reassign(ADMIN, "nope", { ownerId: "sara" }))).toBe("CLIENT_NOT_FOUND");
    });
  });
});
