import { z } from "zod";

export const loginDtoSchema = z.object({
  email: z.string().trim().max(254).email(),
  password: z.string().min(1, "Password is required").max(1024),
  /** Trusted-device token from an earlier login on this browser (common/auth/trusted-device.ts). */
  deviceToken: z.string().max(200).optional(),
});

export type LoginDto = z.infer<typeof loginDtoSchema>;
