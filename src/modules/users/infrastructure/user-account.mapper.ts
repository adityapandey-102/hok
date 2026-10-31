import type { Role } from "../../../domain";
import type { UserAccountEntity } from "../domain/user-account.entity";

/** Raw shape returned by the repository's USER_ROW_SELECT projection (pg returns timestamptz as Date). */
export interface UserAccountRow {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  timeZone: string;
  phone: string | null;
  avatarUrl: string | null;
  active: boolean;
  isOwner: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
}

export const UserAccountMapper = {
  toEntity(row: UserAccountRow): UserAccountEntity {
    return {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      role: row.role,
      timeZone: row.timeZone,
      phone: row.phone,
      avatarUrl: row.avatarUrl,
      active: row.active,
      isOwner: row.isOwner,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    };
  },
};
