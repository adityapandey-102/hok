import { z } from "zod";
import { isValidTimeZone } from "../../../../domain";

export const bootstrapDtoSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().trim().min(1).max(120),
  /** Optional: the first Admin's IANA time zone. Defaults to DEFAULT_TIMEZONE. */
  timeZone: z.string().trim().refine(isValidTimeZone, "Must be an IANA time zone, e.g. Asia/Kolkata").optional(),
});

export type BootstrapDto = z.infer<typeof bootstrapDtoSchema>;
