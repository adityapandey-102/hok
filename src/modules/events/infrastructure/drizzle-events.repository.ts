import { and, asc, desc, eq, gt, gte, ilike, inArray, lt, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../../common/database/drizzle-client";
import { containsPattern } from "../../../common/database/like-pattern";
import { AppError, InternalError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
// Cross-module Infrastructure-only reads (ADR 0003): the client an event
// belongs to, the template it's created from, staff names.
import { clients } from "../../clients/infrastructure/clients.schema";
import { stageTemplateStages, stageTemplates } from "../../stage-templates/infrastructure/stage-templates.schema";
import { profiles } from "../../users/infrastructure/profile.schema";
import { eventStageHistory, eventStages, events } from "./events.schema";
import { EVENT_MAX_DURATION_DAYS, type EventDetail, type EventEntity, type EventStage, type EventSummaryEntity } from "../domain/event.entity";
import type { EventClient, EventTemplate } from "../domain/event.rules";
import type {
  EventChanges,
  EventListFilters,
  EventPage,
  EventsRepositoryPort,
  NewEventRecord,
  StageMoveEntry,
} from "../application/ports/events-repository.port";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** History entries returned with an event, newest first. Older ones stay in the table. */
const HISTORY_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const currentStage = alias(eventStages, "current_stage");

const EVENT_SELECT = {
  id: events.id,
  clientId: events.clientId,
  clientName: clients.businessName,
  ownerId: clients.ownerId,
  clientStatus: clients.status,
  title: events.title,
  type: events.type,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  timeZone: events.timeZone,
  location: events.location,
  description: events.description,
  assignedTeam: events.assignedTeam,
  templateId: events.templateId,
  templateName: events.templateName,
  currentStageId: events.currentStageId,
  stageCount: events.stageCount,
  state: events.state,
  version: events.version,
  createdAt: events.createdAt,
  updatedAt: events.updatedAt,
};

const SUMMARY_SELECT = {
  id: events.id,
  clientId: events.clientId,
  clientName: clients.businessName,
  ownerId: clients.ownerId,
  title: events.title,
  type: events.type,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  timeZone: events.timeZone,
  location: events.location,
  state: events.state,
  templateName: events.templateName,
  currentStageId: events.currentStageId,
  currentStageName: currentStage.name,
  currentStagePosition: currentStage.position,
  stageCount: events.stageCount,
  version: events.version,
};

async function guarded<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new InternalError(`Failed to ${what}`, error);
  }
}

function eventQuery(ex: Executor, id: string) {
  return ex.select(EVENT_SELECT).from(events).innerJoin(clients, eq(clients.id, events.clientId)).where(eq(events.id, id)).limit(1);
}
type EventRow = Awaited<ReturnType<typeof eventQuery>>[number];

/** Row -> entity: Dates to ISO strings. current_stage_id is only null mid-create, inside the creating transaction. */
function toEntity(row: EventRow): EventEntity {
  return {
    ...row,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    currentStageId: row.currentStageId ?? "",
  };
}

async function selectEvent(ex: Executor, id: string, forUpdate = false): Promise<EventEntity | null> {
  // FOR UPDATE OF events: lock the event, not its client.
  const [row] = forUpdate ? await eventQuery(ex, id).for("update", { of: events }) : await eventQuery(ex, id);
  return row ? toEntity(row) : null;
}

async function selectStages(ex: Executor, eventId: string): Promise<EventStage[]> {
  return ex
    .select({ id: eventStages.id, position: eventStages.position, name: eventStages.name })
    .from(eventStages)
    .where(eq(eventStages.eventId, eventId))
    .orderBy(asc(eventStages.position));
}

/**
 * Events through Drizzle. Every list is one page query (joined to the client
 * and the current stage) + one count; a detail is the event + three queries
 * run in parallel (stages, history, team names). The calendar range scan is
 * bounded on starts_at by the 31-day maximum event length.
 */
export class DrizzleEventsRepository implements EventsRepositoryPort {
  private conditions(f: EventListFilters): SQL | undefined {
    const c: SQL[] = [];
    if (f.ownerId) c.push(eq(clients.ownerId, f.ownerId));
    if (f.clientId) c.push(eq(events.clientId, f.clientId));
    if (f.state) c.push(eq(events.state, f.state));
    if (f.type) c.push(eq(events.type, f.type));
    if (f.search) c.push(ilike(events.title, containsPattern(f.search)));
    if (f.range) {
      const from = new Date(f.range.from);
      const to = new Date(f.range.to);
      // Overlap with [from, to) ...
      c.push(lt(events.startsAt, to), gt(events.endsAt, from));
      // ... and, since no event lasts longer than 31 days, an index-friendly lower bound on starts_at.
      c.push(gte(events.startsAt, new Date(from.getTime() - EVENT_MAX_DURATION_DAYS * DAY_MS)));
    }
    return c.length ? and(...c) : undefined;
  }

  findMany(filters: EventListFilters, page: EventPage) {
    return guarded("load events", async () => {
      const order = filters.range ? [asc(events.startsAt), asc(events.id)] : [desc(events.startsAt), desc(events.id)];
      const rows = await db
        .select(SUMMARY_SELECT)
        .from(events)
        .innerJoin(clients, eq(clients.id, events.clientId))
        .innerJoin(currentStage, eq(currentStage.id, events.currentStageId))
        .where(this.conditions(filters))
        .orderBy(...order)
        .limit(page.limit)
        .offset(page.offset);
      return rows.map(
        (r): EventSummaryEntity => ({
          ...r,
          startsAt: r.startsAt.toISOString(),
          endsAt: r.endsAt.toISOString(),
          currentStageId: r.currentStageId ?? "",
        }),
      );
    });
  }

  countMany(filters: EventListFilters) {
    return guarded("count events", async () => {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(events)
        .innerJoin(clients, eq(clients.id, events.clientId))
        .where(this.conditions(filters));
      return row?.count ?? 0;
    });
  }

  findDetail(id: string) {
    return guarded("load the event", async (): Promise<EventDetail | null> => {
      const event = await selectEvent(db, id);
      if (!event) return null;
      const [stages, history, team] = await Promise.all([
        selectStages(db, id),
        db
          .select({
            id: eventStageHistory.id,
            fromStageId: eventStageHistory.fromStageId,
            toStageId: eventStageHistory.toStageId,
            note: eventStageHistory.note,
            visibleToClient: eventStageHistory.visibleToClient,
            changedBy: eventStageHistory.changedBy,
            changedByName: profiles.fullName,
            createdAt: eventStageHistory.createdAt,
          })
          .from(eventStageHistory)
          .leftJoin(profiles, eq(profiles.id, eventStageHistory.changedBy))
          .where(eq(eventStageHistory.eventId, id))
          .orderBy(desc(eventStageHistory.createdAt), desc(eventStageHistory.id))
          .limit(HISTORY_LIMIT),
        event.assignedTeam.length > 0
          ? db.select({ id: profiles.id, fullName: profiles.fullName }).from(profiles).where(inArray(profiles.id, event.assignedTeam))
          : Promise.resolve([]),
      ]);
      return {
        ...event,
        stages,
        history: history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })),
        // In the order the event lists them.
        team: event.assignedTeam.flatMap((tid) => team.filter((t) => t.id === tid)),
      };
    });
  }

  findClient(clientId: string) {
    return guarded("load the client", async (): Promise<EventClient | null> => {
      const [row] = await db
        .select({ id: clients.id, ownerId: clients.ownerId, status: clients.status, timeZone: clients.timeZone })
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      return row ?? null;
    });
  }

  findTemplate(templateId: string) {
    return guarded("load the stage template", async (): Promise<EventTemplate | null> => {
      const [row] = await db
        .select({ id: stageTemplates.id, name: stageTemplates.name, active: stageTemplates.active })
        .from(stageTemplates)
        .where(eq(stageTemplates.id, templateId))
        .limit(1);
      if (!row) return null;
      const stages = await db
        .select({ name: stageTemplateStages.name })
        .from(stageTemplateStages)
        .where(eq(stageTemplateStages.templateId, templateId))
        .orderBy(asc(stageTemplateStages.position));
      return { ...row, stageNames: stages.map((s) => s.name) };
    });
  }

  findActiveProfileIds(ids: readonly string[]) {
    return guarded("check the team", async () => {
      if (ids.length === 0) return new Set<string>();
      const rows = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(and(inArray(profiles.id, [...ids]), eq(profiles.active, true)));
      return new Set(rows.map((r) => r.id));
    });
  }

  create(record: NewEventRecord, guard: (client: EventClient) => void) {
    return guarded("create the event", () =>
      db.transaction(async (tx) => {
        const [client] = await tx
          .select({ id: clients.id, ownerId: clients.ownerId, status: clients.status, timeZone: clients.timeZone })
          .from(clients)
          .where(eq(clients.id, record.clientId))
          .for("share");
        if (!client) throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
        guard(client);

        const [event] = await tx
          .insert(events)
          .values({
            clientId: record.clientId,
            title: record.title,
            type: record.type,
            startsAt: new Date(record.startsAt),
            endsAt: new Date(record.endsAt),
            timeZone: record.timeZone,
            location: record.location,
            description: record.description,
            assignedTeam: record.assignedTeam,
            templateId: record.templateId,
            templateName: record.templateName,
            stageCount: record.stageNames.length,
            createdBy: record.createdBy,
          })
          .returning({ id: events.id });
        const eventId = event!.id;
        // FR-EVT-03: the template's stages are COPIED; later template edits never reach this event.
        const stages = await tx
          .insert(eventStages)
          .values(record.stageNames.map((name, i) => ({ eventId, position: i + 1, name })))
          .returning({ id: eventStages.id, position: eventStages.position });
        const first = stages.find((s) => s.position === 1)!;
        await tx.update(events).set({ currentStageId: first.id }).where(eq(events.id, eventId));
        await tx.insert(eventStageHistory).values({ eventId, fromStageId: null, toStageId: first.id, changedBy: record.createdBy });
        return eventId;
      }),
    );
  }

  update(id: string, decide: (current: EventEntity) => EventChanges) {
    return guarded("update the event", () =>
      db.transaction(async (tx) => {
        const current = await selectEvent(tx, id, true);
        if (!current) throw new NotFoundError("Event not found", ERROR_CODES.EVENT_NOT_FOUND);
        const { startsAt, endsAt, ...rest } = decide(current);
        await tx
          .update(events)
          .set({
            ...rest,
            // A new start time gets its own 2-hour reminder (Phase 2 reminders).
            ...(startsAt !== undefined ? { startsAt: new Date(startsAt), remindedAt: null } : {}),
            ...(endsAt !== undefined ? { endsAt: new Date(endsAt) } : {}),
            version: sql`${events.version} + 1`,
          })
          .where(eq(events.id, id));
      }),
    );
  }

  moveStage(id: string, decide: (current: EventEntity, stages: EventStage[]) => EventStage, entry: StageMoveEntry) {
    return guarded("move the event's stage", () =>
      db.transaction(async (tx) => {
        const current = await selectEvent(tx, id, true);
        if (!current) throw new NotFoundError("Event not found", ERROR_CODES.EVENT_NOT_FOUND);
        const target = decide(current, await selectStages(tx, id));
        await tx
          .update(events)
          .set({ currentStageId: target.id, version: sql`${events.version} + 1` })
          .where(eq(events.id, id));
        await tx.insert(eventStageHistory).values({
          eventId: id,
          fromStageId: current.currentStageId,
          toStageId: target.id,
          note: entry.note,
          visibleToClient: entry.visibleToClient,
          changedBy: entry.changedBy,
        });
      }),
    );
  }
}
