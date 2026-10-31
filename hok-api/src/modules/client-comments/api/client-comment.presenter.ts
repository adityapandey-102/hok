import type { ClientCommentEntity, PortalCommentEntity } from "../domain/client-comment.entity";

/** Staff inbox row: explicit field list (never a spread), so new columns can't leak by accident. */
export function toCommentDto(c: ClientCommentEntity) {
  return {
    id: c.id,
    clientId: c.clientId,
    clientName: c.clientName,
    ownerId: c.ownerId,
    eventId: c.eventId,
    eventTitle: c.eventTitle,
    body: c.body,
    status: c.status,
    reply: c.reply,
    repliedAt: c.repliedAt,
    repliedByName: c.repliedByName,
    version: c.version,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** Client-safe: the portal sees its own text, the status and the reply. Never staff names. */
export function toPortalCommentDto(c: PortalCommentEntity) {
  return {
    id: c.id,
    eventId: c.eventId,
    eventTitle: c.eventTitle,
    body: c.body,
    status: c.status,
    reply: c.reply,
    repliedAt: c.repliedAt,
    createdAt: c.createdAt,
  };
}
