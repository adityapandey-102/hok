import { BadRequestError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { assertTodoVersion, nextTodoReminder } from "../domain/todo.rules";
import type { TodoEntity } from "../domain/todo.entity";
import type { TodoChanges, TodosRepositoryPort } from "./ports/todos-repository.port";
import type { CreateTodoDto, TodoQueryDto, UpdateTodoDto } from "../api/dto/todo.dto";

export interface TodosCaller {
  userId: string;
}

const FIELD_KEYS = ["title", "notes", "dueAt", "urgency", "done"] as const;

/**
 * My to-dos: private to each person, the Admin included (todos:manage is
 * "own" for every role). There is no row-scope check to forget: the caller's
 * id goes into every repository call, so someone else's to-do is a 404.
 *
 * No audit-log entries on purpose: these are private personal notes, and the
 * audit log is visible to the Admin.
 *
 * Reminders: `next_remind_at` is recomputed on create and whenever the due
 * time, the urgency or the done state changes (done clears it); the reminder
 * runner (reminders module) sends it and moves it on.
 */
export class TodosService {
  constructor(
    private readonly repo: TodosRepositoryPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(caller: TodosCaller, query: TodoQueryDto) {
    const filters = { ownerId: caller.userId, status: query.status, dueFrom: query.dueFrom, dueTo: query.dueTo };
    const page = { limit: query.limit, offset: query.offset };
    const [todos, total] = await Promise.all([this.repo.findMany(filters, page), this.repo.countMany(filters)]);
    return { todos, total, limit: page.limit, offset: page.offset };
  }

  create(caller: TodosCaller, dto: CreateTodoDto): Promise<TodoEntity> {
    const urgency = dto.urgency ?? "medium";
    const dueAt = dto.dueAt ?? null;
    return this.repo.create({
      ownerId: caller.userId,
      title: dto.title,
      notes: dto.notes ?? null,
      dueAt,
      urgency,
      nextRemindAt: nextTodoReminder(dueAt ? new Date(dueAt) : null, urgency, this.clock())?.toISOString() ?? null,
    });
  }

  async update(caller: TodosCaller, id: string, dto: UpdateTodoDto): Promise<TodoEntity> {
    if (FIELD_KEYS.every((k) => dto[k] === undefined)) {
      throw new BadRequestError("No fields to update", ERROR_CODES.VALIDATION_NO_FIELDS);
    }
    const now = this.clock();
    return this.repo.update(caller.userId, id, (current) => {
      assertTodoVersion(current.version, dto.version);

      const changes: TodoChanges = {};
      if (dto.title !== undefined) changes.title = dto.title;
      if (dto.notes !== undefined) changes.notes = dto.notes;
      if (dto.dueAt !== undefined) changes.dueAt = dto.dueAt;
      if (dto.urgency !== undefined) changes.urgency = dto.urgency;

      const wasDone = current.doneAt !== null;
      const doneChanged = dto.done !== undefined && dto.done !== wasDone;
      if (doneChanged) changes.doneAt = dto.done ? now.toISOString() : null;

      // The reminder follows the final state: done = none left; otherwise the next moment after now.
      const dueChanged = dto.dueAt !== undefined && dto.dueAt !== current.dueAt;
      const urgencyChanged = dto.urgency !== undefined && dto.urgency !== current.urgency;
      if (doneChanged || dueChanged || urgencyChanged) {
        const done = dto.done ?? wasDone;
        const dueAt = dto.dueAt !== undefined ? dto.dueAt : current.dueAt;
        const urgency = dto.urgency ?? current.urgency;
        changes.nextRemindAt = done ? null : (nextTodoReminder(dueAt ? new Date(dueAt) : null, urgency, now)?.toISOString() ?? null);
      }
      return changes;
    });
  }

  delete(caller: TodosCaller, id: string): Promise<void> {
    return this.repo.delete(caller.userId, id);
  }
}
