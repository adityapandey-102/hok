import { and, desc, asc, eq, gt, gte, lt, sql, type SQL } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { AppError, InternalError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { scanLowerBound } from "../../../domain";
// Cross-module Infrastructure-only reads (ADR 0003): owner and client names.
import { profiles } from "../../users/infrastructure/profile.schema";
import { clients } from "../../clients/infrastructure/clients.schema";
import { personalEvents } from "./personal-events.schema";
import type { PersonalEventEntity } from "../domain/personal-event.entity";
import type {
  NewPersonalEvent,
  PersonalEventChanges,
  PersonalEventFilters,
  PersonalEventsRepositoryPort,
} from "../application/ports/personal-events-repository.port";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const SELECT = {
  id: personalEvents.id,
  ownerId: personalEvents.ownerId,
  ownerName: profiles.fullName,
  clientId: personalEvents.clientId,
  clientName: clients.businessName,
  title: personalEvents.title,
  startsAt: personalEvents.startsAt,
  endsAt: personalEvents.endsAt,
  timeZone: personalEvents.timeZone,
  description: personalEvents.description,
  version: personalEvents.version,
  createdAt: personalEvents.createdAt,
  updatedAt: personalEvents.updatedAt,
};

function baseQuery(ex: Executor) {
  return ex
    .select(SELECT)
    .from(personalEvents)
    .innerJoin(profiles, eq(profiles.id, personalEvents.ownerId))
    .leftJoin(clients, eq(clients.id, personalEvents.clientId));
}
type Row = Awaited<ReturnType<typeof baseQuery>>[number];

function toEntity(r: Row): PersonalEventEntity {
  return {
    ...r,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function guarded<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new InternalError(`Failed to ${what}`, error);
  }
}

async function selectOne(ex: Executor, id: string, forUpdate = false): Promise<PersonalEventEntity | null> {
  const q = baseQuery(ex).where(eq(personalEvents.id, id)).limit(1);
  const [row] = forUpdate ? await q.for("update", { of: personalEvents }) : await q;
  return row ? toEntity(row) : null;
}

/** One page query (joined to owner and client names) + one count; ranges bounded on starts_at by the 31-day cap. */
export class DrizzlePersonalEventsRepository implements PersonalEventsRepositoryPort {
  private conditions(f: PersonalEventFilters): SQL | undefined {
    const c: SQL[] = [];
    if (f.ownerId) c.push(eq(personalEvents.ownerId, f.ownerId));
    if (f.clientId) c.push(eq(personalEvents.clientId, f.clientId));
    if (f.range) {
      c.push(lt(personalEvents.startsAt, new Date(f.range.to)), gt(personalEvents.endsAt, new Date(f.range.from)));
      c.push(gte(personalEvents.startsAt, scanLowerBound(f.range.from)));
    }
    return c.length ? and(...c) : undefined;
  }

  findMany(filters: PersonalEventFilters, page: { limit: number; offset: number }) {
    return guarded("load personal events", async () => {
      const order = filters.range ? [asc(personalEvents.startsAt), asc(personalEvents.id)] : [desc(personalEvents.startsAt), desc(personalEvents.id)];
      const rows = await baseQuery(db).where(this.conditions(filters)).orderBy(...order).limit(page.limit).offset(page.offset);
      return rows.map(toEntity);
    });
  }

  countMany(filters: PersonalEventFilters) {
    return guarded("count personal events", async () => {
      const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(personalEvents).where(this.conditions(filters));
      return row?.count ?? 0;
    });
  }

  findById(id: string) {
    return guarded("load the personal event", () => selectOne(db, id));
  }

  findClientOwner(clientId: string) {
    return guarded("load the client", async () => {
      const [row] = await db.select({ ownerId: clients.ownerId }).from(clients).where(eq(clients.id, clientId)).limit(1);
      return row ?? null;
    });
  }

  create(record: NewPersonalEvent) {
    return guarded("create the personal event", async () => {
      const [row] = await db
        .insert(personalEvents)
        .values({ ...record, startsAt: new Date(record.startsAt), endsAt: new Date(record.endsAt) })
        .returning({ id: personalEvents.id });
      return row!.id;
    });
  }

  update(id: string, decide: (current: PersonalEventEntity) => PersonalEventChanges) {
    return guarded("update the personal event", () =>
      db.transaction(async (tx) => {
        const current = await selectOne(tx, id, true);
        if (!current) throw new NotFoundError("Personal event not found", ERROR_CODES.PERSONAL_EVENT_NOT_FOUND);
        const { startsAt, endsAt, ...rest } = decide(current);
        await tx
          .update(personalEvents)
          .set({
            ...rest,
            ...(startsAt !== undefined ? { startsAt: new Date(startsAt) } : {}),
            ...(endsAt !== undefined ? { endsAt: new Date(endsAt) } : {}),
            version: sql`${personalEvents.version} + 1`,
          })
          .where(eq(personalEvents.id, id));
      }),
    );
  }

  delete(id: string, guard: (current: PersonalEventEntity) => void) {
    return guarded("delete the personal event", () =>
      db.transaction(async (tx) => {
        const current = await selectOne(tx, id, true);
        if (!current) throw new NotFoundError("Personal event not found", ERROR_CODES.PERSONAL_EVENT_NOT_FOUND);
        guard(current);
        await tx.delete(personalEvents).where(eq(personalEvents.id, id));
      }),
    );
  }
}
