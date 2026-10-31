import { BadRequestError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import { getCapabilityScope, type Role } from "../../../domain";
import {
  assertAssetVersion,
  assertAssetVisible,
  assertClientUsable,
  assertClientWritable,
  assertEventLinkable,
  assertRange,
  type AssetScope,
} from "../domain/asset.rules";
import type { AssetFields } from "../domain/asset.entity";
import { toAssetResponseDto } from "../api/asset.presenter";
import type { AssetChanges, AssetsRepositoryPort } from "./ports/assets-repository.port";
import type { LinkPreviewerPort } from "./ports/link-previewer.port";
import type { AssetListResponseDto, AssetResponseDto, TagListResponseDto } from "../api/dto/asset.response.dto";
import type { AssetQueryDto, CreateAssetDto, DeleteAssetQuery, TagQueryDto, UpdateAssetDto } from "../api/dto/asset.dto";

export interface AssetsCaller {
  userId: string;
  role: Role;
}

const FIELD_KEYS = ["title", "url", "type", "comment", "eventId"] as const satisfies readonly (keyof AssetFields)[];

/**
 * The asset link library (REQUIREMENTS section 5.5). The route has already
 * checked assets:read / assets:write; this service applies the client's row
 * scope (Admin: all; a manager: assets of clients they own; anything else is
 * a 404) and runs every write's rules against the locked row.
 */
export class AssetsService {
  constructor(
    private readonly repo: AssetsRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
    /** Background link previews (FR-AST-08); a no-op unless the composition root passes the real one. */
    private readonly previewer: LinkPreviewerPort = { refresh: () => undefined },
  ) {}

  private scopeOf(caller: AssetsCaller): AssetScope {
    const scope = getCapabilityScope(caller.role, "assets:read");
    if (scope === true) return { kind: "all" };
    if (scope === "own") return { kind: "own", userId: caller.userId };
    throw new ForbiddenError("Your role has no access to assets");
  }

  async list(caller: AssetsCaller, query: AssetQueryDto): Promise<AssetListResponseDto> {
    const scope = this.scopeOf(caller);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    assertRange(from, to);
    const filters = {
      // A manager's list is their own clients' assets, full stop: their ownerId filter is ignored.
      ownerId: scope.kind === "all" ? query.ownerId : scope.userId,
      clientId: query.clientId,
      eventId: query.eventId,
      search: query.search,
      type: query.type,
      tag: query.tag,
      from,
      to,
    };
    const page = { limit: query.limit, offset: query.offset };
    const [rows, total] = await Promise.all([this.repo.findMany(filters, page), this.repo.countMany(filters)]);
    return { assets: rows.map(toAssetResponseDto), total, limit: page.limit, offset: page.offset };
  }

  async get(caller: AssetsCaller, id: string): Promise<AssetResponseDto> {
    const asset = await this.repo.findById(id);
    assertAssetVisible(this.scopeOf(caller), asset);
    return toAssetResponseDto(asset!);
  }

  /** FR-AST-03: reusable tags, matched anywhere in the name; one client's or all of the caller's. */
  async suggestTags(caller: AssetsCaller, query: TagQueryDto): Promise<TagListResponseDto> {
    const scope = this.scopeOf(caller);
    const tags = await this.repo.suggestTags({
      ownerId: scope.kind === "all" ? undefined : scope.userId,
      clientId: query.clientId,
      q: query.q,
      limit: query.limit,
    });
    return { tags };
  }

  async create(caller: AssetsCaller, dto: CreateAssetDto): Promise<AssetResponseDto> {
    const scope = this.scopeOf(caller);
    const client = assertClientUsable(scope, await this.repo.findClient(dto.clientId));
    const eventId = dto.eventId ?? null;
    if (eventId) assertEventLinkable(client.id, await this.repo.findEvent(eventId));

    const id = await this.repo.create(
      {
        clientId: client.id,
        title: dto.title,
        url: dto.url,
        type: dto.type,
        comment: dto.comment ?? null,
        eventId,
        tags: dto.tags ?? [],
        createdBy: caller.userId,
      },
      // Re-checked on the locked client row: it may have been archived or reassigned since the read above.
      (locked) => void assertClientUsable(scope, locked),
    );
    await this.audit.record({
      action: AUDIT_ACTIONS.ASSET_CREATED,
      entityType: AUDIT_ENTITIES.ASSET,
      entityId: id,
      metadata: { clientId: client.id },
    });
    this.previewer.refresh(id, dto.url);
    return this.getOrThrow(id);
  }

  async update(caller: AssetsCaller, id: string, dto: UpdateAssetDto): Promise<AssetResponseDto> {
    const fields: Partial<AssetFields> = {};
    for (const key of FIELD_KEYS) {
      if (dto[key] !== undefined) (fields as Record<string, unknown>)[key] = dto[key];
    }
    const changed = [...Object.keys(fields), ...(dto.tags !== undefined ? ["tags"] : [])];
    if (changed.length === 0) throw new BadRequestError("No fields to update", ERROR_CODES.VALIDATION_NO_FIELDS);

    const scope = this.scopeOf(caller);
    // The event must belong to the asset's own client; events never change client, so checking before the lock is safe.
    let eventToLink: Awaited<ReturnType<AssetsRepositoryPort["findEvent"]>> | undefined;
    if (fields.eventId) eventToLink = await this.repo.findEvent(fields.eventId);

    const asset = await this.repo.update(id, (current) => {
      // Visibility before version, so a stale version on someone else's asset is still a 404.
      assertAssetVisible(scope, current);
      assertAssetVersion(current.version, dto.version);
      assertClientWritable(current.clientStatus);
      if (fields.eventId) assertEventLinkable(current.clientId, eventToLink ?? null);
      const changes: AssetChanges = { fields };
      if (dto.tags !== undefined) changes.tags = dto.tags;
      return changes;
    });
    await this.audit.record({ action: AUDIT_ACTIONS.ASSET_UPDATED, entityType: AUDIT_ENTITIES.ASSET, entityId: id, metadata: { fields: changed } });
    if (fields.url !== undefined) this.previewer.refresh(id, asset.url);
    return toAssetResponseDto(asset);
  }

  /** FR-AST-06: soft delete -- hidden everywhere, row kept. */
  async remove(caller: AssetsCaller, id: string, query: DeleteAssetQuery): Promise<void> {
    const scope = this.scopeOf(caller);
    await this.repo.update(id, (current) => {
      assertAssetVisible(scope, current);
      assertAssetVersion(current.version, query.version);
      assertClientWritable(current.clientStatus);
      return { deleted: true };
    });
    await this.audit.record({ action: AUDIT_ACTIONS.ASSET_DELETED, entityType: AUDIT_ENTITIES.ASSET, entityId: id });
  }

  private async getOrThrow(id: string): Promise<AssetResponseDto> {
    const asset = await this.repo.findById(id);
    if (!asset) throw new NotFoundError("Asset not found", ERROR_CODES.ASSET_NOT_FOUND);
    return toAssetResponseDto(asset);
  }
}
