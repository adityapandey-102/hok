import type { Role } from "../../../domain";

/**
 * The minimum a client manager needs to pick people (an event's team, M4):
 * who they are and what they do. Deliberately no email, phone, zone or
 * activity -- the full account view stays Admin-only (GET /users).
 */
export interface TeamMemberEntity {
  id: string;
  fullName: string;
  role: Role;
}
