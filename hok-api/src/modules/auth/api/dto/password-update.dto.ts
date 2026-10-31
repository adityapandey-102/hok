import { z } from "zod";

export const passwordUpdateDtoSchema = z.object({
  /** Proves the person, not just a token, is changing it (security audit run 1). */
  currentPassword: z.string().min(1, "Enter your current password").max(200),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export type PasswordUpdateDto = z.infer<typeof passwordUpdateDtoSchema>;
