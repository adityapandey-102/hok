import type { ClientTodoPriority, ClientTodoStatus } from "../../domain/client-todo.entity";

/** One row of the list and every write's `{ todo }`. */
export interface ClientTodoResponseDto {
  id: string;
  clientId: string;
  eventId: string | null;
  eventTitle: string | null;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: ClientTodoPriority;
  status: ClientTodoStatus;
  completedAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientTodoListResponseDto {
  todos: ClientTodoResponseDto[];
  total: number;
  limit: number;
  offset: number;
}
