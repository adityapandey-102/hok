import { AppError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_INFO, NO_MUTES, type NotificationType } from "../domain/notification.entity";
import { sanitizeMutes } from "../domain/notification.rules";
import { toNotificationResponseDto, toPushDeviceDto } from "../api/notification.presenter";
import type { NotificationsRepositoryPort } from "./ports/notifications-repository.port";
import type { PushSender } from "./ports/push-sender.port";
import type { NotificationDispatcher, PushReport } from "./notification-dispatcher";
import type { NotificationQueryDto, PushSubscriptionDto, UpdatePreferencesDto } from "../api/dto/notification.dto";
import type {
  NotificationListResponseDto,
  NotificationPreferencesResponseDto,
  PushConfigResponseDto,
  PushDevicesResponseDto,
  UnreadCountResponseDto,
} from "../api/dto/notification.response.dto";

/** Triggers the preferences screen offers: only the ones some module actually raises. */
export function liveNotificationTypes(): NotificationType[] {
  return NOTIFICATION_TYPES.filter((t) => NOTIFICATION_TYPE_INFO[t].live);
}

/**
 * The caller's own notifications (REQUIREMENTS §5.10): the bell, its unread
 * badge, read state, per-trigger preferences (FR-NTF-04) and the devices that
 * receive push. Every role has one; every method is scoped to the signed-in
 * user, so someone else's notification or device is a 404.
 */
export class NotificationsService {
  constructor(
    private readonly repo: NotificationsRepositoryPort,
    private readonly dispatcher: NotificationDispatcher,
    private readonly sender: PushSender,
  ) {}

  // -- the bell ---------------------------------------------------------------------

  async list(userId: string, query: NotificationQueryDto): Promise<NotificationListResponseDto> {
    const page = { limit: query.limit, offset: query.offset };
    const [rows, total] = await Promise.all([this.repo.findForUser(userId, query.unread, page), this.repo.countForUser(userId, query.unread)]);
    return { notifications: rows.map(toNotificationResponseDto), total, limit: page.limit, offset: page.offset };
  }

  async unreadCount(userId: string): Promise<UnreadCountResponseDto> {
    return { count: await this.repo.countUnread(userId) };
  }

  async markRead(userId: string, id: string): Promise<void> {
    if (!(await this.repo.markRead(userId, id))) throw new NotFoundError("Notification not found", ERROR_CODES.NOTIFICATION_NOT_FOUND);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    return { updated: await this.repo.markAllRead(userId) };
  }

  // -- preferences ------------------------------------------------------------------

  async getPreferences(userId: string): Promise<NotificationPreferencesResponseDto> {
    const prefs = (await this.repo.findPreferences([userId])).get(userId) ?? NO_MUTES;
    return {
      preferences: liveNotificationTypes().map((type) => ({
        type,
        label: NOTIFICATION_TYPE_INFO[type].label,
        description: NOTIFICATION_TYPE_INFO[type].description,
        push: !prefs.mutedPush.includes(type) && !prefs.mutedInApp.includes(type),
        inApp: !prefs.mutedInApp.includes(type),
      })),
    };
  }

  /** Replaces the mutes for the triggers sent; triggers not sent keep their current setting. */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<NotificationPreferencesResponseDto> {
    const live = liveNotificationTypes();
    const current = (await this.repo.findPreferences([userId])).get(userId) ?? NO_MUTES;
    const sent = new Set(dto.preferences.map((p) => p.type));
    const keep = (muted: string[]) => muted.filter((t) => !sent.has(t as NotificationType));
    await this.repo.savePreferences(userId, {
      mutedPush: sanitizeMutes([...keep(current.mutedPush), ...dto.preferences.filter((p) => !p.push).map((p) => p.type)], live),
      mutedInApp: sanitizeMutes([...keep(current.mutedInApp), ...dto.preferences.filter((p) => !p.inApp).map((p) => p.type)], live),
    });
    return this.getPreferences(userId);
  }

  // -- push devices ----------------------------------------------------------------

  pushConfig(): PushConfigResponseDto {
    return { enabled: this.sender.enabled, publicKey: this.sender.publicKey };
  }

  async subscribe(userId: string, dto: PushSubscriptionDto): Promise<void> {
    await this.repo.saveSubscription({ userId, endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth, userAgent: dto.userAgent });
  }

  async listDevices(userId: string): Promise<PushDevicesResponseDto> {
    return { devices: (await this.repo.findSubscriptionsForUsers([userId])).map(toPushDeviceDto) };
  }

  async removeDevice(userId: string, id: string): Promise<void> {
    if (!(await this.repo.deleteSubscription(userId, id))) {
      throw new NotFoundError("Device not found", ERROR_CODES.PUSH_SUBSCRIPTION_NOT_FOUND);
    }
  }

  /** Idempotent: unsubscribing a browser that isn't registered is fine. */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.repo.deleteSubscriptionByEndpoint(userId, endpoint);
  }

  /** "Send a test notification" to every device of the caller (no bell entry). */
  async sendTest(userId: string): Promise<PushReport> {
    if (!this.sender.enabled) throw new AppError(503, "Push notifications aren't set up on this server", ERROR_CODES.PUSH_NOT_CONFIGURED);
    return this.dispatcher.sendToUser(userId, {
      title: "HOK notifications are on",
      body: "This device will now get HOK notifications.",
      url: "/app/profile",
      tag: "push_test",
    });
  }
}
