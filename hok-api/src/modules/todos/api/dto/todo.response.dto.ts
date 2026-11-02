import type { TodoUrgency } from "../../domain/todo.entity";

/** GET /todos rows and every write's `{ todo }`. Also the dashboard's `todos.next` rows. */
export interface TodoResponseDto {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  urgency: TodoUrgency;
  done: boolean;
  doneAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
