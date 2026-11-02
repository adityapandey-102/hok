import { Router, type Request } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody, validateQuery } from "../../../common/http/validate.middleware";
import { uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { TodosService, type TodosCaller } from "../application/todos.service";
import { DrizzleTodosRepository } from "../infrastructure/drizzle-todos.repository";
import { toTodoResponseDto } from "./todo.presenter";
import {
  createTodoDtoSchema,
  todoQueryDtoSchema,
  updateTodoDtoSchema,
  type CreateTodoDto,
  type TodoQueryDto,
  type UpdateTodoDto,
} from "./dto/todo.dto";

/** Composition root for the To-dos module. */
const service = new TodosService(new DrizzleTodosRepository());

export const todosRouter = Router();

// Every role has its own list (todos:manage is "own" for all, the Admin
// included). The service pins every query to the caller; another person's id
// is a 404 TODO_NOT_FOUND.
todosRouter.use(requireAuth, requireCapability("todos:manage"));
todosRouter.param("id", uuidParam(ERROR_CODES.TODO_NOT_FOUND, "To-do"));

const callerOf = (req: Request): TodosCaller => ({ userId: req.authUserId! });

todosRouter.get(
  "/",
  validateQuery(todoQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const result = await service.list(callerOf(req), req.query as unknown as TodoQueryDto);
    res.json({ ...result, todos: result.todos.map(toTodoResponseDto) });
  }),
);

todosRouter.post(
  "/",
  validateBody(createTodoDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ todo: toTodoResponseDto(await service.create(callerOf(req), req.body as CreateTodoDto)) });
  }),
);

todosRouter.patch(
  "/:id",
  validateBody(updateTodoDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ todo: toTodoResponseDto(await service.update(callerOf(req), req.params.id!, req.body as UpdateTodoDto)) });
  }),
);

todosRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await service.delete(callerOf(req), req.params.id!);
    res.status(204).end();
  }),
);
