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

// Everyone has a calendar (tasks and to-dos at least); the service decides which kinds each role gets.
calendarRouter.use(requireAuth, requireCapability("staff_tasks:read"));
// The .ics subscription stays manager-only this round (Admin and SMM / MM / PM; task-only staff 403).
const feedLinkAccess = requireCapability("events:read");

/** The merged feed for a range: events, personal entries, tasks and the caller's own to-dos, earliest first. Items are presented as-is (they're already the wire shape). */
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
  feedLinkAccess,
  asyncHandler(async (req, res) => {
    res.json({ link: await feeds.get(req.authUserId!) });
  }),
);

/** Make a subscribe link (or a new one: the old one stops working). The token is in this response only. */
calendarRouter.post(
  "/feed-link",
  feedLinkAccess,
  asyncHandler(async (req, res) => {
    res.status(201).json(await feeds.create(req.authUserId!));
  }),
);

calendarRouter.delete(
  "/feed-link",
  feedLinkAccess,
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
