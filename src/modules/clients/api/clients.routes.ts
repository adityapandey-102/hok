import { Router, type Request } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody, validateQuery } from "../../../common/http/validate.middleware";
import { uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { ClientsService, type ClientsCaller } from "../application/clients.service";
import { DrizzleClientsRepository } from "../infrastructure/drizzle-clients.repository";
import { clientReassignedPayload, notifier } from "../../notifications/notifications.module";
import type { ClientNotifier } from "../application/ports/client-notifier.port";
import { createClientDtoSchema, type CreateClientDto } from "./dto/create-client.dto";
import {
  clientVersionDtoSchema,
  reassignClientDtoSchema,
  updateClientDtoSchema,
  type ClientVersionDto,
  type ReassignClientDto,
  type UpdateClientDto,
} from "./dto/update-client.dto";
import { clientQueryDtoSchema, type ClientQueryDto } from "./dto/client-query.dto";

/**
 * M9: after a reassignment commits, web push to the new owner (their bell
 * entry was written inside the transaction by the repository).
 */
const clientNotifier: ClientNotifier = {
  clientReassigned: (n) =>
    notifier.push({
      type: "client_reassigned",
      recipientIds: [n.toOwnerId],
      actorId: n.actorId,
      payload: clientReassignedPayload({ clientId: n.clientId, clientName: n.clientName }),
    }),
};

/** Composition root for the Clients module -- wires the concrete (Infrastructure) adapters into the Application service. */
const clientsService = new ClientsService(new DrizzleClientsRepository(), undefined, undefined, clientNotifier);

export const clientsRouter = Router();

// Admin (every client) and Social Media / Marketing Managers (their own);
// task-only staff get 403 here. Row scope is the service's job: another
// manager's client is a 404.
clientsRouter.use(requireAuth, requireCapability("clients:read"));
clientsRouter.param("id", uuidParam(ERROR_CODES.CLIENT_NOT_FOUND, "Client"));

const callerOf = (req: Request): ClientsCaller => ({ userId: req.authUserId!, role: req.profile!.role });

clientsRouter.get(
  "/",
  validateQuery(clientQueryDtoSchema),
  asyncHandler(async (req, res) => {
    res.json(await clientsService.list(callerOf(req), req.query as unknown as ClientQueryDto));
  }),
);

clientsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ client: await clientsService.get(callerOf(req), req.params.id!) });
  }),
);

clientsRouter.post(
  "/",
  requireCapability("clients:write"),
  validateBody(createClientDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ client: await clientsService.create(callerOf(req), req.body as CreateClientDto) });
  }),
);

clientsRouter.patch(
  "/:id",
  requireCapability("clients:write"),
  validateBody(updateClientDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ client: await clientsService.update(callerOf(req), req.params.id!, req.body as UpdateClientDto) });
  }),
);

clientsRouter.post(
  "/:id/archive",
  requireCapability("clients:write"),
  validateBody(clientVersionDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ client: await clientsService.archive(callerOf(req), req.params.id!, req.body as ClientVersionDto) });
  }),
);

clientsRouter.post(
  "/:id/unarchive",
  requireCapability("clients:write"),
  validateBody(clientVersionDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ client: await clientsService.unarchive(callerOf(req), req.params.id!, req.body as ClientVersionDto) });
  }),
);

/** Admin only (FR-CLI-05). */
clientsRouter.post(
  "/:id/reassign",
  requireCapability("clients:reassign"),
  validateBody(reassignClientDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ client: await clientsService.reassign(callerOf(req), req.params.id!, req.body as ReassignClientDto) });
  }),
);
