import { z } from "zod";
import { PHONE_MAX_LENGTH, ROLES, isValidPhone, isValidTimeZone } from "../../../../domain";

export const createUserDtoSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  fullName: z.string().trim().min(1, "Please enter a full name").max(120),
  role: z.enum(ROLES),
  /** Optional; defaults to the firm's DEFAULT_TIMEZONE. The person can change it later from their profile. */
  timeZone: z.string().trim().refine(isValidTimeZone, "Must be an IANA time zone, e.g. Asia/Kolkata").optional(),
  phone: z
    .string()
    .trim()
    .max(PHONE_MAX_LENGTH)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || isValidPhone(v), "Enter a valid phone number"),
});

export type CreateUserDto = z.infer<typeof createUserDtoSchema>;
