import { z } from "zod";
import { PHONE_MAX_LENGTH, ROLES, isValidPhone, isValidTimeZone } from "../../../../domain";

/**
 * PATCH /users/:id (Admin). Every field optional; at least one is required
 * (the service answers an empty edit with 400 VALIDATION_NO_FIELDS).
 * `phone: null` (or "") clears it. Email is not editable: it is the sign-in
 * identity, owned by the auth provider.
 */
export const updateUserDtoSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  timeZone: z.string().trim().refine(isValidTimeZone, "Must be an IANA time zone, e.g. Asia/Kolkata").optional(),
  phone: z
    .string()
    .trim()
    .max(PHONE_MAX_LENGTH)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v == null || isValidPhone(v), "Enter a valid phone number"),
  active: z.boolean().optional(),
});

export type UpdateUserDto = z.infer<typeof updateUserDtoSchema>;
