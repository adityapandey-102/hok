import type { PushMessage, PushSubscriptionEntity } from "../../domain/notification.entity";

/**
 * Sends one Web Push message to one device. The provider seam (needleye's
 * pattern, like AuthProvider): production uses `web-push` with the VAPID keys
 * (infrastructure/web-push.sender.ts); tests use an in-memory fake.
 *
 * Outcomes:
 * - `sent`   the push service accepted it;
 * - `gone`   404/410: the browser unsubscribed or the subscription expired --
 *            the caller deletes it;
 * - `failed` anything else (network, 5xx, bad keys) -- logged, kept.
 */
export type PushOutcome = "sent" | "gone" | "failed";

export interface PushSender {
  /** False when the VAPID keys aren't configured: nothing is sent, and the web hides "Turn on notifications". */
  readonly enabled: boolean;
  /** The VAPID public key the browser subscribes with (public by design), or null when disabled. */
  readonly publicKey: string | null;
  send(subscription: Pick<PushSubscriptionEntity, "endpoint" | "p256dh" | "auth">, message: PushMessage): Promise<PushOutcome>;
}
