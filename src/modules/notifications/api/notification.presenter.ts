import type { NotificationEntity, PushSubscriptionEntity } from "../domain/notification.entity";
import type { NotificationResponseDto, PushDeviceDto } from "./dto/notification.response.dto";

/** Domain entity -> response DTO. Drops the recipient and actor ids (the web shows names). */
export function toNotificationResponseDto(n: NotificationEntity): NotificationResponseDto {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    url: n.url,
    data: n.data,
    actorName: n.actorName,
    readAt: n.readAt,
    createdAt: n.createdAt,
  };
}

/** A device row without its endpoint and keys (those stay server-side). */
export function toPushDeviceDto(s: PushSubscriptionEntity): PushDeviceDto {
  return { id: s.id, userAgent: s.userAgent, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt };
}
