import { env } from "../../../config/env";
import { BadRequestError, ForbiddenError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import { getCapabilityScope, type Role } from "../../../domain";
import { assertContractDates } from "../domain/client-profile.rules";
import { assertArchivable, assertEditable, assertUnarchivable, assertVersion } from "../domain/client-status.rules";
import { assertValidOwner, assertVisible, resolveNewOwner, type ClientScope } from "../domain/client-ownership.rules";
import { toClientResponseDto, toClientSummaryResponseDto } from "../api/client.presenter";
import type { ClientProfileFields } from "../domain/client.entity";
import type { ClientChanges, ClientReassignedNotice, ClientsRepositoryPort } from "./ports/clients-repository.port";
import { noopClientNotifier, type ClientNotifier } from "./ports/client-notifier.port";
import type { ClientListResponseDto, ClientResponseDto } from "../api/dto/client.response.dto";
import type { ClientQueryDto } from "../api/dto/client-query.dto";
import type { CreateClientDto } from "../api/dto/create-client.dto";
import type { ClientVersionDto, ReassignClientDto, UpdateClientDto } from "../api/dto/update-client.dto";

/** The signed-in person acting on clients. */
export interface ClientsCaller {
  userId: string;
  role: Role;
}

/** The profile keys a PATCH may carry, in a stable order (also what the audit records). */
const PROFILE_KEYS = [
  "businessName",
  "logoUrl",
  "industry",
  "email",
  "address",
  "websites",
  "phones",
  "contacts",
  "socialAccounts",
  "services",
  "contractStart",
  "contractEnd",
  "timeZone",
  "notes",
] as const satisfies readonly (keyof ClientProfileFields)[];

/**
 * Client portfolio management (REQUIREMENTS §5.2). The route has already
 * checked the capability (clients:read / clients:write / clients:reassign);
 * this service applies the row scope: the Admin sees every client, a Social
 * Media / Marketing Manager only those they own, and anyone else's client is
 * a 404. Every write runs its rules against the locked row (guard callback).
 */
export class ClientsService {
  constructor(
    private readonly repo: ClientsRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
    private readonly defaultTimeZone: string = env.DEFAULT_TIMEZONE,
    private readonly notifier: ClientNotifier = noopClientNotifier,
  ) {}

  /** clients:read and clients:write share one scope today (CLIENT_MANAGERS_OWN in src/domain/capabilities.ts). */
  private scopeOf(caller: ClientsCaller): ClientScope {
    const scope = getCapabilityScope(caller.role, "clients:read");
    if (scope === true) return { kind: "all" };
    if (scope === "own") return { kind: "own", userId: caller.userId };
    throw new ForbiddenError("Your role has no access to clients");
  }

  // -- reading ------------------------------------------------------------------

  async list(caller: ClientsCaller, query: ClientQueryDto): Promise<ClientListResponseDto> {
    const scope = this.scopeOf(caller);
    const filters = {
      // A manager's list is their own clients, full stop: their ownerId filter is ignored.
      ownerId: scope.kind === "all" ? query.ownerId : scope.userId,
      search: query.search,
      status: query.status,
      industry: query.industry,
    };
    const page = { limit: query.limit, offset: query.offset };
    // Page + total in parallel, sharing one filter -- the users list's shape.
    const [rows, total] = await Promise.all([this.repo.findMany(filters, page), this.repo.countMany(filters)]);
    return { clients: rows.map(toClientSummaryResponseDto), total, limit: page.limit, offset: page.offset };
  }

  async get(caller: ClientsCaller, id: string): Promise<ClientResponseDto> {
    return toClientResponseDto(assertVisible(this.scopeOf(caller), await this.repo.findById(id)));
  }

  // -- writing ------------------------------------------------------------------

  async create(caller: ClientsCaller, dto: CreateClientDto): Promise<ClientResponseDto> {
    const scope = this.scopeOf(caller);
    const ownerId = resolveNewOwner(scope, caller.userId, dto.ownerId);
    // The caller is a client manager (the route's capability guarantees it); anyone else must be checked.
    if (ownerId !== caller.userId) assertValidOwner(await this.repo.findOwnerCandidate(ownerId));

    const fields: ClientProfileFields = {
      businessName: dto.businessName,
      logoUrl: dto.logoUrl ?? null,
      industry: dto.industry ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
      websites: dto.websites ?? [],
      phones: dto.phones ?? [],
      contacts: dto.contacts ?? [],
      socialAccounts: dto.socialAccounts ?? [],
      services: dto.services ?? [],
      contractStart: dto.contractStart ?? null,
      contractEnd: dto.contractEnd ?? null,
      timeZone: dto.timeZone ?? this.defaultTimeZone,
      notes: dto.notes ?? null,
    };
    assertContractDates(fields.contractStart, fields.contractEnd);

    const client = await this.repo.create({ ...fields, ownerId });
    await this.audit.record({
      action: AUDIT_ACTIONS.CLIENT_CREATED,
      entityType: AUDIT_ENTITIES.CLIENT,
      entityId: client.id,
      metadata: { ownerId },
    });
    return toClientResponseDto(client);
  }

  async update(caller: ClientsCaller, id: string, dto: UpdateClientDto): Promise<ClientResponseDto> {
    const fields: Partial<ClientProfileFields> = {};
    for (const key of PROFILE_KEYS) {
      if (dto[key] !== undefined) (fields as Record<string, unknown>)[key] = dto[key];
    }
    const changed: string[] = [...Object.keys(fields), ...(dto.status !== undefined ? ["status"] : [])];
    if (changed.length === 0) throw new BadRequestError("No fields to update", ERROR_CODES.VALIDATION_NO_FIELDS);

    const scope = this.scopeOf(caller);
    const client = await this.repo.update(id, (current) => {
      // Order matters: visibility first, so a stale version on someone else's client is still a 404.
      assertVisible(scope, current);
      assertVersion(current.version, dto.version);
      assertEditable(current.status);
      assertContractDates(
        fields.contractStart !== undefined ? fields.contractStart : current.contractStart,
        fields.contractEnd !== undefined ? fields.contractEnd : current.contractEnd,
      );
      const changes: ClientChanges = { fields };
      if (dto.status !== undefined) changes.status = dto.status;
      return changes;
    });

    await this.audit.record({
      action: AUDIT_ACTIONS.CLIENT_UPDATED,
      entityType: AUDIT_ENTITIES.CLIENT,
      entityId: id,
      metadata: { fields: changed },
    });
    return toClientResponseDto(client);
  }

  /** FR-CLI-07: hidden from active lists, data kept. (From M8 this also disables the client's portal link.) */
  async archive(caller: ClientsCaller, id: string, dto: ClientVersionDto): Promise<ClientResponseDto> {
    const scope = this.scopeOf(caller);
    const client = await this.repo.update(id, (current) => {
      assertVisible(scope, current);
      assertVersion(current.version, dto.version);
      assertArchivable(current.status);
      return { status: "archived", archivedAt: "now" };
    });
    await this.audit.record({ action: AUDIT_ACTIONS.CLIENT_ARCHIVED, entityType: AUDIT_ENTITIES.CLIENT, entityId: id });
    return toClientResponseDto(client);
  }

  /** Back to `active` (whatever it was before archiving). */
  async unarchive(caller: ClientsCaller, id: string, dto: ClientVersionDto): Promise<ClientResponseDto> {
    const scope = this.scopeOf(caller);
    const client = await this.repo.update(id, (current) => {
      assertVisible(scope, current);
      assertVersion(current.version, dto.version);
      assertUnarchivable(current.status);
      return { status: "active", archivedAt: null };
    });
    await this.audit.record({ action: AUDIT_ACTIONS.CLIENT_UNARCHIVED, entityType: AUDIT_ENTITIES.CLIENT, entityId: id });
    return toClientResponseDto(client);
  }

  /**
   * FR-CLI-05: the Admin moves a client -- and, because everything under it
   * hangs off client_id, all its data -- to another active client manager.
   * Allowed on an archived client too (ownership isn't part of the profile).
   * Reassigning to the current owner is a no-op: nothing written, no audit.
   * The new owner is notified (M9): bell entry in the same transaction, web
   * push after the commit -- unless the Admin gave the client to themselves.
   */
  async reassign(caller: ClientsCaller, id: string, dto: ReassignClientDto): Promise<ClientResponseDto> {
    if (getCapabilityScope(caller.role, "clients:reassign") !== true) {
      throw new ForbiddenError("Only the Admin can reassign clients");
    }
    assertValidOwner(await this.repo.findOwnerCandidate(dto.ownerId));

    // Filled in by the guard (from the locked row), read after the commit.
    const moved: { from?: string; notice?: ClientReassignedNotice } = {};
    const client = await this.repo.update(id, (current) => {
      assertVisible({ kind: "all" }, current);
      assertVersion(current.version, dto.version);
      if (current.ownerId === dto.ownerId) return {};
      moved.from = current.ownerId;
      if (dto.ownerId !== caller.userId) {
        moved.notice = { clientId: current.id, clientName: current.businessName, toOwnerId: dto.ownerId, actorId: caller.userId };
      }
      return { ownerId: dto.ownerId, reassignedNotice: moved.notice };
    });

    if (moved.from !== undefined) {
      await this.audit.record({
        action: AUDIT_ACTIONS.CLIENT_REASSIGNED,
        entityType: AUDIT_ENTITIES.CLIENT,
        entityId: id,
        metadata: { from: moved.from, to: dto.ownerId },
      });
    }
    if (moved.notice) await this.notifier.clientReassigned(moved.notice);
    return toClientResponseDto(client);
  }
}
