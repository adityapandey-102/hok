import { and, asc, desc, eq, gt, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { AppError, InternalError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { scanLowerBound } from "../../../domain";
// Cross-module Infrastructure-only reads (ADR 0003): the client, its events,
// their stages and client-visible history, and the link creator's name.
import { clients } from "../../clients/infrastructure/clients.schema";
import { eventStageHistory, eventStages, events } from "../../events/infrastructure/events.schema";
import { profiles } from "../../users/infrastructure/profile.schema";
import { portalLinks } from "./portal.schema";
import { PORTAL_UPDATES_LIMIT, type PortalEvent, type PortalEventDetail, type PortalLinkEntity } from "../domain/portal.entity";
import type { PortalClient } from "../domain/portal.rules";
import type { PortalLinksRepositoryPort, PortalReadRepositoryPort } from "../application/ports/portal-repositories.port";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function guarded<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new InternalError(`Failed to ${what}`, error);
  }
}

// ---------------------------------------------------------------- staff side --

const LINK_SELECT = {
  id: portalLinks.id,
  clientId: portalLinks.clientId,
  active: portalLinks.active,
  createdAt: portalLinks.createdAt,
  createdByName: profiles.fullName,
  revokedAt: portalLinks.revokedAt,
  lastUsedAt: portalLinks.lastUsedAt,
};

async function currentLink(ex: Executor, clientId: string): Promise<PortalLinkEntity | null> {
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
      const [row] = await db.select({ id: clients.id, ownerId: clients.ownerId, status: clients.status }).from(clients).where(eq(clients.id, clientId)).limit(1);
      return row ?? null;
    });
  }

  findCurrent(clientId: string) {
    return guarded("load the portal link", () => currentLink(db, clientId));
  }

  replace(clientId: string, tokenHash: string, createdBy: string, guard: (client: PortalClient) => void) {
    return guarded("generate the portal link", () =>
      db.transaction(async (tx) => {
        const [client] = await tx
          .select({ id: clients.id, ownerId: clients.ownerId, status: clients.status })
          .from(clients)
          .where(eq(clients.id, clientId))
          .for("share");
        if (!client) throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
        guard(client);
        await tx
          .update(portalLinks)
          .set({ active: false, revokedAt: sql`now()` })
          .where(and(eq(portalLinks.clientId, clientId), eq(portalLinks.active, true)));
        await tx.insert(portalLinks).values({ clientId, tokenHash, createdBy });
        return (await currentLink(tx, clientId))!;
      }),
    );
  }

  revoke(clientId: string) {
    return guarded("disable the portal link", async () => {
      const rows = await db
        .update(portalLinks)
        .set({ active: false, revokedAt: sql`now()` })
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

type EventRow = { id: string; startsAt: Date; endsAt: Date; currentStageId: string | null } & Omit<PortalEvent, "startsAt" | "endsAt" | "stages" | "currentStagePosition">;

/** Attaches each event's stage tracker from ONE batched stages query (never a query per event). */
async function withStages(ex: Executor, rows: EventRow[]): Promise<PortalEvent[]> {
  if (rows.length === 0) return [];
  const stageRows = await ex
    .select({ id: eventStages.id, eventId: eventStages.eventId, position: eventStages.position, name: eventStages.name })
    .from(eventStages)
    .where(inArray(eventStages.eventId, rows.map((r) => r.id)))
    .orderBy(asc(eventStages.eventId), asc(eventStages.position));
  const byEvent = new Map<string, typeof stageRows>();
  for (const s of stageRows) byEvent.set(s.eventId, [...(byEvent.get(s.eventId) ?? []), s]);
  return rows.map(({ currentStageId, startsAt, endsAt, ...e }) => {
    const stages = byEvent.get(e.id) ?? [];
    return {
      ...e,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      stages: stages.map((s) => ({ position: s.position, name: s.name })),
      currentStagePosition: stages.find((s) => s.id === currentStageId)?.position ?? 1,
    };
  });
}

/** Every query is pinned to one client id (the one the link opens). Two queries per list: events + their stages. */
export class DrizzlePortalReadRepository implements PortalReadRepositoryPort {
  private list(where: SQL, order: SQL[], limit: number) {
    return guarded("load the client's events", async () => {
      const rows = await db.select(PORTAL_EVENT_SELECT).from(events).where(where).orderBy(...order).limit(limit);
      return withStages(db, rows);
    });
  }

  upcoming(clientId: string, now: Date, limit: number) {
    return this.list(and(eq(events.clientId, clientId), gte(events.endsAt, now))!, [asc(events.startsAt), asc(events.id)], limit);
  }

  recent(clientId: string, now: Date, limit: number) {
    return this.list(and(eq(events.clientId, clientId), lt(events.endsAt, now))!, [desc(events.startsAt), desc(events.id)], limit);
  }

  inRange(clientId: string, from: string, to: string, limit: number) {
    return this.list(
      and(eq(events.clientId, clientId), lt(events.startsAt, new Date(to)), gt(events.endsAt, new Date(from)), gte(events.startsAt, scanLowerBound(from)))!,
      [asc(events.startsAt), asc(events.id)],
      limit,
    );
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
      const [[event], updates] = await Promise.all([
        withStages(db, [row]),
        // FR-POR-06: only moves marked visible to the client; no staff names.
        db
          .select({ stageName: toStage.name, note: eventStageHistory.note, createdAt: eventStageHistory.createdAt })
          .from(eventStageHistory)
          .innerJoin(toStage, eq(toStage.id, eventStageHistory.toStageId))
          .where(and(eq(eventStageHistory.eventId, eventId), eq(eventStageHistory.visibleToClient, true)))
          .orderBy(desc(eventStageHistory.createdAt), desc(eventStageHistory.id))
          .limit(PORTAL_UPDATES_LIMIT),
      ]);
      return { ...event!, updates: updates.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })) };
    });
  }
}
