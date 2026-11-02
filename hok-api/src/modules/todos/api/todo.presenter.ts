import type { TodoEntity } from "../domain/todo.entity";
import type { TodoResponseDto } from "./dto/todo.response.dto";

/** Domain -> response DTO. Explicit field lists so an internal column (next_remind_at) never leaks by accident. */
export function toTodoResponseDto(t: Pick<TodoEntity, "id" | "title" | "notes" | "dueAt" | "urgency" | "doneAt" | "version" | "createdAt" | "updatedAt">): TodoResponseDto {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    dueAt: t.dueAt,
    urgency: t.urgency,
    done: t.doneAt !== null,
    doneAt: t.doneAt,
    version: t.version,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
