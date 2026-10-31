import { z } from "zod";

export const passwordResetRequestDtoSchema = z.object({
  email: z.string().trim().max(254).email(),
});

export type PasswordResetRequestDto = z.infer<typeof passwordResetRequestDtoSchema>;
