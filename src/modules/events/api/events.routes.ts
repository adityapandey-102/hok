import { Router, type Request } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody, validateQuery } from "../../../common/http/validate.middleware";
import { uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { EventsService, type EventsCaller } from "../application/events.service";
import { DrizzleEventsRepository } from "../infrastructure/drizzle-events.repository";
import { toEventDetailResponseDto, toEventSummaryResponseDto } from "./event.presenter";
import {
  createEventDtoSchema,
  eventQueryDtoSchema,
  moveStageDtoSchema,
  updateEventDtoSchema,
  type CreateEventDto,
  type EventQueryDto,
  type MoveStageDto,
  type UpdateEventDto,
} from "./dto/event.dto";

/** Composition root for the Events module. */
const service = new EventsService(new DrizzleEventsRepository());

export const eventsRouter = Router();

// Admin (every event) and SMM / MM (events of clients they own; others' are
// 404); task-only staff 403.
eventsRouter.use(requireAuth, requireCapability("events:read"));
eventsRouter.param("id", uuidParam(ERROR_CODES.EVENT_NOT_FOUND, "Event"));

const callerOf = (req: Request): EventsCaller => ({ userId: req.authUserId!, role: req.profile!.role });

/** The client workspace's Events tab (?clientId) and the calendars (?from&to). */
eventsRouter.get(
  "/",
  validateQuery(eventQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const result = await service.list(callerOf(req), req.query as unknown as EventQueryDto);
    res.json({ ...result, events: result.events.map(toEventSummaryResponseDto) });
  }),
);

eventsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ event: toEventDetailResponseDto(await service.get(callerOf(req), req.params.id!)) });
  }),
);

eventsRouter.post(
  "/",
  requireCapability("events:write"),
  validateBody(createEventDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ event: toEventDetailResponseDto(await service.create(callerOf(req), req.body as CreateEventDto)) });
  }),
);

eventsRouter.patch(
  "/:id",
  requireCapability("events:write"),
  validateBody(updateEventDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ event: toEventDetailResponseDto(await service.update(callerOf(req), req.params.id!, req.body as UpdateEventDto)) });
  }),
);

eventsRouter.post(
  "/:id/stage",
  requireCapability("events:write"),
  validateBody(moveStageDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ event: toEventDetailResponseDto(await service.moveStage(callerOf(req), req.params.id!, req.body as MoveStageDto)) });
  }),
);
