import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { containsPattern } from "../../../common/database/like-pattern";
import { db } from "../../../common/database/drizzle-client";
import { profiles } from "./profile.schema";
import { InternalError } from "../../../common/errors/app-error";
import { UserAccountMapper, type UserAccountRow } from "./user-account.mapper";
import type { AuthProvider } from "../../../common/auth/auth-provider";
import type { UserAccountEntity } from "../domain/user-account.entity";
import type {
  UsersRepositoryPort,
  NewUserRecord,
  ProfileUpdate,
  UserListFilters,
  UserListPage,
} from "../application/ports/users-repository.port";

/** Exactly the columns a UserAccountEntity needs -- one projection for list and lookup. */
const USER_ROW_SELECT = {
  id: profiles.id,
  fullName: profiles.fullName,
  email: profiles.email,
  role: profiles.role,
  timeZone: profiles.timeZone,
  phone: profiles.phone,
  avatarUrl: profiles.avatarUrl,
  active: profiles.active,
  createdAt: profiles.createdAt,
  lastLoginAt: profiles.lastLoginAt,
};

/**
 * Persistence for staff accounts: `profiles` through Drizzle, identity
 * operations (create, set password, ban) through the AuthProvider seam.
 *
 * Scale note: ~20-50 staff (REQUIREMENTS NFR), so `profiles` stays tiny. The
 * search is a plain ILIKE without a trigram index on purpose; add one only if
 * the table ever grows into the thousands.
 */
export class DrizzleUsersRepository implements UsersRepositoryPort {
  constructor(private readonly authProvider: AuthProvider) {}

  /** Shared by findMany and countMany so the page and its total can never disagree. */
  private listConditions(filters: UserListFilters): SQL | undefined {
    const conditions: SQL[] = [];
    if (filters.search) {
      const term = containsPattern(filters.search);
      conditions.push(or(ilike(profiles.fullName, term), ilike(profiles.email, term))!);
    }
    if (filters.role) conditions.push(eq(profiles.role, filters.role));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async findMany(filters: UserListFilters, page: UserListPage): Promise<UserAccountEntity[]> {
    let rows: UserAccountRow[];
    try {
      rows = await db
        .select(USER_ROW_SELECT)
        .from(profiles)
        .where(this.listConditions(filters))
        // id as a tie-breaker keeps pages stable when two accounts share a created_at.
        .orderBy(asc(profiles.createdAt), asc(profiles.id))
        .limit(page.limit)
        .offset(page.offset);
    } catch (error) {
      throw new InternalError("Failed to load users", error);
    }
    return rows.map((row) => UserAccountMapper.toEntity(row));
  }

  async countMany(filters: UserListFilters): Promise<number> {
    try {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(profiles)
        .where(this.listConditions(filters));
      return row?.count ?? 0;
    } catch (error) {
      throw new InternalError("Failed to count users", error);
    }
  }

  async findById(id: string): Promise<UserAccountEntity | null> {
    let rows: UserAccountRow[];
    try {
      rows = await db.select(USER_ROW_SELECT).from(profiles).where(eq(profiles.id, id)).limit(1);
    } catch (error) {
      throw new InternalError("Failed to load user", error);
    }
    const row = rows[0];
    return row ? UserAccountMapper.toEntity(row) : null;
  }

  async createUser(record: NewUserRecord): Promise<string> {
    // No invite email -- the account is created with a real password straight
    // away; the Admin passes it on directly. handle_new_user() (a DB trigger,
    // see supabase/migrations) copies full_name/role/time_zone from the new
    // auth user's metadata into `profiles` -- nothing to insert here.
    return this.authProvider.createUser(record);
  }

  async updateProfile(id: string, updates: ProfileUpdate): Promise<void> {
    const record: Partial<typeof profiles.$inferInsert> = {};
    if (updates.fullName !== undefined) record.fullName = updates.fullName;
    if (updates.role !== undefined) record.role = updates.role;
    if (updates.timeZone !== undefined) record.timeZone = updates.timeZone;
    if (updates.phone !== undefined) record.phone = updates.phone;
    if (updates.active !== undefined) record.active = updates.active;

    try {
      await db.update(profiles).set(record).where(eq(profiles.id, id));
    } catch (error) {
      throw new InternalError("Failed to update user", error);
    }
  }

  async setPassword(id: string, password: string): Promise<void> {
    await this.authProvider.setPassword(id, password);
  }

  async banAuthUser(id: string): Promise<void> {
    await this.authProvider.banUser(id);
  }

  async unbanAuthUser(id: string): Promise<void> {
    await this.authProvider.unbanUser(id);
  }
}
