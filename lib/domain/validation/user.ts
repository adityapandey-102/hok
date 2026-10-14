import { z } from "zod";
import { ROLES } from "../constants/roles";
import { isValidTimeZone } from "../utils/timeZone";

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  fullName: z.string().trim().min(1, "Please enter a full name"),
  role: z.enum(ROLES),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** Own-profile edit (PATCH /auth/me): name, phone (empty clears it), time zone. */
export const updateOwnProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Please enter your name"),
  phone: z.string().trim().max(32, "Phone is too long"),
  timeZone: z
    .string()
    .trim()
    .refine(isValidTimeZone, "Enter a valid time zone, e.g. Asia/Kolkata"),
});

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
