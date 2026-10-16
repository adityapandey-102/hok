import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateQuery } from "../../../common/http/validate.middleware";
import { CalendarService } from "../application/calendar.service";
import { DrizzleCalendarRepository } from "../infrastructure/drizzle-calendar.repository";
import { calendarQueryDtoSchema, type CalendarQueryDto } from "./dto/calendar-query.dto";

/** Composition root for the Calendar module (read-only; owns no table). */
const service = new CalendarService(new DrizzleCalendarRepository());

export const calendarRouter = Router();

// Admin and SMM / MM; task-only staff 403 (no events:read).
calendarRouter.use(requireAuth, requireCapability("events:read"));

/** The merged feed for a range: client events + personal entries, earliest first. Items are presented as-is (they're already the wire shape). */
calendarRouter.get(
  "/",
  validateQuery(calendarQueryDtoSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.feed({ userId: req.authUserId!, role: req.profile!.role }, req.query as unknown as CalendarQueryDto));
  }),
);
