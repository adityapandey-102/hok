import { z } from "zod";
import { isValidTimeZone } from "../utils/timeZone";

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31")
  .or(z.literal(""));

/** Light client-side check of the client form; hok-api re-validates and normalises everything. */
export const clientFormSchema = z
  .object({
    businessName: z.string().trim().min(1, "Please enter the business name").max(200, "Business name is too long"),
    email: z.string().trim().email("Enter a valid email address").or(z.literal("")),
    timeZone: z.string().trim().refine(isValidTimeZone, "Enter a valid time zone, e.g. Asia/Kolkata"),
    contractStart: dateOnly,
    contractEnd: dateOnly,
  })
  .refine((v) => !v.contractStart || !v.contractEnd || v.contractStart <= v.contractEnd, {
    path: ["contractEnd"],
    message: "The contract end date can't be before the start date",
  });

/** "Reels, Shoots" -> ["Reels", "Shoots"]. */
export function parseServices(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
