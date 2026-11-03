import { BadRequestError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import { getCapabilityScope, type Role } from "../../../domain";
import { assertTemplateVersion, normalizeStageNames, normalizeTemplateRoles } from "../domain/stage-template.rules";
import type { StageTemplateEntity, TemplateKind } from "../domain/stage-template.entity";
import type { StageTemplateChanges, StageTemplatesRepositoryPort } from "./ports/stage-templates-repository.port";
import type { CreateStageTemplateDto, StageTemplateQueryDto, UpdateStageTemplateDto } from "../api/dto/stage-template.dto";

export interface StageTemplatesCaller {
  userId: string;
  role: Role;
}

export interface StageTemplateListResult {
  templates: StageTemplateEntity[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Stage templates (FR-EVT-01..03). The Admin (stage_templates:manage) creates
 * and edits them; a manager can only read the ACTIVE ones, to pick one for a new
 * event (events:write) or a new task (staff_tasks:assign, `kind=task`, round 2).
 * Entities are returned as-is: the template shape is already the wire shape
 * (see api/stage-template.presenter.ts).
 */
export class StageTemplatesService {
  constructor(
    private readonly repo: StageTemplatesRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
  ) {}

  private isAdmin(caller: StageTemplatesCaller): boolean {
    return getCapabilityScope(caller.role, "stage_templates:manage") === true;
  }

  /**
   * The kinds this caller may read: the Admin both; anyone else event templates if
   * they create events and task templates if they assign tasks (active only, see
   * list/get). Nobody else reads any.
   */
  private readableKinds(caller: StageTemplatesCaller): TemplateKind[] {
    if (this.isAdmin(caller)) return ["event", "task"];
    const kinds: TemplateKind[] = [];
    if (getCapabilityScope(caller.role, "events:write") !== false) kinds.push("event");
    if (getCapabilityScope(caller.role, "staff_tasks:assign") !== false) kinds.push("task");
    if (kinds.length === 0) throw new ForbiddenError("Your role has no access to stage templates");
    return kinds;
  }

  async list(caller: StageTemplatesCaller, query: StageTemplateQueryDto): Promise<StageTemplateListResult> {
    const readable = this.readableKinds(caller);
    // A role filter is about task templates, so it implies the kind.
    const kind = query.kind ?? (query.role ? "task" : undefined);
    if (kind && !readable.includes(kind)) throw new ForbiddenError("Your role has no access to these stage templates");
    const filters = {
      search: query.search,
      active: this.isAdmin(caller) ? query.active : true,
      // Without a kind, a reader of one kind never gets the other kind's templates.
      kind: kind ?? (readable.length === 1 ? readable[0] : undefined),
      role: query.role,
    };
    const page = { limit: query.limit, offset: query.offset };
    const [templates, total] = await Promise.all([this.repo.findMany(filters, page), this.repo.countMany(filters)]);
    return { templates, total, limit: page.limit, offset: page.offset };
  }

  /** A manager asking for an inactive template gets a 404, as if it didn't exist. */
  async get(caller: StageTemplatesCaller, id: string): Promise<StageTemplateEntity> {
    const readable = this.readableKinds(caller);
    const template = await this.repo.findById(id);
    if (!template || !readable.includes(template.kind) || (!template.active && !this.isAdmin(caller))) {
      throw new NotFoundError("Stage template not found", ERROR_CODES.STAGE_TEMPLATE_NOT_FOUND);
    }
    return template;
  }

  async create(caller: StageTemplatesCaller, dto: CreateStageTemplateDto): Promise<StageTemplateEntity> {
    const template = await this.repo.create({
      name: dto.name,
      stages: normalizeStageNames(dto.stages),
      kind: dto.kind,
      roles: normalizeTemplateRoles(dto.kind, dto.roles ?? []),
      createdBy: caller.userId,
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.STAGE_TEMPLATE_CREATED,
      entityType: AUDIT_ENTITIES.STAGE_TEMPLATE,
      entityId: template.id,
      metadata: { stages: template.stages.length, kind: template.kind },
    });
    return template;
  }

  async update(id: string, dto: UpdateStageTemplateDto): Promise<StageTemplateEntity> {
    const changes: StageTemplateChanges = {};
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.stages !== undefined) changes.stages = normalizeStageNames(dto.stages);
    if (dto.active !== undefined) changes.active = dto.active;
    const fields = [...Object.keys(changes), ...(dto.roles !== undefined ? ["roles"] : [])];
    if (fields.length === 0) throw new BadRequestError("No fields to update", ERROR_CODES.VALIDATION_NO_FIELDS);

    const template = await this.repo.update(id, (current) => {
      assertTemplateVersion(current.version, dto.version);
      // The kind is fixed, so whether roles are allowed is judged on the locked row.
      if (dto.roles !== undefined) changes.roles = normalizeTemplateRoles(current.kind, dto.roles);
      return changes;
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.STAGE_TEMPLATE_UPDATED,
      entityType: AUDIT_ENTITIES.STAGE_TEMPLATE,
      entityId: id,
      metadata: { fields },
    });
    return template;
  }
}
