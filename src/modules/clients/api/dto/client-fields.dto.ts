import { z } from "zod";
import { PHONE_MAX_LENGTH, URL_MAX_LENGTH, isValidHttpUrl, isValidPhone, isValidTimeZone } from "../../../../domain";
import { SOCIAL_PLATFORMS } from "../../domain/client.entity";
import {
  CLIENT_LIST_MAX,
  SERVICES_MAX_COUNT,
  SERVICE_MAX_LENGTH,
  SOCIAL_HANDLE_MAX_LENGTH,
  isCalendarDate,
  isValidSocialHandle,
  normalizePhones,
  normalizeServices,
  normalizeSocialAccounts,
  normalizeWebsite,
  normalizeWebsites,
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
    
    .transform((v) => (v === "" ? null : v)).optional();
}

/** Optional value checked by `isValid` after trimming; "" -> null. */
function optionalChecked(max: number, isValid: (v: string) => boolean, message: string) {
  return optionalText(max).refine((v) => v == null || isValid(v), message);
}

const calendarDate = z
  .string()
  .trim()
  .nullable()
  
  .transform((v) => (v === "" ? null : v)).optional()
  .refine((v) => v == null || isCalendarDate(v), "Use a date in YYYY-MM-DD form");

/** Each account: a known platform (the form's drop-down) and a handle or http(s) link. A platform may repeat. */
const socialAccounts = z
  .array(
    z.object({
      platform: z.enum(SOCIAL_PLATFORMS, { message: `Pick a platform: ${SOCIAL_PLATFORMS.join(", ")}` }),
      handle: z
        .string()
        .trim()
        .min(1, "Enter the account's handle or link")
        .max(SOCIAL_HANDLE_MAX_LENGTH)
        .refine(isValidSocialHandle, "Use a handle like @name, or a full https:// link"),
    }),
  )
  .max(CLIENT_LIST_MAX.socialAccounts, `At most ${CLIENT_LIST_MAX.socialAccounts} social accounts`)
  .transform((v) => normalizeSocialAccounts(v));

/** Websites as people type them ("acme.com" is stored as "https://acme.com"). */
const websites = z
  .array(
    z
      .string()
      .trim()
      .max(URL_MAX_LENGTH)
      .refine((v) => normalizeWebsite(v) !== null, "Enter a website such as acme.com or https://acme.com"),
  )
  .max(CLIENT_LIST_MAX.websites, `At most ${CLIENT_LIST_MAX.websites} websites`)
  .transform((v) => normalizeWebsites(v));

const phone = z.string().trim().max(PHONE_MAX_LENGTH).refine(isValidPhone, "Enter a valid phone number");

const phones = z
  .array(phone)
  .max(CLIENT_LIST_MAX.phones, `At most ${CLIENT_LIST_MAX.phones} phone numbers`)
  .transform((v) => normalizePhones(v));

const email = optionalText(254)
  .transform((v) => (v == null ? v : v.toLowerCase()))
  .refine((v) => v == null || z.string().email().safeParse(v).success, "Enter a valid email address")
  .optional();

/** People to talk to: a name, and optionally their own phone and email. */
const contacts = z
  .array(
    z.object({
      name: z.string().trim().min(1, "Enter the contact's name").max(120),
      phone: optionalChecked(PHONE_MAX_LENGTH, isValidPhone, "Enter a valid phone number").transform((v) => v ?? null),
      email: email.transform((v) => v ?? null),
    }),
  )
  .max(CLIENT_LIST_MAX.contacts, `At most ${CLIENT_LIST_MAX.contacts} contacts`);

const services = z
  .array(z.string().trim().max(SERVICE_MAX_LENGTH, `Each service is at most ${SERVICE_MAX_LENGTH} characters`))
  .max(SERVICES_MAX_COUNT, `At most ${SERVICES_MAX_COUNT} services`)
  .transform((v) => normalizeServices(v));

export const clientFieldSchemas = {
  businessName: z.string().trim().min(1, "Please enter the business name").max(160),
  logoUrl: optionalChecked(URL_MAX_LENGTH, isValidHttpUrl, "The logo must be a full http(s) link"),
  industry: optionalText(80),
  email,
  address: optionalText(500),
  websites: websites.optional(),
  phones: phones.optional(),
  contacts: contacts.optional(),
  socialAccounts: socialAccounts.optional(),
  services: services.optional(),
  contractStart: calendarDate,
  contractEnd: calendarDate,
  timeZone: z.string().trim().refine(isValidTimeZone, "Must be an IANA time zone, e.g. Asia/Kolkata").optional(),
  notes: optionalText(5000),
};
