import { Router, type Request } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody, validateQuery } from "../../../common/http/validate.middleware";
import { uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { pushWriteRateLimiter } from "../../../common/middleware/rate-limit.middleware";
import { notificationsService } from "../notifications.module";
import {
  notificationQueryDtoSchema,
  pushSubscriptionDtoSchema,
  unsubscribeDtoSchema,
  updatePreferencesDtoSchema,
  type NotificationQueryDto,
  type PushSubscriptionDto,
  type UnsubscribeDto,
  type UpdatePreferencesDto,
} from "./dto/notification.dto";

/**
 * The caller's own notifications. Every signed-in role has a bell, so there's
 * no capability check: the row scope is the caller (someone else's
 * notification or device is a 404). Literal paths are declared before
 * `/:id` routes so "read-all" is never taken for an id.
 */
export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.param("id", uuidParam(ERROR_CODES.NOTIFICATION_NOT_FOUND, "Notification"));
notificationsRouter.param("deviceId", uuidParam(ERROR_CODES.PUSH_SUBSCRIPTION_NOT_FOUND, "Device"));

const userOf = (req: Request): string => req.authUserId!;

notificationsRouter.get(
  "/",
  validateQuery(notificationQueryDtoSchema),
  asyncHandler(async (req, res) => {
    res.json(await notificationsService.list(userOf(req), req.query as unknown as NotificationQueryDto));
  }),
);

/** The bell's badge, polled by the web: one index-only count. */
notificationsRouter.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    res.json(await notificationsService.unreadCount(userOf(req)));
  }),
);

notificationsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    res.json(await notificationsService.markAllRead(userOf(req)));
  }),
);

notificationsRouter.get(
  "/preferences",
  asyncHandler(async (req, res) => {
    res.json(await notificationsService.getPreferences(userOf(req)));
  }),
);

notificationsRouter.put(
  "/preferences",
  validateBody(updatePreferencesDtoSchema),
  asyncHandler(async (req, res) => {
    res.json(await notificationsService.updatePreferences(userOf(req), req.body as UpdatePreferencesDto));
  }),
);

/** The VAPID public key the browser subscribes with (or `enabled: false`). */
notificationsRouter.get("/push/config", (_req, res) => {
  res.json(notificationsService.pushConfig());
});

notificationsRouter.get(
  "/push/subscriptions",
  asyncHandler(async (req, res) => {
    res.json(await notificationsService.listDevices(userOf(req)));
  }),
);

notificationsRouter.post(
  "/push/subscriptions",
  pushWriteRateLimiter,
  validateBody(pushSubscriptionDtoSchema),
  asyncHandler(async (req, res) => {
    await notificationsService.subscribe(userOf(req), req.body as PushSubscriptionDto);
    res.status(201).json({ subscribed: true });
  }),
);

/** This browser turns push off (by its endpoint; idempotent). */
notificationsRouter.post(
  "/push/subscriptions/unsubscribe",
  validateBody(unsubscribeDtoSchema),
  asyncHandler(async (req, res) => {
    await notificationsService.unsubscribe(userOf(req), (req.body as UnsubscribeDto).endpoint);
    res.status(204).end();
  }),
);

/** Remove one of the caller's devices (from My profile). */
notificationsRouter.delete(
  "/push/subscriptions/:deviceId",
  asyncHandler(async (req, res) => {
    await notificationsService.removeDevice(userOf(req), req.params.deviceId!);
    res.status(204).end();
  }),
);

/** Sends "notifications are on" to every device of the caller. 503 PUSH_NOT_CONFIGURED without VAPID keys. */
notificationsRouter.post(
  "/push/test",
  pushWriteRateLimiter,
  asyncHandler(async (req, res) => {
    res.json(await notificationsService.sendTest(userOf(req)));
  }),
);

notificationsRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await notificationsService.markRead(userOf(req), req.params.id!);
    res.status(204).end();
  }),
);
