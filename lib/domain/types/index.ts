import type { Role } from "../constants/roles";

/** The signed-in staff member, as returned by GET /auth/me. Mirrors hok-api's domain/profile.ts. */
export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  /** IANA time zone the user works in; times are shown to them in this zone. */
  timeZone: string;
  phone?: string | null;
  active: boolean;
  createdAt: string;
}
