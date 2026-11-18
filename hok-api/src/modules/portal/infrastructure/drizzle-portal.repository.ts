import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { scanLowerBound } from "../../../domain";
// Cross-module Infrastructure-only reads (ADR 0003): the client, its events,
// their stages and client-visible history, and the link creator's name.
import { clients } from "../../clients/infrastructure/clients.schema";
import { teamIdsOf } from "../../clients/infrastructure/client-team.sql";
import { eventStageHistory, eventStages, events } from "../../events/infrastructure/events.schema";
import { assets } from "../../assets/infrastructure/assets.schema";
// Round 3: the stage approvals the client sees and decides (client-safe reads from the Approvals module).
import { selectPortalAttentionApprovals, selectPortalAwaitingByEvent, selectPortalHistory, selectPortalPending } from "../../approvals/infrastructure/approval-queries";
import { profiles } from "../../users/infrastructure/profile.schema";
import { portalLinks } from "./portal.schema";
import {
  PORTAL_ASSETS_LIMIT,
  PORTAL_ATTENTION_FILES_LIMIT,
  PORTAL_UPDATES_LIMIT,
  type PortalAttention,
  type PortalEvent,
  type PortalEventDetail,
  type PortalLinkRecord,
} from "../domain/portal.entity";
import type { PortalClient } from "../domain/portal.rules";
import type { PortalLinksRepositoryPort, PortalReadRepositoryPort } from "../application/ports/portal-repositories.port";
import { guarded } from "../../../common/database/guarded";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------- staff side --

const LINK_SELECT = {
  id: portalLinks.id,
  clientId: portalLinks.clientId,
  active: portalLinks.active,
  createdAt: portalLinks.createdAt,
  createdByName: profiles.fullName,
  revokedAt: portalLinks.revokedAt,
  lastUsedAt: portalLinks.lastUsedAt,
  token: portalLinks.token,
};

async function currentLink(ex: Executor, clientId: string): Promise<PortalLinkRecord | null> {
  const [row] = await ex
    .select(LINK_SELECT)
    .from(portalLinks)
    .leftJoin(profiles, eq(profiles.id, portalLinks.createdBy))
    .where(eq(portalLinks.clientId, clientId))
    // The active one if any (true sorts first desc), else the newest revoked one.
    .orderBy(desc(portalLinks.active), desc(portalLinks.createdAt))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

/** Link management. Generate = revoke + insert in one transaction; the partial unique index keeps one active link per client. */
export class DrizzlePortalLinksRepository implements PortalLinksRepositoryPort {
  findClient(clientId: string) {
    return guarded("load the client", async (): Promise<PortalClient | null> => {
      const [row] = await db.select({ id: clients.id, ownerId: clients.ownerId, teamIds: teamIdsOf(clients.id), status: clients.status }).from(clients).where(eq(clients.id, clientId)).limit(1);
      return row ?? null;
    });
  }

  findCurrent(clientId: string) {
    return guarded("load the portal link", () => currentLink(db, clientId));
  }

  replace(clientId: string, token: string, tokenHash: string, createdBy: string, guard: (client: PortalClient) => void) {
    return guarded("generate the portal link", () =>
      db.transaction(async (tx) => {
        const [client] = await tx
          .select({ id: clients.id, ownerId: clients.ownerId, teamIds: teamIdsOf(clients.id), status: clients.status })
          .from(clients)
          .where(eq(clients.id, clientId))
          .for("share");
        if (!client) throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
        guard(client);
        await tx
          .update(portalLinks)
          // The old link is off at once, and its stored token is dropped.
          .set({ active: false, revokedAt: sql`now()`, token: null })
          .where(and(eq(portalLinks.clientId, clientId), eq(portalLinks.active, true)));
        await tx.insert(portalLinks).values({ clientId, tokenHash, token, createdBy });
        return (await currentLink(tx, clientId))!;
      }),
    );
  }

  revoke(clientId: string) {
    return guarded("disable the portal link", async () => {
      const rows = await db
        .update(portalLinks)
        .set({ active: false, revokedAt: sql`now()`, token: null })
        .where(and(eq(portalLinks.clientId, clientId), eq(portalLinks.active, true)))
        .returning({ id: portalLinks.id });
      return rows.length > 0;
    });
  }
}

// --------------------------------------------------------------- public side --

/** Exactly the client-safe event columns (no description, team, template, version). */
const PORTAL_EVENT_SELECT = {
  id: events.id,
  title: events.title,
  type: events.type,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  timeZone: events.timeZone,
  location: events.location,
  state: events.state,
  currentStageId: events.currentStageId,
  stageCount: events.stageCount,
};

type EventRow = { id: string; startsAt: Date; endsAt: Date; currentStageId: string | null } & Omit<
  PortalEvent,
  "startsAt" | "endsAt" | "stages" | "currentStagePosition" | "awaitingYourApproval" | "approvalStagePosition" | "fileCount" | "fileStages" | "latestFileAt"
>;

/**
 * Attaches, for ALL the rows at once (three batched queries, never a query per event): each event's stage tracker,
 * the stage a pending CLIENT approval is waiting on, and the shared-file counts (total, per stage, newest).
 * Every query is pinned to this client; only assets marked visible and not deleted are counted.
 */
async function withExtras(ex: Executor, clientId: string, rows: EventRow[]): Promise<PortalEvent[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [stageRows, awaiting, fileRows] = await Promise.all([
    ex
      .select({ id: eventStages.id, eventId: eventStages.eventId, position: eventStages.position, name: eventStages.name })
      .from(eventStages)
      .where(inArray(eventStages.eventId, ids))
      .orderBy(asc(eventStages.eventId), asc(eventStages.position)),
    selectPortalAwaitingByEvent(ex, clientId, ids),
    ex
      .select({
        eventId: assets.eventId,
        position: eventStages.position,
        n: sql<number>`count(*)::int`,
        latest: sql<Date>`max(${assets.createdAt})`.mapWith(assets.createdAt),
      })
      .from(assets)
      .leftJoin(eventStages, eq(eventStages.id, assets.eventStageId))
      .where(and(inArray(assets.eventId, ids), eq(assets.clientId, clientId), eq(assets.visibleToClient, true), isNull(assets.deletedAt)))
      .groupBy(assets.eventId, eventStages.position),
  ]);
  const byEvent = new Map<string, typeof stageRows>();
  for (const s of stageRows) byEvent.set(s.eventId, [...(byEvent.get(s.eventId) ?? []), s]);
  const filesByEvent = new Map<string, { count: number; stages: { position: number; count: number }[]; latest: Date | null }>();
  for (const f of fileRows) {
    if (!f.eventId) continue;
    const e = filesByEvent.get(f.eventId) ?? { count: 0, stages: [], latest: null };
    e.count += f.n;
    if (f.position !== null) e.stages.push({ position: f.position, count: f.n });
    if (f.latest && (!e.latest || f.latest > e.latest)) e.latest = f.latest;
    filesByEvent.set(f.eventId, e);
  }
  return rows.map(({ currentStageId, startsAt, endsAt, ...e }) => {
    const stages = byEvent.get(e.id) ?? [];
    const files = filesByEvent.get(e.id);
    const approvalPosition = awaiting.get(e.id);
    return {
      ...e,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      stages: stages.map((s) => ({ position: s.position, name: s.name })),
      currentStagePosition: stages.find((s) => s.id === currentStageId)?.position ?? 1,
      awaitingYourApproval: approvalPosition !== undefined,
      approvalStagePosition: approvalPosition ?? null,
      fileCount: files?.count ?? 0,
      fileStages: (files?.stages ?? []).sort((x, y) => x.position - y.position),
      latestFileAt: files?.latest?.toISOString() ?? null,
    };
  });
}

/** Every query is pinned to one client id (the one the link opens). Four queries per list: events + stages + approval flags + file counts. */
export class DrizzlePortalReadRepository implements PortalReadRepositoryPort {
  private list(clientId: string, where: SQL, order: SQL[], limit: number) {
    return guarded("load the client's events", async () => {
      const rows = await db.select(PORTAL_EVENT_SELECT).from(events).where(where).orderBy(...order).limit(limit);
      return withExtras(db, clientId, rows);
    });
  }

  upcoming(clientId: string, now: Date, limit: number) {
    return this.list(clientId, and(eq(events.clientId, clientId), gte(events.endsAt, now))!, [asc(events.startsAt), asc(events.id)], limit);
  }

  recent(clientId: string, now: Date, limit: number) {
    return this.list(clientId, and(eq(events.clientId, clientId), lt(events.endsAt, now))!, [desc(events.startsAt), desc(events.id)], limit);
  }

  inRange(clientId: string, from: string, to: string, limit: number) {
    return this.list(
      clientId,
      and(eq(events.clientId, clientId), lt(events.startsAt, new Date(to)), gt(events.endsAt, new Date(from)), gte(events.startsAt, scanLowerBound(from)))!,
      [asc(events.startsAt), asc(events.id)],
      limit,
    );
  }

  /**
   * "Needs your attention": every request waiting for the client (oldest first, max 20) and the files shared since `since`
   * (newest first, max 12). Two capped queries, whatever the number of events. Pinned to this client; only visible, live assets.
   */
  attention(clientId: string, since: Date) {
    return guarded("load what needs the client", async (): Promise<PortalAttention> => {
      const [approvals, files] = await Promise.all([
        selectPortalAttentionApprovals(db, clientId),
        db
          .select({
            id: assets.id,
            title: assets.title,
            url: assets.url,
            type: assets.type,
            eventId: events.id,
            eventTitle: events.title,
            stageName: eventStages.name,
            stagePosition: eventStages.position,
            createdAt: assets.createdAt,
          })
          .from(assets)
          .innerJoin(events, and(eq(events.id, assets.eventId), eq(events.clientId, clientId)))
          .leftJoin(eventStages, eq(eventStages.id, assets.eventStageId))
          .where(and(eq(assets.clientId, clientId), eq(assets.visibleToClient, true), isNull(assets.deletedAt), gte(assets.createdAt, since)))
          .orderBy(desc(assets.createdAt), desc(assets.id))
          .limit(PORTAL_ATTENTION_FILES_LIMIT),
      ]);
      return { approvals, files: files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })) };
    });
  }

  event(clientId: string, eventId: string) {
    return guarded("load the event", async (): Promise<PortalEventDetail | null> => {
      const [row] = await db
        .select(PORTAL_EVENT_SELECT)
        .from(events)
        .where(and(eq(events.id, eventId), eq(events.clientId, clientId)))
        .limit(1);
      if (!row) return null;
      const toStage = eventStages;
      const [[event], updates, sharedAssets, pendingApproval, approvalHistory] = await Promise.all([
        withExtras(db, clientId, [row]),
        // FR-POR-06: only moves marked visible to the client; no staff names.
        db
          .select({ stageName: toStage.name, note: eventStageHistory.note, createdAt: eventStageHistory.createdAt })
          .from(eventStageHistory)
          .innerJoin(toStage, eq(toStage.id, eventStageHistory.toStageId))
          .where(and(eq(eventStageHistory.eventId, eventId), eq(eventStageHistory.visibleToClient, true)))
          .orderBy(desc(eventStageHistory.createdAt), desc(eventStageHistory.id))
          .limit(PORTAL_UPDATES_LIMIT),
        // "Shared with you": only live assets staff marked visible, on THIS client's event. Client-safe columns
        // only -- no comment, tags, preview fields or creator. Served by assets_event_client_visible_idx.
        db
          .select({ id: assets.id, title: assets.title, url: assets.url, type: assets.type, stageName: eventStages.name, stagePosition: eventStages.position, createdAt: assets.createdAt })
          .from(assets)
          .leftJoin(eventStages, eq(eventStages.id, assets.eventStageId))
          .where(and(eq(assets.eventId, eventId), eq(assets.clientId, clientId), eq(assets.visibleToClient, true), isNull(assets.deletedAt)))
          .orderBy(desc(assets.createdAt), desc(assets.id))
          .limit(PORTAL_ASSETS_LIMIT),
        // Round 3: the request waiting for this client, and the decided rounds on stages the client approves.
        selectPortalPending(db, clientId, eventId),
        selectPortalHistory(db, clientId, eventId),
      ]);
      return {
        ...event!,
        updates: updates.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
        assets: sharedAssets.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
        pendingApproval,
        approvalHistory,
      };
    });
  }
}
