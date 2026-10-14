import type { Role } from "../../../../domain";

/** Response shape returned to the client (GET /users, GET /users/:id). */
export interface UserResponseDto {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  timeZone: string;
  phone: string | null;
  avatarUrl: string | null;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}
