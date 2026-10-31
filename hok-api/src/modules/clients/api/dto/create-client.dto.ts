import { z } from "zod";
import { clientFieldSchemas } from "./client-fields.dto";

/**
 * POST /clients. Only `businessName` is required. The creator owns the new
 * client (FR-CLI-01); the Admin may instead name another active client manager
 * as `ownerId`. A new client always starts `active`.
 */
export const createClientDtoSchema = z.object({
  ...clientFieldSchemas,
  ownerId: z.string().uuid("ownerId must be a user id").optional(),
});

export type CreateClientDto = z.infer<typeof createClientDtoSchema>;
