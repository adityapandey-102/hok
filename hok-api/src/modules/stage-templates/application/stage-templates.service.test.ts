import { beforeEach, describe, expect, it } from "vitest";
import { StageTemplatesService, type StageTemplatesCaller } from "./stage-templates.service";
import { AppError } from "../../../common/errors/app-error";
import type { AuditEvent } from "../../../common/audit/audit-logger";
import type { Role } from "../../../domain";
import type { StageTemplateEntity } from "../domain/stage-template.entity";
import type { StageTemplateDecision, StageTemplateListFilters, StageTemplatesRepositoryPort } from "./ports/stage-templates-repository.port";

const ADMIN: StageTemplatesCaller = { userId: "admin", role: "admin" };
const SMM: StageTemplatesCaller = { userId: "rohan", role: "social_media_manager" };
const EDITOR: StageTemplatesCaller = { userId: "meera", role: "editor" };

function template(o: Partial<StageTemplateEntity> = {}): StageTemplateEntity {
  return {
    id: "t1",
    name: "Photo Shoot",
    active: true,
    kind: "event",
    roles: [],
    stages: [
      { id: "s1", position: 1, name: "Planned" },
      { id: "s2", position: 2, name: "Shoot" },
    ],
    version: 1,
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
    ...o,
  };
}

class FakeRepo implements StageTemplatesRepositoryPort {
  rows = new Map<string, StageTemplateEntity>([
    ["t1", template()],
    ["t2", template({ id: "t2", name: "Old", active: false })],
    ["k1", template({ id: "k1", name: "Reel edit", kind: "task", roles: ["editor"] })],
  ]);
  lastFilters: StageTemplateListFilters | null = null;
  findMany(filters: StageTemplateListFilters) {
    this.lastFilters = filters;
    return Promise.resolve([...this.rows.values()].filter((t) => filters.active === undefined || t.active === filters.active));
  }
  countMany() {
    return Promise.resolve(this.rows.size);
  }
  findById(id: string) {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  create(r: { name: string; stages: string[]; kind: "event" | "task"; roles: Role[] }) {
    const t = template({ id: "t3", name: r.name, kind: r.kind, roles: r.roles, stages: r.stages.map((name, i) => ({ id: `n${i}`, position: i + 1, name })) });
    this.rows.set(t.id, t);
    return Promise.resolve(t);
  }
  update(id: string, decide: StageTemplateDecision) {
    const current = this.rows.get(id);
    if (!current) return Promise.reject(new AppError(404, "nf", "STAGE_TEMPLATE_NOT_FOUND"));
    const c = decide(current);
    const next = {
      ...current,
      ...(c.name ? { name: c.name } : {}),
      ...(c.active !== undefined ? { active: c.active } : {}),
      ...(c.roles ? { roles: c.roles } : {}),
      ...(c.stages ? { stages: c.stages.map((name, i) => ({ id: `u${i}`, position: i + 1, name })) } : {}),
      version: current.version + 1,
    };
    this.rows.set(id, next);
    return Promise.resolve(next);
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

describe("StageTemplatesService", () => {
  let repo: FakeRepo;
  let events: AuditEvent[];
  let service: StageTemplatesService;
  const q = { limit: 50, offset: 0, search: undefined, active: undefined, kind: undefined, role: undefined };

  beforeEach(() => {
    repo = new FakeRepo();
    events = [];
    service = new StageTemplatesService(repo, { record: (e) => (events.push(e), Promise.resolve()) });
  });

  it("the Admin lists every template (and may filter by active); a manager only ever sees active ones", async () => {
    expect((await service.list(ADMIN, q)).templates).toHaveLength(3);
    expect((await service.list(ADMIN, { ...q, active: false })).templates.map((t) => t.id)).toEqual(["t2"]);
    await service.list(SMM, { ...q, active: false });
    expect(repo.lastFilters?.active).toBe(true);
  });

  it("task-only staff can't read templates", async () => {
    expect(await codeOf(service.list(EDITOR, q))).toBe("FORBIDDEN");
  });

  it("an inactive template is a 404 for a manager, visible to the Admin", async () => {
    expect(await codeOf(service.get(SMM, "t2"))).toBe("STAGE_TEMPLATE_NOT_FOUND");
    expect((await service.get(ADMIN, "t2")).id).toBe("t2");
  });

  it("creates with trimmed stages in order, and refuses duplicates", async () => {
    const t = await service.create(ADMIN, { name: "Reel", stages: [" Script ", "Shoot", "Edit"], kind: "event" });
    expect(t.stages.map((s) => s.name)).toEqual(["Script", "Shoot", "Edit"]);
    expect(events[0]).toMatchObject({ action: "stage_template.created", metadata: { stages: 3, kind: "event" } });
    expect(await codeOf(service.create(ADMIN, { name: "X", stages: ["A", "a"], kind: "event" }))).toBe("STAGE_TEMPLATE_STAGES_INVALID");
  });

  it("an edit replaces the stage list (reorder), deactivates, and checks the version", async () => {
    const t = await service.update("t1", { stages: ["Shoot", "Planned"], active: false, version: 1 });
    expect(t).toMatchObject({ active: false, version: 2 });
    expect(t.stages.map((s) => s.name)).toEqual(["Shoot", "Planned"]);
    expect(events[0]).toMatchObject({ action: "stage_template.updated", metadata: { fields: ["stages", "active"] } });
    expect(await codeOf(service.update("t1", { name: "Y", version: 1 }))).toBe("STAGE_TEMPLATE_MODIFIED");
    expect(await codeOf(service.update("t1", { version: 2 }))).toBe("VALIDATION_NO_FIELDS");
  });
});

describe("task templates (round 2)", () => {
  let repo: FakeRepo;
  let service: StageTemplatesService;
  const q = { limit: 50, offset: 0, search: undefined, active: undefined, kind: undefined, role: undefined };

  beforeEach(() => {
    repo = new FakeRepo();
    service = new StageTemplatesService(repo, { record: () => Promise.resolve() });
  });

  it("a manager reads task templates (active only) with kind=task; the role filter implies the kind", async () => {
    await service.list(SMM, { ...q, kind: "task" });
    expect(repo.lastFilters).toMatchObject({ kind: "task", active: true });
    await service.list(SMM, { ...q, role: "editor" });
    expect(repo.lastFilters).toMatchObject({ kind: "task", role: "editor" });
    expect((await service.get(SMM, "k1")).id).toBe("k1");
  });

  it("task-only staff are refused task templates too", async () => {
    expect(await codeOf(service.list(EDITOR, { ...q, kind: "task" }))).toBe("FORBIDDEN");
  });

  it("creates a task template with roles; roles on an event template, or Admin, are 400 STAGE_TEMPLATE_ROLES_INVALID", async () => {
    const t = await service.create(ADMIN, { name: "Caption writing", stages: ["Draft", "Review"], kind: "task", roles: ["content_writer", "content_writer"] });
    expect(t).toMatchObject({ kind: "task", roles: ["content_writer"] });
    expect(await codeOf(service.create(ADMIN, { name: "X", stages: ["A"], kind: "event", roles: ["editor"] }))).toBe("STAGE_TEMPLATE_ROLES_INVALID");
    expect(await codeOf(service.create(ADMIN, { name: "X", stages: ["A"], kind: "task", roles: ["admin"] }))).toBe("STAGE_TEMPLATE_ROLES_INVALID");
  });

  it("an edit changes a task template's roles (audited as a field) but never on an event template", async () => {
    const t = await service.update("k1", { roles: ["editor", "developer"], version: 1 });
    expect(t.roles).toEqual(["editor", "developer"]);
    expect(await codeOf(service.update("t1", { roles: ["editor"], version: 1 }))).toBe("STAGE_TEMPLATE_ROLES_INVALID");
    expect(await codeOf(service.update("k1", { roles: [], version: 2 }))).toBeNull();
  });
});
