import type { AuthSession } from "../../../../common/auth/auth-provider";
import type { Profile } from "../../../../domain";
import type { OwnProfileChanges } from "../../domain/own-profile.rules";

export type { AuthSession as AuthTokens } from "../../../../common/auth/auth-provider";

/** What bootstrap needs to create the first Admin -- the time zone is already resolved (DTO value or DEFAULT_TIMEZONE). */
export interface NewAdminRecord {
  email: string;
  password: string;
  fullName: string;
  timeZone: string;
}

/** Persistence contract for the Auth module -- pure data access, no business rules. */
export interface AuthRepositoryPort {
  countAdmins(): Promise<number>;
  /** Runs `fn` while holding a database-wide bootstrap lock, so two first-Admin requests can't both pass the check. */
  withBootstrapLock<T>(fn: () => Promise<T>): Promise<T>;
  /** Creates the auth user with role `admin`; returns the new user id. */
  createAdminUser(record: NewAdminRecord): Promise<string>;
  signInWithPassword(email: string, password: string): Promise<AuthSession>;
  refreshSession(refreshToken: string): Promise<AuthSession>;
  signOut(accessToken: string): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(userId: string, newPassword: string): Promise<void>;
  exchangeCodeForSession(code: string): Promise<AuthSession>;
  getProfile(userId: string): Promise<Profile>;
  recordLogin(userId: string): Promise<void>;
  updateOwnProfile(userId: string, changes: OwnProfileChanges): Promise<void>;
}
