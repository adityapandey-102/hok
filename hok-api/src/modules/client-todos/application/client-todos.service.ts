import { BadRequestError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import { getCapabilityScope, type Role } from "../../../domain";
import {
  assertClientUsable,
  assertClientVisible,
  assertClientWritable,
  assertDueRange,
  assertEventLinkable,
  assertTodoVersion,
  assertTodoVisible,
  completionChange,
  type ClientTodoScope,
} from "../domain/client-todo.rules";
import type { ClientTodoFields } from "../domain/client-todo.entity";
import { toClientTodoResponseDto } from "../api/client-todo.presenter";
import type { ClientTodoChanges, ClientTodoListFilters, ClientTodosRepositoryPort } from "./ports/client-todos-repository.port";
import type { ClientTodoListResponseDto, ClientTodoResponseDto } from "../api/dto/client-todo.response.dto";
import type { ClientTodoQueryDto, CreateClientTodoDto, DeleteClientTodoQuery, UpdateClientTodoDto } from "../api/dto/client-todo.dto";

export interface ClientTodosCaller {
  userId: string;
  role: Role;
}

const FIELD_KEYS = ["title", "description", "dueAt", "priority", "status", "eventId"] as const satisfies readonly (keyof ClientTodoFields)[];

/**
 * Client to-do lists (REQUIREMENTS section 5.4). The route has already checked
 * clients:read / clients:write; this service applies the client's row scope
 * (Admin: all; a manager: to-dos of clients they own; anything else is a 404)
 * and runs every write's rules against the locked row.
 */
export class ClientTodosService {
  constructor(
    private readonly repo: ClientTodosRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private scopeOf(caller: ClientTodosCaller): ClientTodoScope {
    const scope = getCapabilityScope(caller.role, "clients:read");
    if (scope === true) return { kind: "all" };
    if (scope === "own") return { kind: "own", userId: caller.userId };
    throw new ForbiddenError("Your role has no access to client to-dos");
  }

  async list(caller: ClientTodosCaller, clientId: string, query: ClientTodoQueryDto): Promise<ClientTodoListResponseDto> {
    const scope = this.scopeOf(caller);
    assertClientVisible(scope, await this.repo.findClient(clientId));
    const dueFrom = query.dueFrom ? new Date(query.dueFrom) : undefined;
    const dueTo = query.dueTo ? new Date(query.dueTo) : undefined;
    assertDueRange(dueFrom, dueTo);
    const filters: ClientTodoListFilters = {
      clientId,
      status: query.status === "all" ? undefined : query.status,
      // No status = the open list (not done); "all" = every status.
      openOnly: !query.status,
      priority: query.priority,
      overdue: query.overdue,
      now: this.clock().toISOString(),
      dueFrom,
      dueTo,
      search: query.search,
    };
    const page = { limit: query.limit, offset: query.offset };
    const [rows, total] = await Promise.all([this.repo.findMany(filters, page), this.repo.countMany(filters)]);
    return { todos: rows.map(toClientTodoResponseDto), total, limit: page.limit, offset: page.offset };
  }

  async create(caller: ClientTodosCaller, clientId: string, dto: CreateClientTodoDto): Promise<ClientTodoResponseDto> {
    const scope = this.scopeOf(caller);
    const client = assertClientUsable(scope, await this.repo.findClient(clientId));
    const eventId = dto.eventId ?? null;
    if (eventId) assertEventLinkable(client.id, await this.repo.findEvent(eventId));

    const id = await this.repo.create(
      {
        clientId: client.id,
        title: dto.title,
        description: dto.description ?? null,
        dueAt: dto.dueAt ?? null,
        priority: dto.priority ?? "medium",
        eventId,
        createdBy: caller.userId,
      },
      // Re-checked on the locked client row: it may have been archived or reassigned since the read above.
      (locked) => void assertClientUsable(scope, locked),
    );
    await this.audit.record({
      action: AUDIT_ACTIONS.CLIENT_TODO_CREATED,
      entityType: AUDIT_ENTITIES.CLIENT_TODO,
      entityId: id,
      metadata: { clientId: client.id },
    });
    const created = await this.repo.findById(id);
    if (!created) throw new NotFoundError("To-do not found", ERROR_CODES.CLIENT_TODO_NOT_FOUND);
    return toClientTodoResponseDto(created);
  }

  async update(caller: ClientTodosCaller, id: string, dto: UpdateClientTodoDto): Promise<ClientTodoResponseDto> {
    const fields: Partial<ClientTodoFields> = {};
    for (const key of FIELD_KEYS) {
      if (dto[key] !== undefined) (fields as Record<string, unknown>)[key] = dto[key];
    }
    const changed = Object.keys(fields);
    if (changed.length === 0) throw new BadRequestError("No fields to update", ERROR_CODES.VALIDATION_NO_FIELDS);

    const scope = this.scopeOf(caller);
    // The event must belong to the to-do's own client; events never change client, so checking before the lock is safe.
    const eventToLink = fields.eventId ? await this.repo.findEvent(fields.eventId) : null;

    const todo = await this.repo.update(id, (current) => {
      // Visibility before version, so a stale version on someone else's to-do is still a 404.
      assertTodoVisible(scope, current);
      assertTodoVersion(current.version, dto.version);
      assertClientWritable(current.clientStatus);
      if (fields.eventId) assertEventLinkable(current.clientId, eventToLink);
      const changes: ClientTodoChanges = { fields };
      if (fields.status) {
        const completion = completionChange(current.status, fields.status);
        if (completion !== "keep") changes.completion = completion;
      }
      return changes;
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.CLIENT_TODO_UPDATED,
      entityType: AUDIT_ENTITIES.CLIENT_TODO,
      entityId: id,
      metadata: { fields: changed },
    });
    return toClientTodoResponseDto(todo);
  }

  /** Hard delete (to-dos have no history worth keeping; the audit entry is the trace). */
  async remove(caller: ClientTodosCaller, id: string, query: DeleteClientTodoQuery): Promise<void> {
    const scope = this.scopeOf(caller);
    await this.repo.update(id, (current) => {
      assertTodoVisible(scope, current);
      assertTodoVersion(current.version, query.version);
      assertClientWritable(current.clientStatus);
      return { deleted: true };
    });
    await this.audit.record({ action: AUDIT_ACTIONS.CLIENT_TODO_DELETED, entityType: AUDIT_ENTITIES.CLIENT_TODO, entityId: id });
  }
}

