import { eq, sql } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
// Cross-module Infrastructure-only read/write: `profiles` is owned by the
// Users module's schema. See docs/adr/0003-per-module-schema-ownership.md.
import { profiles } from "../../users/infrastructure/profile.schema";
import { fetchActiveProfile } from "../../../common/database/profiles";
import { InternalError } from "../../../common/errors/app-error";
import type { AuthProvider, AuthSession } from "../../../common/auth/auth-provider";
import type { Profile } from "../../../domain";
import type { AuthRepositoryPort, NewAdminRecord } from "../application/ports/auth-repository.port";
import type { OwnProfileChanges } from "../domain/own-profile.rules";

/**
 * Persistence (`profiles`, via Drizzle) + the Auth module's use of
 * AuthProvider -- this repository is the one place those two seams meet for
 * auth-specific concerns, same as DrizzleUsersRepository.
 */
export class DrizzleAuthRepository implements AuthRepositoryPort {
  constructor(private readonly authProvider: AuthProvider) {}

  async countAdmins(): Promise<number> {
    let rows;
    try {
      rows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(profiles)
        .where(eq(profiles.role, "admin"));
    } catch (error) {
      throw new InternalError("Failed to check bootstrap status", error);
    }
    return rows[0]?.count ?? 0;
  }

  withBootstrapLock<T>(fn: () => Promise<T>): Promise<T> {
    // A transaction-scoped advisory lock: a second request waits here, then sees the first Admin's profile.
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hok.auth.bootstrap'))`);
      return fn();
    });
  }

  async createAdminUser(record: NewAdminRecord): Promise<string> {
    // handle_new_user() (supabase/migrations) copies full_name/role/time_zone
    // from the new auth user's metadata into `profiles` -- nothing to insert here.
    return this.authProvider.createUser({ ...record, role: "admin" });
  }

  async signInWithPassword(email: string, password: string): Promise<AuthSession> {
    return this.authProvider.signInWithPassword(email, password);
  }

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    return this.authProvider.refreshSession(refreshToken);
  }

  async signOut(accessToken: string): Promise<void> {
    await this.authProvider.signOut(accessToken);
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    // Never surfaces whether the email exists -- the provider doesn't throw on
    // an unknown address, so the API's response is identical either way.
    await this.authProvider.requestPasswordReset(email, redirectTo);
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    await this.authProvider.setPassword(userId, newPassword);
  }

  async exchangeCodeForSession(code: string): Promise<AuthSession> {
    return this.authProvider.exchangeCodeForSession(code);
  }

  async getProfile(userId: string): Promise<Profile> {
    return fetchActiveProfile(userId);
  }

  async recordLogin(userId: string): Promise<void> {
    try {
      await db.update(profiles).set({ lastLoginAt: new Date() }).where(eq(profiles.id, userId));
    } catch (error) {
      throw new InternalError("Failed to record login", error);
    }
  }

  async updateOwnProfile(userId: string, changes: OwnProfileChanges): Promise<void> {
    const record: Partial<typeof profiles.$inferInsert> = {};
    if (changes.fullName !== undefined) record.fullName = changes.fullName;
    if (changes.timeZone !== undefined) record.timeZone = changes.timeZone;
    if (changes.phone !== undefined) record.phone = changes.phone;
    if (changes.avatarUrl !== undefined) record.avatarUrl = changes.avatarUrl;

    try {
      await db.update(profiles).set(record).where(eq(profiles.id, userId));
    } catch (error) {
      throw new InternalError("Failed to update profile", error);
    }
  }
}
