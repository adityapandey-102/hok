import webpush from "web-push";
import { env } from "../../../config/env";
import { logger } from "../../../common/logger/logger";
import type { PushOutcome, PushSender } from "../application/ports/push-sender.port";
import type { PushMessage, PushSubscriptionEntity } from "../domain/notification.entity";

export interface VapidConfig {
  publicKey?: string;
  privateKey?: string;
  subject?: string;
}

/** A push sender that never sends (no VAPID keys configured). */
export const disabledPushSender: PushSender = {
  enabled: false,
  publicKey: null,
  send: () => Promise.resolve("failed"),
};

/**
 * Web Push through the `web-push` library (encryption + VAPID signing).
 * One HTTPS request per device to its browser's push service (Google FCM,
 * Mozilla, Apple). Messages live up to an hour if the device is offline.
 */
export class WebPushSender implements PushSender {
  readonly enabled = true;

  constructor(private readonly vapid: Required<VapidConfig>) {}

  get publicKey(): string {
    return this.vapid.publicKey;
  }

  async send(subscription: Pick<PushSubscriptionEntity, "endpoint" | "p256dh" | "auth">, message: PushMessage): Promise<PushOutcome> {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(message),
        {
          vapidDetails: { subject: this.vapid.subject, publicKey: this.vapid.publicKey, privateKey: this.vapid.privateKey },
          TTL: 60 * 60,
          urgency: "normal",
          timeout: 10_000,
        },
      );
      return "sent";
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone";
      // Never log the endpoint (it is a capability URL for that device).
      logger.warn({ status, message: (error as Error).message }, "Push service refused a notification");
      return "failed";
    }
  }
}

/** The configured sender: web-push when all three VAPID values are set, otherwise disabled (logged once). */
export function createPushSender(config: VapidConfig = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT }): PushSender {
  if (config.publicKey && config.privateKey && config.subject) {
    return new WebPushSender({ publicKey: config.publicKey, privateKey: config.privateKey, subject: config.subject });
  }
  if (config.publicKey || config.privateKey || config.subject) {
    logger.warn("Web push is off: set all three of VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT");
  } else {
    logger.info("Web push is off (no VAPID keys); the in-app bell still works");
  }
  return disabledPushSender;
}
