import { z } from "zod";
import { PHONE_MAX_LENGTH, URL_MAX_LENGTH, isValidHttpUrl, isValidPhone, isValidTimeZone } from "../../../../domain";

/**
 * PATCH /auth/me -- the fields a user may change on their OWN profile
 * (REQUIREMENTS FR-AUTH-05). Role, email and active are deliberately absent:
 * unknown keys are stripped, so `{ role: "admin" }` changes nothing (and, as
 * the only key, is a 400 VALIDATION_NO_FIELDS). Only the Admin changes those,
 * through /users/:id.
 *
 * phone / avatarUrl: a string sets it; `null` or "" clears it.
 */
export const updateOwnProfileDtoSchema = z.object({
  fullName: z.string().trim().min(1, "Please enter your name").max(120).optional(),
  timeZone: z.string().trim().refine(isValidTimeZone, "Must be an IANA time zone, e.g. Asia/Kolkata").optional(),
  phone: z
    .string()
    .trim()
    .max(PHONE_MAX_LENGTH)
    .nullable()
    
    .transform((v) => (v === "" ? null : v)).optional()
    .refine((v) => v == null || isValidPhone(v), "Enter a valid phone number"),
  avatarUrl: z
    .string()
    .trim()
    .max(URL_MAX_LENGTH)
    .nullable()
    
    .transform((v) => (v === "" ? null : v)).optional()
    .refine((v) => v == null || isValidHttpUrl(v), "Must be an http(s) link"),
});

export type UpdateOwnProfileDto = z.infer<typeof updateOwnProfileDtoSchema>;
