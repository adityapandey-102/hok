import { Router, type Request } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody, validateQuery } from "../../../common/http/validate.middleware";
import { requireUuidParam, uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { ClientTodosService, type ClientTodosCaller } from "../application/client-todos.service";
import { DrizzleClientTodosRepository } from "../infrastructure/drizzle-client-todos.repository";
import {
  clientTodoQueryDtoSchema,
  createClientTodoDtoSchema,
  deleteClientTodoQuerySchema,
  updateClientTodoDtoSchema,
  type ClientTodoQueryDto,
  type CreateClientTodoDto,
  type UpdateClientTodoDto,
} from "./dto/client-todo.dto";

/** Composition root for the Client to-dos module. */
const service = new ClientTodosService(new DrizzleClientTodosRepository());

const callerOf = (req: Request): ClientTodosCaller => ({ userId: req.authUserId!, role: req.profile!.role });

/**
 * /clients/:clientId/todos -- one client's list and create. Admin (every
 * client) and SMM / MM (clients they own; others' are 404 CLIENT_NOT_FOUND);
 * task-only staff get 403. Writes need clients:write. Mounted before
 * /clients so the nested path never reaches the clients router.
 */
export const clientTodosByClientRouter = Router({ mergeParams: true });
clientTodosByClientRouter.use(requireAuth, requireCapability("clients:read"));
clientTodosByClientRouter.use(requireUuidParam("clientId", ERROR_CODES.CLIENT_NOT_FOUND, "Client"));

clientTodosByClientRouter.get(
  "/",
  validateQuery(clientTodoQueryDtoSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.list(callerOf(req), req.params.clientId!, req.query as unknown as ClientTodoQueryDto));
  }),
);

clientTodosByClientRouter.post(
  "/",
  requireCapability("clients:write"),
  validateBody(createClientTodoDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ todo: await service.create(callerOf(req), req.params.clientId!, req.body as CreateClientTodoDto) });
  }),
);

/** /client-todos/:id -- edit and delete one to-do; the row scope is its client's owner (a miss is 404). */
export const clientTodosRouter = Router();
clientTodosRouter.use(requireAuth, requireCapability("clients:read"));
clientTodosRouter.param("id", uuidParam(ERROR_CODES.CLIENT_TODO_NOT_FOUND, "To-do"));

clientTodosRouter.patch(
  "/:id",
  requireCapability("clients:write"),
  validateBody(updateClientTodoDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ todo: await service.update(callerOf(req), req.params.id!, req.body as UpdateClientTodoDto) });
  }),
);

clientTodosRouter.delete(
  "/:id",
  requireCapability("clients:write"),
  validateQuery(deleteClientTodoQuerySchema),
  asyncHandler(async (req, res) => {
    await service.remove(callerOf(req), req.params.id!, req.query);
    res.status(204).end();
  }),
);
