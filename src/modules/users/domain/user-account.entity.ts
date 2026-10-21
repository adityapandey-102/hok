import type { Role } from "../../../domain";

/** Pure domain shape for a staff account -- no persistence or HTTP concerns. */
export interface UserAccountEntity {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  /** IANA time zone the person works in. */
  timeZone: string;
  phone: string | null;
  avatarUrl: string | null;
  active: boolean;
  createdAt: string;
  /** Last password sign-in (not a silent refresh); null until their first login. */
  lastLoginAt: string | null;
  /** Last time they used HOK at all (any API call, throttled); null = never (FR-SYS-03). */
  lastSeenAt: string | null;
}
