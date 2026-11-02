import type { TodoEntity, TodoStatusFilter, TodoUrgency } from "../../domain/todo.entity";

export interface TodoFilters {
  /** Always the caller: every query is pinned to its owner. */
  ownerId: string;
  status: TodoStatusFilter;
  /** Due inside [dueFrom, dueTo). */
  dueFrom?: string;
  dueTo?: string;
}

export interface NewTodoRecord {
  ownerId: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  urgency: TodoUrgency;
  nextRemindAt: string | null;
}

/** What one guarded write changes. An empty object writes nothing (and doesn't bump the version). */
export interface TodoChanges {
  title?: string;
  notes?: string | null;
  dueAt?: string | null;
  urgency?: TodoUrgency;
  doneAt?: string | null;
  nextRemindAt?: string | null;
}

/** Persistence contract for to-dos. Every method is scoped to `ownerId`; another person's row simply isn't there (404). */
export interface TodosRepositoryPort {
  findMany(filters: TodoFilters, page: { limit: number; offset: number }): Promise<TodoEntity[]>;
  countMany(filters: TodoFilters): Promise<number>;
  create(record: NewTodoRecord): Promise<TodoEntity>;
  /** One transaction: lock the owner's row (404 TODO_NOT_FOUND if missing or not theirs), `decide`, apply, bump the version. Returns the fresh row. */
  update(ownerId: string, id: string, decide: (current: TodoEntity) => TodoChanges): Promise<TodoEntity>;
  /** 404 TODO_NOT_FOUND if missing or not theirs. */
  delete(ownerId: string, id: string): Promise<void>;
}
