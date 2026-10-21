import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateQuery } from "../../../common/http/validate.middleware";
import { CalendarService } from "../application/calendar.service";
import { CalendarFeedService } from "../application/calendar-feed.service";
import { DrizzleCalendarRepository } from "../infrastructure/drizzle-calendar.repository";
import { calendarQueryDtoSchema, type CalendarQueryDto } from "./dto/calendar-query.dto";

/** Composition root for the Calendar module (reads events; keeps each person's subscribe-link hash on their profile). */
const repo = new DrizzleCalendarRepository();
const service = new CalendarService(repo);
const feeds = new CalendarFeedService(repo, repo);

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

/** The caller's own subscribe link (FR-CAL-08): whether one is on, never the token. */
calendarRouter.get(
  "/feed-link",
  asyncHandler(async (req, res) => {
    res.json({ link: await feeds.get(req.authUserId!) });
  }),
);

/** Make a subscribe link (or a new one: the old one stops working). The token is in this response only. */
calendarRouter.post(
  "/feed-link",
  asyncHandler(async (req, res) => {
    res.status(201).json(await feeds.create(req.authUserId!));
  }),
);

calendarRouter.delete(
  "/feed-link",
  asyncHandler(async (req, res) => {
    await feeds.revoke(req.authUserId!);
    res.status(204).end();
  }),
);

/**
 * Public, no login: GET /api/v1/calendar-feed/<token>.ics, fetched by
 * Google Calendar / Apple / Outlook. The token is the credential (mounted
 * behind calendarFeedLimiter; redacted from logs). Same 404 for every bad link.
 */
export const calendarFeedPublicRouter = Router();

calendarFeedPublicRouter.get(
  "/:file",
  asyncHandler(async (req, res) => {
    const body = await feeds.ics(req.params.file!);
    res.set({ "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, no-store", "Content-Disposition": 'inline; filename="hok.ics"' });
    res.send(body);
  }),
);
