import { and, asc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { containsPattern } from "../../../common/database/like-pattern";
import { AppError, InternalError } from "../../../common/errors/app-error";
// Cross-module Infrastructure-only read of the Users module's `profiles` (ADR 0003). Owns no table.
import { profiles } from "../../users/infrastructure/profile.schema";
import type { TeamMemberFilters, TeamMembersRepositoryPort } from "../application/team-members.service";

async function guarded<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new InternalError(`Failed to ${what}`, error);
  }
}

/** One page query (three columns only) + one count. `profiles` is ~50 rows: no trigram index needed. */
export class DrizzleTeamMembersRepository implements TeamMembersRepositoryPort {
  private conditions(f: TeamMemberFilters): SQL | undefined {
    const c: SQL[] = [eq(profiles.active, true)];
    if (f.search) c.push(ilike(profiles.fullName, containsPattern(f.search)));
    if (f.role) c.push(eq(profiles.role, f.role));
    return and(...c);
  }

  findActive(filters: TeamMemberFilters, page: { limit: number; offset: number }) {
    return guarded("load team members", () =>
      db
        .select({ id: profiles.id, fullName: profiles.fullName, role: profiles.role })
        .from(profiles)
        .where(this.conditions(filters))
        .orderBy(sql`lower(${profiles.fullName})`, asc(profiles.id))
        .limit(page.limit)
        .offset(page.offset),
    );
  }

  countActive(filters: TeamMemberFilters) {
    return guarded("count team members", async () => {
      const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(profiles).where(this.conditions(filters));
      return row?.count ?? 0;
    });
  }
}
