import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody, validateQuery } from "../../../common/http/validate.middleware";
import { uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { createUserDtoSchema, type CreateUserDto } from "./dto/create-user.dto";
import { updateUserDtoSchema, type UpdateUserDto } from "./dto/update-user.dto";
import { userQueryDtoSchema, type UserQueryDto } from "./dto/user-query.dto";
import { UsersService } from "../application/users.service";
import { DrizzleUsersRepository } from "../infrastructure/drizzle-users.repository";
import { authProvider } from "../../../common/auth/supabase-auth-provider";

/** Composition root for the Users module -- wires the concrete (Infrastructure) adapter into the Application service. */
const usersService = new UsersService(new DrizzleUsersRepository(authProvider));

export const usersRouter = Router();

// Admin only. A user's edits to their OWN profile go through PATCH /auth/me.
usersRouter.use(requireAuth, requireCapability("users:manage"));
usersRouter.param("id", uuidParam(ERROR_CODES.USER_NOT_FOUND, "User"));

usersRouter.get(
  "/",
  validateQuery(userQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const { search, role, limit, offset } = req.query as unknown as UserQueryDto;
    res.json(await usersService.listUsers({ search, role }, { limit, offset }));
  }),
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ user: await usersService.getUser(req.params.id!) });
  }),
);

usersRouter.post(
  "/",
  validateBody(createUserDtoSchema),
  asyncHandler(async (req, res) => {
    const result = await usersService.createUser(req.body as CreateUserDto, req.authUserId!);
    res.status(201).json(result);
  }),
);

usersRouter.post(
  "/:id/generate-password",
  asyncHandler(async (req, res) => {
    const result = await usersService.generatePassword(req.params.id!, req.authUserId!);
    res.status(201).json(result);
  }),
);

usersRouter.patch(
  "/:id",
  validateBody(updateUserDtoSchema),
  asyncHandler(async (req, res) => {
    await usersService.updateUser(req.params.id!, req.authUserId!, req.body as UpdateUserDto);
    res.status(204).send();
  }),
);

usersRouter.post(
  "/:id/deactivate",
  asyncHandler(async (req, res) => {
    await usersService.deactivateUser(req.params.id!, req.authUserId!);
    res.status(204).send();
  }),
);

usersRouter.post(
  "/:id/reactivate",
  asyncHandler(async (req, res) => {
    await usersService.reactivateUser(req.params.id!);
    res.status(204).send();
  }),
);
