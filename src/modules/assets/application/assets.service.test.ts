import { beforeEach, describe, expect, it } from "vitest";
import { AssetsService, type AssetsCaller } from "./assets.service";
import { AppError } from "../../../common/errors/app-error";
import { AUDIT_ACTIONS } from "../../../common/audit/audit-actions";
import type { AuditEvent, AuditLogger } from "../../../common/audit/audit-logger";
import type { AssetEntity } from "../domain/asset.entity";
import type { AssetClient, AssetEvent } from "../domain/asset.rules";
import type { AssetChangeDecision, AssetListFilters, AssetsRepositoryPort, NewAssetRecord } from "./ports/assets-repository.port";

/** Unit coverage against an in-memory fake: scope, guarded writes, soft delete, audit. SQL is covered by the integration suite. */

const ADMIN: AssetsCaller = { userId: "admin", role: "admin" };
const ROHAN: AssetsCaller = { userId: "rohan", role: "social_media_manager" };
const SARA: AssetsCaller = { userId: "sara", role: "marketing_manager" };
const EDITOR: AssetsCaller = { userId: "meera", role: "editor" };

function asset(o: Partial<AssetEntity> = {}): AssetEntity {
  return {
    id: "a1",
    clientId: "c1",
    clientName: "Acme",
    ownerId: "rohan",
    clientStatus: "active",
    eventId: null,
    eventTitle: null,
    title: "Footage",
    url: "https://x.test/a",
    type: "video",
    comment: null,
    tags: [],
    createdBy: "rohan",
    createdByName: "Rohan",
    version: 1,
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
    ...o,
  };
}

class FakeRepo implements AssetsRepositoryPort {
  rows = new Map<string, AssetEntity>();
  clients = new Map<string, AssetClient>([
    ["c1", { id: "c1", ownerId: "rohan", status: "active" }],
    ["c9", { id: "c9", ownerId: "rohan", status: "archived" }],
  ]);
  eventsById = new Map<string, AssetEvent>([
    ["e1", { id: "e1", clientId: "c1" }],
    ["e2", { id: "e2", clientId: "other" }],
  ]);
  lastFilters: AssetListFilters | null = null;
  findMany(f: AssetListFilters) {
    this.lastFilters = f;
    return Promise.resolve([...this.rows.values()]);
  }
  countMany() {
    return Promise.resolve(this.rows.size);
  }
  findById(id: string) {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  findClient(id: string) {
    return Promise.resolve(this.clients.get(id) ?? null);
  }
  findEvent(id: string) {
    return Promise.resolve(this.eventsById.get(id) ?? null);
  }
  create(r: NewAssetRecord, guard: (c: AssetClient) => void) {
    guard(this.clients.get(r.clientId)!);
    const row = asset({ ...r, id: `a${this.rows.size + 1}`, ownerId: this.clients.get(r.clientId)!.ownerId });
    this.rows.set(row.id, row);
    return Promise.resolve(row.id);
  }
  update(id: string, decide: AssetChangeDecision) {
    const cur = this.rows.get(id);
    if (!cur) return Promise.reject(new AppError(404, "Asset not found", "ASSET_NOT_FOUND"));
    const ch = decide(cur);
    if (ch.deleted) {
      this.rows.delete(id);
      return Promise.resolve(cur);
    }
    const next = { ...cur, ...ch.fields, tags: ch.tags ?? cur.tags, version: cur.version + 1 };
    this.rows.set(id, next);
    return Promise.resolve(next);
  }
  suggestTags() {
    return Promise.resolve([{ name: "Reels", uses: 2 }]);
  }
}

class FakeAudit implements AuditLogger {
  events: AuditEvent[] = [];
  record(e: AuditEvent) {
    this.events.push(e);
    return Promise.resolve();
  }
}

const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return e instanceof AppError ? e.statusCode : 500;
  }
};

describe("AssetsService", () => {
  let repo: FakeRepo;
  let audit: FakeAudit;
  let svc: AssetsService;
  beforeEach(() => {
    repo = new FakeRepo();
    audit = new FakeAudit();
    svc = new AssetsService(repo, audit);
    repo.rows.set("a1", asset());
  });
  const body = { clientId: "c1", title: "New", url: "https://x.test/n", type: "photo" as const };
  const query = { limit: 20, offset: 0 };

  it("pins a manager's list to their own clients but lets the admin filter by owner", async () => {
    await svc.list(SARA, { ...query, ownerId: "rohan" });
    expect(repo.lastFilters?.ownerId).toBe("sara");
    await svc.list(ADMIN, { ...query, ownerId: "rohan" });
    expect(repo.lastFilters?.ownerId).toBe("rohan");
    await svc.list(ADMIN, query);
    expect(repo.lastFilters?.ownerId).toBeUndefined();
  });

  it("refuses a reversed date range", async () => {
    expect(await status(svc.list(ADMIN, { ...query, from: "2026-10-15T00:00:00Z", to: "2026-10-14T00:00:00Z" }))).toBe(400);
  });

  it("another manager's asset is a 404; the owner and admin can read it; task-only staff get 403", async () => {
    expect(await status(svc.get(SARA, "a1"))).toBe(404);
    expect(await status(svc.get(ROHAN, "a1"))).toBe(200);
    expect(await status(svc.get(ADMIN, "a1"))).toBe(200);
    expect(await status(svc.get(EDITOR, "a1"))).toBe(403);
  });

  it("creates under an own client, audits without the URL, and refuses other/archived clients and foreign events", async () => {
    expect(await status(svc.create(ROHAN, { ...body, tags: ["Reels"] }))).toBe(200);
    expect(audit.events.at(-1)?.action).toBe(AUDIT_ACTIONS.ASSET_CREATED);
    expect(JSON.stringify(audit.events.at(-1))).not.toContain("x.test");
    expect(await status(svc.create(SARA, body))).toBe(404);
    expect(await status(svc.create(ROHAN, { ...body, clientId: "c9" }))).toBe(409);
    expect(await status(svc.create(ROHAN, { ...body, eventId: "e2" }))).toBe(400);
    expect(await status(svc.create(ROHAN, { ...body, eventId: "e1" }))).toBe(200);
  });

  it("update: needs a field, checks scope before version, bumps version", async () => {
    expect(await status(svc.update(ROHAN, "a1", { version: 1 }))).toBe(400);
    expect(await status(svc.update(SARA, "a1", { title: "x", version: 99 }))).toBe(404);
    expect(await status(svc.update(ROHAN, "a1", { title: "x", version: 99 }))).toBe(409);
    const r = await svc.update(ROHAN, "a1", { title: "Renamed", tags: ["A"], version: 1 });
    expect(r.version).toBe(2);
    expect(r.tags).toEqual(["A"]);
    expect(audit.events.at(-1)?.action).toBe(AUDIT_ACTIONS.ASSET_UPDATED);
  });

  it("soft delete hides the asset, audits, and respects scope and version", async () => {
    expect(await status(svc.remove(SARA, "a1", {}))).toBe(404);
    expect(await status(svc.remove(ROHAN, "a1", { version: 5 }))).toBe(409);
    await svc.remove(ROHAN, "a1", { version: 1 });
    expect(audit.events.at(-1)?.action).toBe(AUDIT_ACTIONS.ASSET_DELETED);
    expect(await status(svc.get(ROHAN, "a1"))).toBe(404);
  });

  it("an archived client's assets are read-only", async () => {
    repo.rows.set("a2", asset({ id: "a2", clientStatus: "archived" }));
    expect(await status(svc.update(ROHAN, "a2", { title: "x", version: 1 }))).toBe(409);
    expect(await status(svc.remove(ROHAN, "a2", {}))).toBe(409);
  });
});
