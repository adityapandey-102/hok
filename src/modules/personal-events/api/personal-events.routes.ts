import { Router, type Request } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody, validateQuery } from "../../../common/http/validate.middleware";
import { uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { PersonalEventsService, type PersonalEventsCaller } from "../application/personal-events.service";
import { DrizzlePersonalEventsRepository } from "../infrastructure/drizzle-personal-events.repository";
import type { PersonalEventEntity } from "../domain/personal-event.entity";
import {
  createPersonalEventDtoSchema,
  personalEventQueryDtoSchema,
  updatePersonalEventDtoSchema,
  type CreatePersonalEventDto,
  type PersonalEventQueryDto,
  type UpdatePersonalEventDto,
} from "./dto/personal-event.dto";

/** Composition root for the Personal-events module. */
const service = new PersonalEventsService(new DrizzlePersonalEventsRepository());

/** Entity -> response DTO (identical today; explicit so they can diverge). */
const present = (e: PersonalEventEntity) => ({ ...e });

export const personalEventsRouter = Router();

// Admin (everyone's) and SMM / MM (their own; others' are 404). Task-only staff 403.
personalEventsRouter.use(requireAuth, requireCapability("personal_events:manage"));
personalEventsRouter.param("id", uuidParam(ERROR_CODES.PERSONAL_EVENT_NOT_FOUND, "Personal event"));

const callerOf = (req: Request): PersonalEventsCaller => ({ userId: req.authUserId!, role: req.profile!.role, timeZone: req.profile!.timeZone });

personalEventsRouter.get(
  "/",
  validateQuery(personalEventQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const result = await service.list(callerOf(req), req.query as unknown as PersonalEventQueryDto);
    res.json({ ...result, personalEvents: result.personalEvents.map(present) });
  }),
);

personalEventsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ personalEvent: present(await service.get(callerOf(req), req.params.id!)) });
  }),
);

personalEventsRouter.post(
  "/",
  validateBody(createPersonalEventDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ personalEvent: present(await service.create(callerOf(req), req.body as CreatePersonalEventDto)) });
  }),
);

personalEventsRouter.patch(
  "/:id",
  validateBody(updatePersonalEventDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ personalEvent: present(await service.update(callerOf(req), req.params.id!, req.body as UpdatePersonalEventDto)) });
  }),
);

personalEventsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await service.delete(callerOf(req), req.params.id!);
    res.status(204).send();
  }),
);
