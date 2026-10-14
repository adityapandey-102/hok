import { z } from "zod";
import { PHONE_MAX_LENGTH, URL_MAX_LENGTH, isValidHttpUrl, isValidPhone, isValidTimeZone } from "../../../../domain";
import { SOCIAL_PLATFORMS } from "../../domain/client.entity";
import {
  SERVICES_MAX_COUNT,
  SERVICE_MAX_LENGTH,
  SOCIAL_HANDLE_MAX_LENGTH,
  isCalendarDate,
  isValidSocialHandle,
  normalizeServices,
  normalizeSocialHandles,
  normalizeWebsite,
} from "../../domain/client-profile.rules";

/**
 * The client profile fields (FR-CLI-02), validated once and shared by
 * create-client.dto.ts and update-client.dto.ts. Every optional text field
 * follows one convention: a string sets it, and `null` or "" clears it
 * (create stores a cleared field as null).
 */

/** Optional free text: trimmed, capped; "" -> null. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v));
}

/** Optional value checked by `isValid` after trimming; "" -> null. */
function optionalChecked(max: number, isValid: (v: string) => boolean, message: string) {
  return optionalText(max).refine((v) => v == null || isValid(v), message);
}

const calendarDate = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v == null || isCalendarDate(v), "Use a date in YYYY-MM-DD form");

/** Known platforms only (unknown keys are a 400, not silently dropped); each value a handle or http(s) link; "" or null clears that platform. */
const socialHandles = z
  .record(
    z.string(),
    z
      .string()
      .trim()
      .max(SOCIAL_HANDLE_MAX_LENGTH)
      .nullable()
      .refine((v) => v == null || v === "" || isValidSocialHandle(v), "Use a handle like @name, or a full https:// link"),
  )
  .superRefine((value, ctx) => {
    for (const key of Object.keys(value)) {
      if (!(SOCIAL_PLATFORMS as readonly string[]).includes(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `Unknown platform. Use one of: ${SOCIAL_PLATFORMS.join(", ")}` });
      }
    }
  })
  .transform((v) => normalizeSocialHandles(v));

const services = z
  .array(z.string().trim().max(SERVICE_MAX_LENGTH, `Each service is at most ${SERVICE_MAX_LENGTH} characters`))
  .max(SERVICES_MAX_COUNT, `At most ${SERVICES_MAX_COUNT} services`)
  .transform((v) => normalizeServices(v));

/** Website as people type it ("acme.com" is stored as "https://acme.com"). */
const website = optionalText(URL_MAX_LENGTH)
  .refine((v) => v == null || normalizeWebsite(v) !== null, "Enter a website such as acme.com or https://acme.com")
  .transform((v) => (v == null ? v : normalizeWebsite(v)));

export const clientFieldSchemas = {
  businessName: z.string().trim().min(1, "Please enter the business name").max(160),
  logoUrl: optionalChecked(URL_MAX_LENGTH, isValidHttpUrl, "The logo must be a full http(s) link"),
  industry: optionalText(80),
  contactPerson: optionalText(120),
  phone: optionalChecked(PHONE_MAX_LENGTH, isValidPhone, "Enter a valid phone number"),
  email: optionalText(254)
    .transform((v) => (v == null ? v : v.toLowerCase()))
    .refine((v) => v == null || z.string().email().safeParse(v).success, "Enter a valid email address"),
  address: optionalText(500),
  website,
  socialHandles: socialHandles.optional(),
  services: services.optional(),
  contractStart: calendarDate,
  contractEnd: calendarDate,
  timeZone: z.string().trim().refine(isValidTimeZone, "Must be an IANA time zone, e.g. Asia/Kolkata").optional(),
  notes: optionalText(5000),
};
