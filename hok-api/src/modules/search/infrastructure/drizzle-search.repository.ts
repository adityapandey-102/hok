import { and, desc, eq, ilike, isNull, or, sql, type SQL, type AnyColumn } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { containsPattern } from "../../../common/database/like-pattern";
import { guarded as guardedQuery } from "../../../common/database/guarded";
// Read-only, Infrastructure-to-Infrastructure (docs/adr/0003): the search
// module owns no table.
import { assets } from "../../assets/infrastructure/assets.schema";
import { clients } from "../../clients/infrastructure/clients.schema";
import { isOnTeam } from "../../clients/infrastructure/client-team.sql";
import { clientTodos } from "../../client-todos/infrastructure/client-todos.schema";
import { events } from "../../events/infrastructure/events.schema";
import { staffTasks } from "../../staff-tasks/infrastructure/staff-tasks.schema";
import type { SearchHit, SearchScope } from "../domain/search.rules";
import type { SearchRepositoryPort } from "../application/ports/search-repository.port";

const guarded = <T>(what: string, run: () => Promise<T>): Promise<T> => guardedQuery(`search ${what}`, run);

/** Starts-with matches first (what people usually mean), then the rest. */
const prefixFirst = (col: AnyColumn, term: string) => sql`(lower(${col}) like lower(${`${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`})) desc`;

const STATUS_WORDS: Record<string, string> = { todo: "To do", in_progress: "In progress", blocked: "Blocked", done: "Done", active: "Active", paused: "Paused", archived: "Archived" };
const word = (s: string) => STATUS_WORDS[s] ?? s;
const dateIn = (d: Date, zone: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: zone }).format(d);

/**
 * Each group: one query, matched through its trigram index (ILIKE '%term%',
 * escaped), scoped like its page (own clients / own tasks for non-admins),
 * capped at `limit`.
 */
export class DrizzleSearchRepository implements SearchRepositoryPort {
  clients(term: string, scope: SearchScope, limit: number) {
    return guarded("clients", async () => {
      const c: SQL[] = [ilike(clients.businessName, containsPattern(term))];
      if (scope.kind === "own") c.push(isOnTeam(clients.id, scope.userId));
      const rows = await db
        .select({ id: clients.id, name: clients.businessName, industry: clients.industry, status: clients.status })
        .from(clients)
        .where(and(...c))
        .orderBy(prefixFirst(clients.businessName, term), desc(clients.updatedAt))
        .limit(limit);
      return rows.map((r): SearchHit => ({ id: r.id, title: r.name, subtitle: [r.industry, word(r.status)].filter(Boolean).join(" · "), url: `/app/clients/${r.id}` }));
    });
  }

  events(term: string, scope: SearchScope, limit: number) {
    return guarded("events", async () => {
      const c: SQL[] = [ilike(events.title, containsPattern(term))];
      if (scope.kind === "own") c.push(isOnTeam(clients.id, scope.userId));
      const rows = await db
        .select({ id: events.id, title: events.title, startsAt: events.startsAt, zone: events.timeZone, client: clients.businessName })
        .from(events)
        .innerJoin(clients, eq(clients.id, events.clientId))
        .where(and(...c))
        .orderBy(prefixFirst(events.title, term), desc(events.startsAt))
        .limit(limit);
      return rows.map((r): SearchHit => ({ id: r.id, title: r.title, subtitle: `${r.client} · ${dateIn(r.startsAt, r.zone)}`, url: `/app/events/${r.id}` }));
    });
  }

  tasks(term: string, scope: SearchScope, limit: number) {
    return guarded("tasks", async () => {
      const c: SQL[] = [ilike(staffTasks.title, containsPattern(term))];
      if (scope.kind === "own") c.push(eq(staffTasks.assigneeId, scope.userId));
      const rows = await db
        .select({ id: staffTasks.id, title: staffTasks.title, status: staffTasks.status, client: clients.businessName })
        .from(staffTasks)
        .leftJoin(clients, eq(clients.id, staffTasks.clientId))
        .where(and(...c))
        .orderBy(prefixFirst(staffTasks.title, term), desc(staffTasks.createdAt))
        .limit(limit);
      return rows.map((r): SearchHit => ({ id: r.id, title: r.title, subtitle: [word(r.status), r.client].filter(Boolean).join(" · "), url: `/app/tasks/${r.id}` }));
    });
  }

  todos(term: string, scope: SearchScope, limit: number) {
    return guarded("to-dos", async () => {
      const c: SQL[] = [ilike(clientTodos.title, containsPattern(term))];
      if (scope.kind === "own") c.push(isOnTeam(clients.id, scope.userId));
      const rows = await db
        .select({ id: clientTodos.id, title: clientTodos.title, status: clientTodos.status, clientId: clients.id, client: clients.businessName })
        .from(clientTodos)
        .innerJoin(clients, eq(clients.id, clientTodos.clientId))
        .where(and(...c))
        .orderBy(prefixFirst(clientTodos.title, term), desc(clientTodos.createdAt))
        .limit(limit);
      return rows.map((r): SearchHit => ({ id: r.id, title: r.title, subtitle: `${word(r.status)} · ${r.client}`, url: `/app/clients/${r.clientId}?tab=todos` }));
    });
  }

  assets(term: string, scope: SearchScope, limit: number) {
    return guarded("assets", async () => {
      const pattern = containsPattern(term);
      const c: SQL[] = [isNull(assets.deletedAt), or(ilike(assets.title, pattern), ilike(assets.comment, pattern))!];
      if (scope.kind === "own") c.push(isOnTeam(clients.id, scope.userId));
      const rows = await db
        .select({ id: assets.id, title: assets.title, type: assets.type, clientId: clients.id, client: clients.businessName })
        .from(assets)
        .innerJoin(clients, eq(clients.id, assets.clientId))
        .where(and(...c))
        .orderBy(prefixFirst(assets.title, term), desc(assets.createdAt))
        .limit(limit);
      return rows.map((r): SearchHit => ({ id: r.id, title: r.title, subtitle: `${r.type} link · ${r.client}`, url: `/app/clients/${r.clientId}?tab=assets` }));
    });
  }
}
