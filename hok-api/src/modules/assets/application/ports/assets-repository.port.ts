import type { AssetEntity, AssetFields, TagSuggestion } from "../../domain/asset.entity";
import type { AssetClient, AssetEvent } from "../../domain/asset.rules";

/**
 * Server-side list filters. `ownerId` is already resolved by the service from
 * the caller's scope (a manager's own id, or the Admin's optional filter).
 * `from` is inclusive, `to` exclusive.
 */
export interface AssetListFilters {
  ownerId?: string;
  clientId?: string;
  eventId?: string;
  search?: string;
  type?: AssetEntity["type"];
  tag?: string;
  from?: Date;
  to?: Date;
}

export interface AssetListPage {
  limit: number;
  offset: number;
}

export interface TagSuggestFilters {
  ownerId?: string;
  clientId?: string;
  q?: string;
  limit: number;
}

export interface NewAssetRecord extends AssetFields {
  clientId: string;
  tags: string[];
  createdBy: string;
}

/** What one guarded write changes. `deleted: true` is the soft delete. */
export interface AssetChanges {
  fields?: Partial<AssetFields>;
  /** Replaces the whole tag set. */
  tags?: string[];
  deleted?: true;
}

/** Guard callback (needleye's pattern): given the row after the lock, throw or return the changes. */
export type AssetChangeDecision = (current: AssetEntity) => AssetChanges;

/** Persistence contract for the Assets module -- data access only, no business rules. */
export interface AssetsRepositoryPort {
  findMany(filters: AssetListFilters, page: AssetListPage): Promise<AssetEntity[]>;
  countMany(filters: AssetListFilters): Promise<number>;
  /** A live (not soft-deleted) asset, or null. */
  findById(id: string): Promise<AssetEntity | null>;
  findClient(id: string): Promise<AssetClient | null>;
  findEvent(id: string): Promise<AssetEvent | null>;
  /**
   * Inserts the asset and its tags in one transaction. `guard` runs on the
   * locked (FOR SHARE) client row first, so a client archived or reassigned
   * since the service's read is refused. Returns the new id.
   */
  create(record: NewAssetRecord, guard: (client: AssetClient) => void): Promise<string>;
  /**
   * In one transaction: lock the live asset row, call `decide`, apply the
   * changes and bump `version`. Returns the asset as stored afterwards (for a
   * delete: as it was). Throws 404 ASSET_NOT_FOUND if there is no live row.
   */
  update(id: string, decide: AssetChangeDecision): Promise<AssetEntity>;
  suggestTags(filters: TagSuggestFilters): Promise<TagSuggestion[]>;
}
