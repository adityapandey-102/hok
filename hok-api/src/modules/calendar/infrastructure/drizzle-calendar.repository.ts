import { and, asc, eq, gt, gte, lt, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../../common/database/drizzle-client";
import { scanLowerBound } from "../../../domain";
// The Calendar module owns no table: it reads the Events and Personal-events
// modules' tables Infrastructure-to-Infrastructure (ADR 0003), read-only.
import { clients } from "../../clients/infrastructure/clients.schema";
import { isOnTeam } from "../../clients/infrastructure/client-team.sql";
import { eventStages, events } from "../../events/infrastructure/events.schema";
import { personalEvents } from "../../personal-events/infrastructure/personal-events.schema";
// The subscribe link's hash lives on the person's profile (Users' table, ADR 0003).
import { profiles } from "../../users/infrastructure/profile.schema";
import type { CalendarEventItem, CalendarPersonalItem } from "../domain/calendar.entity";
import type {
  CalendarEventFilters,
  CalendarFeedRepositoryPort,
  CalendarPersonalFilters,
  CalendarRange,
  CalendarRepositoryPort,
  FeedOwner } from "../application/ports/calendar-repository.port";
import { guarded } from "../../../common/database/guarded";

const currentStage = alias(eventStages, "current_stage");

/**
 * One query per kind, each: overlap with [from, to), bounded below on
 * starts_at by the 31-day item cap (index-friendly), joined to what a
 * calendar cell shows (client name, current stage), earliest first, capped.
 */
export class DrizzleCalendarRepository implements CalendarRepositoryPort, CalendarFeedRepositoryPort {
  eventsInRange(range: CalendarRange, f: CalendarEventFilters, limit: number) {
    return guarded("load calendar events", async () => {
      const c: SQL[] = [
        lt(events.startsAt, new Date(range.to)),
        gt(events.endsAt, new Date(range.from)),
        gte(events.startsAt, scanLowerBound(range.from)),
      ];
      // Events of clients whose team includes this person (a manager: always themselves).
      if (f.ownerId) c.push(isOnTeam(clients.id, f.ownerId));
      if (f.clientId) c.push(eq(events.clientId, f.clientId));
      if (f.eventType) c.push(eq(events.type, f.eventType));
      if (f.state) c.push(eq(events.state, f.state));
      const rows = await db
        .select({
          id: events.id,
          title: events.title,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
          timeZone: events.timeZone,
          clientId: events.clientId,
          clientName: clients.businessName,
          ownerId: clients.ownerId,
          eventType: events.type,
          state: events.state,
          currentStageName: currentStage.name,
          currentStagePosition: currentStage.position,
          stageCount: events.stageCount,
        })
        .from(events)
        .innerJoin(clients, eq(clients.id, events.clientId))
        .innerJoin(currentStage, eq(currentStage.id, events.currentStageId))
        .where(and(...c))
        .orderBy(asc(events.startsAt), asc(events.id))
        .limit(limit);
      return rows.map(
        (r): CalendarEventItem => ({ kind: "event", ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString() }),
      );
    });
  }

  personalInRange(range: CalendarRange, f: CalendarPersonalFilters, limit: number) {
    return guarded("load calendar entries", async () => {
      const c: SQL[] = [
        eq(personalEvents.ownerId, f.ownerId),
        lt(personalEvents.startsAt, new Date(range.to)),
        gt(personalEvents.endsAt, new Date(range.from)),
        gte(personalEvents.startsAt, scanLowerBound(range.from)),
      ];
      if (f.clientId) c.push(eq(personalEvents.clientId, f.clientId));
      const rows = await db
        .select({
          id: personalEvents.id,
          title: personalEvents.title,
          startsAt: personalEvents.startsAt,
          endsAt: personalEvents.endsAt,
          timeZone: personalEvents.timeZone,
          clientId: personalEvents.clientId,
          clientName: clients.businessName,
          ownerId: personalEvents.ownerId,
        })
        .from(personalEvents)
        .leftJoin(clients, eq(clients.id, personalEvents.clientId))
        .where(and(...c))
        .orderBy(asc(personalEvents.startsAt), asc(personalEvents.id))
        .limit(limit);
      return rows.map(
        (r): CalendarPersonalItem => ({ kind: "personal", ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString() }),
      );
    });
  }

  feedLink(userId: string) {
    return guarded("load the calendar link", async () => {
      const [row] = await db.select({ createdAt: profiles.calendarFeedCreatedAt }).from(profiles).where(eq(profiles.id, userId)).limit(1);
      return row?.createdAt ? { createdAt: row.createdAt.toISOString() } : null;
    });
  }

  setFeedLink(userId: string, tokenHash: string | null) {
    return guarded("save the calendar link", async () => {
      const [row] = await db
        .update(profiles)
        .set({ calendarFeedTokenHash: tokenHash, calendarFeedCreatedAt: tokenHash ? new Date() : null })
        .where(eq(profiles.id, userId))
        .returning({ createdAt: profiles.calendarFeedCreatedAt });
      return row?.createdAt ? { createdAt: row.createdAt.toISOString() } : null;
    });
  }

  /** By hash (partial unique index profiles_calendar_feed_token_idx); a deactivated person's link stops working. */
  findFeedOwner(tokenHash: string): Promise<FeedOwner | null> {
    return guarded("open the calendar link", async () => {
      const [row] = await db
        .select({ userId: profiles.id, role: profiles.role, fullName: profiles.fullName })
        .from(profiles)
        .where(and(eq(profiles.calendarFeedTokenHash, tokenHash), eq(profiles.active, true)))
        .limit(1);
      return row ?? null;
    });
  }
}
