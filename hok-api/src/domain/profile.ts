import type { Role } from "./roles";

/** The authenticated caller's identity + role -- attached to every request by common/middleware/auth.middleware.ts. */
export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  /** IANA time zone the user works in (e.g. "Asia/Kolkata"); times are shown to them in this zone. */
  timeZone: string;
  /** Optional contact number, free-form but validated (see domain/contact.ts). */
  phone: string | null;
  /** Optional photo URL (a link -- HOK stores no files). */
  avatarUrl: string | null;
  active: boolean;
  createdAt: string;
}
