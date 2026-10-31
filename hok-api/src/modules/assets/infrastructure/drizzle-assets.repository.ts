import { and, desc, eq, gte, ilike, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { containsPattern } from "../../../common/database/like-pattern";
import { NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
// Cross-module Infrastructure-only reads (ADR 0003): the client an asset
// belongs to, its optional event, and staff names.
import { clients } from "../../clients/infrastructure/clients.schema";
import { isOnTeam, teamIdsOf } from "../../clients/infrastructure/client-team.sql";
import { events } from "../../events/infrastructure/events.schema";
import { profiles } from "../../users/infrastructure/profile.schema";
import { assetTags, assets, tags } from "./assets.schema";
import { AssetMapper, type AssetRow } from "./asset.mapper";
import type { AssetEntity, TagSuggestion } from "../domain/asset.entity";
import type { AssetClient, AssetEvent } from "../domain/asset.rules";
import type {
  AssetChangeDecision,
  AssetListFilters,
  AssetListPage,
  AssetsRepositoryPort,
  NewAssetRecord,
  TagSuggestFilters } from "../application/ports/assets-repository.port";
import { guarded } from "../../../common/database/guarded";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** An asset + its client, event title and creator's name: one query, three joins (never a per-row lookup). */
const ASSET_SELECT = {
  id: assets.id,
  clientId: assets.clientId,
  clientName: clients.businessName,
  teamIds: teamIdsOf(clients.id),
  clientStatus: clients.status,
  eventId: assets.eventId,
  eventTitle: events.title,
  title: assets.title,
  url: assets.url,
  type: assets.type,
  comment: assets.comment,
  previewTitle: assets.previewTitle,
  previewDescription: assets.previewDescription,
  previewImageUrl: assets.previewImageUrl,
  previewSiteName: assets.previewSiteName,
  createdBy: assets.createdBy,
  createdByName: profiles.fullName,
  version: assets.version,
  createdAt: assets.createdAt,
  updatedAt: assets.updatedAt,
};


/** Tag names for a set of assets in ONE query (never per row). */
async function tagsFor(ex: Executor, assetIds: string[]): Promise<Map<string, string[]>> {
  const byAsset = new Map<string, string[]>();
  if (assetIds.length === 0) return byAsset;
  const rows = await ex
    .select({ assetId: assetTags.assetId, name: tags.name })
    .from(assetTags)
    .innerJoin(tags, eq(tags.id, assetTags.tagId))
    .where(inArray(assetTags.assetId, assetIds));
  for (const row of rows) {
    const list = byAsset.get(row.assetId);
    if (list) list.push(row.name);
    else byAsset.set(row.assetId, [row.name]);
  }
  return byAsset;
}

function baseSelect(ex: Executor) {
  return ex
    .select(ASSET_SELECT)
    .from(assets)
    .innerJoin(clients, eq(clients.id, assets.clientId))
    .leftJoin(events, eq(events.id, assets.eventId))
    .leftJoin(profiles, eq(profiles.id, assets.createdBy));
}

async function selectAsset(ex: Executor, id: string, forUpdate = false): Promise<AssetEntity | null> {
  const query = baseSelect(ex)
    .where(and(eq(assets.id, id), isNull(assets.deletedAt)))
    .limit(1);
  // FOR UPDATE OF assets: lock only the asset row (not the client, event or profile).
  const rows: AssetRow[] = forUpdate ? await query.for("update", { of: assets }) : await query;
  const row = rows[0];
  if (!row) return null;
  const tagMap = await tagsFor(ex, [row.id]);
  return AssetMapper.toEntity(row, tagMap.get(row.id) ?? []);
}

/** Finds or creates this client's tags (case-insensitively) and returns their ids. Safe under concurrent inserts. */
async function resolveTagIds(tx: Executor, clientId: string, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  await tx
    .insert(tags)
    .values(names.map((name) => ({ clientId, name })))
    .onConflictDoNothing();
  const rows = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(
      and(
        eq(tags.clientId, clientId),
        inArray(
          sql`lower(${tags.name})`,
          names.map((n) => n.toLowerCase()),
        ),
      ),
    );
  return rows.map((r) => r.id);
}

async function replaceTags(tx: Executor, assetId: string, clientId: string, names: string[]): Promise<void> {
  const ids = await resolveTagIds(tx, clientId, names);
  await tx.delete(assetTags).where(eq(assetTags.assetId, assetId));
  if (ids.length > 0) await tx.insert(assetTags).values(ids.map((tagId) => ({ assetId, tagId })));
}

/**
 * Persistence for assets through Drizzle. A list is one page query + one
 * count + one tags query for the page (constant, never per row), served by
 * the partial indexes in the migration (client/created, type, event, trigram
 * on title and comment, tag name).
 */
export class DrizzleAssetsRepository implements AssetsRepositoryPort {
  /** Shared by findMany and countMany so the page and its total can never disagree. */
  private listConditions(filters: AssetListFilters): SQL | undefined {
    const conditions: SQL[] = [isNull(assets.deletedAt)];
    if (filters.ownerId) conditions.push(isOnTeam(clients.id, filters.ownerId));
    if (filters.clientId) conditions.push(eq(assets.clientId, filters.clientId));
    if (filters.eventId) conditions.push(eq(assets.eventId, filters.eventId));
    if (filters.type) conditions.push(eq(assets.type, filters.type));
    if (filters.from) conditions.push(gte(assets.createdAt, filters.from));
    if (filters.to) conditions.push(lt(assets.createdAt, filters.to));
    if (filters.tag) {
      conditions.push(sql`exists (
        select 1 from ${assetTags} at join ${tags} t on t.id = at.tag_id
        where at.asset_id = ${assets.id} and lower(t.name) = lower(${filters.tag}))`);
    }
    if (filters.search) {
      const pattern = containsPattern(filters.search);
      const match = or(
        ilike(assets.title, pattern),
        ilike(assets.comment, pattern),
        sql`exists (
          select 1 from ${assetTags} at join ${tags} t on t.id = at.tag_id
          where at.asset_id = ${assets.id} and t.name ilike ${pattern})`,
      );
      if (match) conditions.push(match);
    }
    return and(...conditions);
  }

  findMany(filters: AssetListFilters, page: AssetListPage) {
    return guarded("load assets", async () => {
      const rows: AssetRow[] = await baseSelect(db)
        .where(this.listConditions(filters))
        // Newest first; id breaks ties so pages stay stable.
        .orderBy(desc(assets.createdAt), desc(assets.id))
        .limit(page.limit)
        .offset(page.offset);
      const tagMap = await tagsFor(
        db,
        rows.map((r) => r.id),
      );
      return rows.map((row) => AssetMapper.toEntity(row, tagMap.get(row.id) ?? []));
    });
  }

  countMany(filters: AssetListFilters) {
    return guarded("count assets", async () => {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(assets)
        .innerJoin(clients, eq(clients.id, assets.clientId))
        .where(this.listConditions(filters));
      return row?.count ?? 0;
    });
  }

  findById(id: string) {
    return guarded("load the asset", () => selectAsset(db, id));
  }

  findClient(id: string) {
    return guarded("load the client", async (): Promise<AssetClient | null> => {
      const [row] = await db.select({ id: clients.id, teamIds: teamIdsOf(clients.id), status: clients.status }).from(clients).where(eq(clients.id, id)).limit(1);
      return row ?? null;
    });
  }

  findEvent(id: string) {
    return guarded("load the event", async (): Promise<AssetEvent | null> => {
      const [row] = await db.select({ id: events.id, clientId: events.clientId }).from(events).where(eq(events.id, id)).limit(1);
      return row ?? null;
    });
  }

  create(record: NewAssetRecord, guard: (client: AssetClient) => void) {
    return guarded("create the asset", () =>
      db.transaction(async (tx) => {
        const [client] = await tx
          .select({ id: clients.id, teamIds: teamIdsOf(clients.id), status: clients.status })
          .from(clients)
          .where(eq(clients.id, record.clientId))
          .for("share");
        if (!client) throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
        guard(client);

        const [row] = await tx
          .insert(assets)
          .values({
            clientId: record.clientId,
            eventId: record.eventId,
            title: record.title,
            url: record.url,
            type: record.type,
            comment: record.comment,
            createdBy: record.createdBy,
          })
          .returning({ id: assets.id });
        await replaceTags(tx, row!.id, record.clientId, record.tags);
        return row!.id;
      }),
    );
  }

  update(id: string, decide: AssetChangeDecision) {
    return guarded("update the asset", async () => {
      const deleted = await db.transaction(async (tx) => {
        const current = await selectAsset(tx, id, true);
        if (!current) throw new NotFoundError("Asset not found", ERROR_CODES.ASSET_NOT_FOUND);
        const changes = decide(current);

        const set: Partial<typeof assets.$inferInsert> = { ...changes.fields };
        if (changes.deleted) {
          await tx
            .update(assets)
            .set({ deletedAt: sql`now()`, version: sql`${assets.version} + 1` })
            .where(eq(assets.id, id));
          return current;
        }
        if (Object.keys(set).length === 0 && changes.tags === undefined) return null; // nothing to write
        if (changes.tags !== undefined) await replaceTags(tx, id, current.clientId, changes.tags);
        await tx
          .update(assets)
          .set({ ...set, version: sql`${assets.version} + 1` })
          .where(eq(assets.id, id));
        return null;
      });
      // A delete returns the row as it was; an edit re-reads it.
      return deleted ?? (await selectAsset(db, id))!;
    });
  }

  suggestTags(filters: TagSuggestFilters) {
    return guarded("load tag suggestions", async (): Promise<TagSuggestion[]> => {
      const conditions: SQL[] = [isNull(assets.deletedAt)];
      if (filters.ownerId) conditions.push(isOnTeam(clients.id, filters.ownerId));
      if (filters.clientId) conditions.push(eq(tags.clientId, filters.clientId));
      if (filters.q) conditions.push(ilike(tags.name, containsPattern(filters.q)));
      // Tags in use by live assets only, grouped by lower(name) so one name is one suggestion across clients.
      const rows = await db
        .select({ name: sql<string>`min(${tags.name})`, uses: sql<number>`count(*)::int` })
        .from(tags)
        .innerJoin(assetTags, eq(assetTags.tagId, tags.id))
        .innerJoin(assets, eq(assets.id, assetTags.assetId))
        .innerJoin(clients, eq(clients.id, assets.clientId))
        .where(and(...conditions))
        .groupBy(sql`lower(${tags.name})`)
        .orderBy(desc(sql`count(*)`), sql`lower(min(${tags.name}))`)
        .limit(filters.limit);
      return rows;
    });
  }
}
