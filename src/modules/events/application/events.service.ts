import { BadRequestError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import { getCapabilityScope, type Role } from "../../../domain";
import {
  assertClientUsable,
  assertClientWritable,
  assertEventTimes,
  assertEventVersion,
  assertEventVisible,
  assertStageMove,
  assertTeamValid,
  assertTemplateUsable,
  resolveRange,
  type EventScope,
} from "../domain/event.rules";
import type { EventDetail, EventSummaryEntity } from "../domain/event.entity";
import type { EventChanges, EventsRepositoryPort } from "./ports/events-repository.port";
import type { CreateEventDto, EventQueryDto, MoveStageDto, UpdateEventDto } from "../api/dto/event.dto";

export interface EventsCaller {
  userId: string;
  role: Role;
}

export interface EventListResult {
  events: EventSummaryEntity[];
  total: number;
  limit: number;
  offset: number;
}

const EDITABLE_KEYS = ["title", "type", "startsAt", "endsAt", "timeZone", "location", "description", "assignedTeam", "state"] as const;

/**
 * Client events (REQUIREMENTS §5.3). The route checks events:read/write; this
 * service applies the client's row scope (Admin: all; a manager: events of
 * clients they own; anything else 404) and runs every write's rules against
 * the locked row. Writes return the fresh detail so the UI needs no re-fetch.
 */
export class EventsService {
  constructor(
    private readonly repo: EventsRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
  ) {}

  private scopeOf(caller: EventsCaller): EventScope {
    const scope = getCapabilityScope(caller.role, "events:read");
    if (scope === true) return { kind: "all" };
    if (scope === "own") return { kind: "own", userId: caller.userId };
    throw new ForbiddenError("Your role has no access to events");
  }

  async list(caller: EventsCaller, query: EventQueryDto): Promise<EventListResult> {
    const scope = this.scopeOf(caller);
    const filters = {
      ownerId: scope.kind === "all" ? query.ownerId : scope.userId,
      clientId: query.clientId,
      range: resolveRange(query.from, query.to),
      state: query.state,
      type: query.type,
      search: query.search,
    };
    const page = { limit: query.limit, offset: query.offset };
    const [events, total] = await Promise.all([this.repo.findMany(filters, page), this.repo.countMany(filters)]);
    return { events, total, limit: page.limit, offset: page.offset };
  }

  async get(caller: EventsCaller, id: string): Promise<EventDetail> {
    return assertEventVisible(this.scopeOf(caller), await this.repo.findDetail(id));
  }

  async create(caller: EventsCaller, dto: CreateEventDto): Promise<EventDetail> {
    const scope = this.scopeOf(caller);
    const client = assertClientUsable(scope, await this.repo.findClient(dto.clientId));
    const template = assertTemplateUsable(await this.repo.findTemplate(dto.templateId));
    assertEventTimes(dto.startsAt, dto.endsAt);
    const team = dto.assignedTeam ?? [];
    if (team.length > 0) assertTeamValid(team, await this.repo.findActiveProfileIds(team));

    const id = await this.repo.create(
      {
        clientId: client.id,
        title: dto.title,
        type: dto.type,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        timeZone: dto.timeZone ?? client.timeZone,
        location: dto.location ?? null,
        description: dto.description ?? null,
        assignedTeam: team,
        templateId: template.id,
        templateName: template.name,
        stageNames: template.stageNames,
        createdBy: caller.userId,
      },
      // Re-checked on the locked client row: it may have been archived or reassigned since the read above.
      (locked) => void assertClientUsable(scope, locked),
    );
    await this.audit.record({
      action: AUDIT_ACTIONS.EVENT_CREATED,
      entityType: AUDIT_ENTITIES.EVENT,
      entityId: id,
      metadata: { clientId: client.id, templateId: template.id },
    });
    return this.detailOrThrow(id);
  }

  async update(caller: EventsCaller, id: string, dto: UpdateEventDto): Promise<EventDetail> {
    const changes: EventChanges = {};
    for (const key of EDITABLE_KEYS) {
      if (dto[key] !== undefined) (changes as Record<string, unknown>)[key] = dto[key];
    }
    const fields = Object.keys(changes);
    if (fields.length === 0) throw new BadRequestError("No fields to update", ERROR_CODES.VALIDATION_NO_FIELDS);
    if (changes.assignedTeam && changes.assignedTeam.length > 0) {
      assertTeamValid(changes.assignedTeam, await this.repo.findActiveProfileIds(changes.assignedTeam));
    }

    const scope = this.scopeOf(caller);
    await this.repo.update(id, (current) => {
      // Visibility before version, so a stale version on someone else's event is still a 404.
      assertEventVisible(scope, current);
      assertEventVersion(current.version, dto.version);
      assertClientWritable(current.clientStatus);
      assertEventTimes(changes.startsAt ?? current.startsAt, changes.endsAt ?? current.endsAt);
      return changes;
    });
    await this.audit.record({ action: AUDIT_ACTIONS.EVENT_UPDATED, entityType: AUDIT_ENTITIES.EVENT, entityId: id, metadata: { fields } });
    return this.detailOrThrow(id);
  }

  /** FR-EVT-06: the move and its history entry are one transaction; the history row is the record (not audit_log). */
  async moveStage(caller: EventsCaller, id: string, dto: MoveStageDto): Promise<EventDetail> {
    const scope = this.scopeOf(caller);
    await this.repo.moveStage(
      id,
      (current, stages) => {
        assertEventVisible(scope, current);
        assertEventVersion(current.version, dto.version);
        assertClientWritable(current.clientStatus);
        return assertStageMove({ state: current.state, currentStageId: current.currentStageId, stages, targetStageId: dto.stageId });
      },
      { note: dto.note ?? null, visibleToClient: dto.visibleToClient, changedBy: caller.userId },
    );
    return this.detailOrThrow(id);
  }

  private async detailOrThrow(id: string): Promise<EventDetail> {
    const detail = await this.repo.findDetail(id);
    if (!detail) throw new NotFoundError("Event not found", ERROR_CODES.EVENT_NOT_FOUND);
    return detail;
  }
}
