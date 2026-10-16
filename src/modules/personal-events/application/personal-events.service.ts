import { BadRequestError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import { getCapabilityScope, type Role } from "../../../domain";
import {
  assertClientLinkable,
  assertPersonalTimes,
  assertPersonalVersion,
  assertPersonalVisible,
  resolveCalendarRange,
  type PersonalScope,
} from "../domain/personal-event.rules";
import type { PersonalEventEntity } from "../domain/personal-event.entity";
import type { PersonalEventChanges, PersonalEventsRepositoryPort } from "./ports/personal-events-repository.port";
import type { CreatePersonalEventDto, PersonalEventQueryDto, UpdatePersonalEventDto } from "../api/dto/personal-event.dto";

export interface PersonalEventsCaller {
  userId: string;
  role: Role;
  /** The caller's profile zone: the default for new entries. */
  timeZone: string;
}

const EDITABLE = ["title", "startsAt", "endsAt", "timeZone", "description", "clientId"] as const;

/**
 * Personal calendar entries (FR-CAL-02/03). personal_events:manage: the
 * Admin sees and edits every owner's; a manager only their own (others' are
 * 404). New entries always belong to the caller. A linked client must be one
 * of the ENTRY OWNER's clients.
 */
export class PersonalEventsService {
  constructor(
    private readonly repo: PersonalEventsRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
  ) {}

  private scopeOf(caller: PersonalEventsCaller): PersonalScope {
    const scope = getCapabilityScope(caller.role, "personal_events:manage");
    if (scope === true) return { kind: "all" };
    if (scope === "own") return { kind: "own", userId: caller.userId };
    throw new ForbiddenError("Your role has no personal calendar");
  }

  async list(caller: PersonalEventsCaller, query: PersonalEventQueryDto) {
    const scope = this.scopeOf(caller);
    const filters = {
      ownerId: scope.kind === "all" ? query.ownerId : scope.userId,
      clientId: query.clientId,
      range: resolveCalendarRange(query.from, query.to),
    };
    const page = { limit: query.limit, offset: query.offset };
    const [personalEvents, total] = await Promise.all([this.repo.findMany(filters, page), this.repo.countMany(filters)]);
    return { personalEvents, total, limit: page.limit, offset: page.offset };
  }

  async get(caller: PersonalEventsCaller, id: string): Promise<PersonalEventEntity> {
    return assertPersonalVisible(this.scopeOf(caller), await this.repo.findById(id));
  }

  async create(caller: PersonalEventsCaller, dto: CreatePersonalEventDto): Promise<PersonalEventEntity> {
    this.scopeOf(caller);
    assertPersonalTimes(dto.startsAt, dto.endsAt);
    const clientId = dto.clientId ?? null;
    if (clientId) assertClientLinkable(caller.userId, await this.repo.findClientOwner(clientId));

    const id = await this.repo.create({
      ownerId: caller.userId,
      clientId,
      title: dto.title,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      timeZone: dto.timeZone ?? caller.timeZone,
      description: dto.description ?? null,
    });
    await this.audit.record({ action: AUDIT_ACTIONS.PERSONAL_EVENT_CREATED, entityType: AUDIT_ENTITIES.PERSONAL_EVENT, entityId: id });
    return this.getOrThrow(id);
  }

  async update(caller: PersonalEventsCaller, id: string, dto: UpdatePersonalEventDto): Promise<PersonalEventEntity> {
    const changes: PersonalEventChanges = {};
    for (const key of EDITABLE) if (dto[key] !== undefined) (changes as Record<string, unknown>)[key] = dto[key];
    const fields = Object.keys(changes);
    if (fields.length === 0) throw new BadRequestError("No fields to update", ERROR_CODES.VALIDATION_NO_FIELDS);

    // Who owns the client is fixed, so it can be read before the lock; the entry's owner is checked against it inside.
    const linkTo = changes.clientId ? await this.repo.findClientOwner(changes.clientId) : null;
    const scope = this.scopeOf(caller);
    await this.repo.update(id, (current) => {
      assertPersonalVisible(scope, current);
      assertPersonalVersion(current.version, dto.version);
      assertPersonalTimes(changes.startsAt ?? current.startsAt, changes.endsAt ?? current.endsAt);
      if (changes.clientId) assertClientLinkable(current.ownerId, linkTo);
      return changes;
    });
    await this.audit.record({ action: AUDIT_ACTIONS.PERSONAL_EVENT_UPDATED, entityType: AUDIT_ENTITIES.PERSONAL_EVENT, entityId: id, metadata: { fields } });
    return this.getOrThrow(id);
  }

  /** Personal entries are the owner's own notes, so they can be deleted (client events are cancelled instead). */
  async delete(caller: PersonalEventsCaller, id: string): Promise<void> {
    const scope = this.scopeOf(caller);
    await this.repo.delete(id, (current) => void assertPersonalVisible(scope, current));
    await this.audit.record({ action: AUDIT_ACTIONS.PERSONAL_EVENT_DELETED, entityType: AUDIT_ENTITIES.PERSONAL_EVENT, entityId: id });
  }

  private async getOrThrow(id: string): Promise<PersonalEventEntity> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError("Personal event not found", ERROR_CODES.PERSONAL_EVENT_NOT_FOUND);
    return item;
  }
}
