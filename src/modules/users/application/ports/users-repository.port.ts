import type { Role } from "../../../../domain";
import type { UserAccountEntity } from "../../domain/user-account.entity";

export interface ProfileUpdate {
  fullName?: string;
  role?: Role;
  timeZone?: string;
  phone?: string | null;
  active?: boolean;
}

export interface NewUserRecord {
  email: string;
  fullName: string;
  role: Role;
  timeZone: string;
  password: string;
}

/** Server-side list filters -- `search` matches name OR email (case-insensitive); `role` is an exact match. */
export interface UserListFilters {
  search?: string;
  role?: Role;
}

/** Bounded page window (offset pagination; limit already clamped by the route). */
export interface UserListPage {
  limit: number;
  offset: number;
}

/** Persistence contract for the Users module -- pure data access, no business rules. */
export interface UsersRepositoryPort {
  findMany(filters: UserListFilters, page: UserListPage): Promise<UserAccountEntity[]>;
  countMany(filters: UserListFilters): Promise<number>;
  findById(id: string): Promise<UserAccountEntity | null>;
  /** Creates the auth user (the profiles trigger creates the row); returns the new id. */
  createUser(record: NewUserRecord): Promise<string>;
  updateProfile(id: string, updates: ProfileUpdate): Promise<void>;
  setPassword(id: string, password: string): Promise<void>;
  banAuthUser(id: string): Promise<void>;
  unbanAuthUser(id: string): Promise<void>;
  /** Removes every web-push device of the account (on deactivation). */
  deletePushSubscriptions(id: string): Promise<void>;
}
