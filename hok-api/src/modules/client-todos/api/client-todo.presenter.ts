import type { ClientTodoEntity } from "../domain/client-todo.entity";
import type { ClientTodoResponseDto } from "./dto/client-todo.response.dto";

/** Domain entity -> response DTO. Drops the owner id and client status (scoping details the web never needs). */
export function toClientTodoResponseDto(t: ClientTodoEntity): ClientTodoResponseDto {
  return {
    id: t.id,
    clientId: t.clientId,
    eventId: t.eventId,
    eventTitle: t.eventTitle,
    title: t.title,
    description: t.description,
    dueAt: t.dueAt,
    priority: t.priority,
    status: t.status,
    completedAt: t.completedAt,
    createdBy: t.createdBy,
    createdByName: t.createdByName,
    version: t.version,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
