import { z } from "zod";
import { CLIENT_TEAM_MAX, EDITABLE_CLIENT_STATUSES } from "../../domain/client.entity";
import { clientFieldSchemas } from "./client-fields.dto";

/** The optimistic-lock token from the copy the caller loaded (every client response carries it). */
export const versionSchema = z.number().int().min(1);

/**
 * PATCH /clients/:id. Every profile field optional (at least one required, or
 * 400 VALIDATION_NO_FIELDS); `version` is **required**: an edit form always
 * has the copy it was loaded from, and a stale one is 409 CLIENT_MODIFIED.
 * `status` may only move between active and paused; archiving has its own
 * endpoint. The team and lead are not editable here (PUT /clients/:id/team).
 * Each list sent (`websites`, `phones`, `contacts`, `socialAccounts`,
 * `services`) replaces that whole list.
 */
export const updateClientDtoSchema = z.object({
  ...clientFieldSchemas,
  businessName: clientFieldSchemas.businessName.optional(),
  status: z.enum(EDITABLE_CLIENT_STATUSES).optional(),
  version: versionSchema,
});

export type UpdateClientDto = z.infer<typeof updateClientDtoSchema>;

/** POST /clients/:id/archive and /unarchive. `version` optional (sent by the UI; a stale one is 409). */
export const clientVersionDtoSchema = z.object({ version: versionSchema.optional() });
export type ClientVersionDto = z.infer<typeof clientVersionDtoSchema>;

/**
 * PUT /clients/:id/team (Admin): the whole team and its lead. The lead is
 * added to `memberIds` if missing; duplicates are dropped.
 */
export const setClientTeamDtoSchema = z.object({
  leadId: z.string().uuid("leadId must be a user id"),
  memberIds: z.array(z.string().uuid("Each team member must be a user id")).max(CLIENT_TEAM_MAX, `At most ${CLIENT_TEAM_MAX} people`),
  version: versionSchema.optional(),
});
export type SetClientTeamDto = z.infer<typeof setClientTeamDtoSchema>;
