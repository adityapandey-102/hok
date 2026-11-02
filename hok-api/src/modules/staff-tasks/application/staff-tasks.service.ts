import { BadRequestError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import { getCapabilityScope, hasCapability, type Role } from "../../../domain";
import {
  assertCanAssign,
  assertCanChangeStatus,
  assertCanComment,
  assertCanManage,
  assertReopenable,
  assertStatusChange,
  assertTaskVersion,
  assertTaskVisible,
  assertValidAssignee,
  canManageTask,
  resolveEditorFields,
  resolveTaskLinks,
  restrictLinksToTeam,
  type StaffTaskScope,
  type TaskClientRef,
  type TaskEventRef,
} from "../domain/staff-task.rules";
import type {
  EditorFields,
  StaffTaskDetailView,
  StaffTaskEntity,
  StaffTaskFields,
  StaffTaskStatus,
  StaffTaskSummaryView,
} from "../domain/staff-task.entity";
import type { StaffTaskChanges, StaffTaskListFilters, StaffTasksRepositoryPort } from "./ports/staff-tasks-repository.port";
import { noopStaffTaskNotifier, type StaffTaskNotifier } from "./ports/staff-task-notifier.port";
import type {
  ChangeStatusDto,
  CommentDto,
  CreateStaffTaskDto,
  ReopenDto,
  StaffTaskQueryDto,
  UpdateStaffTaskDto,
} from "../api/dto/staff-task.dto";

export interface StaffTasksCaller {
  userId: string;
  role: Role;
}

export interface StaffTaskListResult {
  tasks: StaffTaskSummaryView[];
  total: number;
  limit: number;
  offset: number;
}

/** The plain fields a PATCH may carry, in a stable order (also what the audit records). */
const FIELD_KEYS = [
  "title",
  "description",
  "dueAt",
  "priority",
  "referenceLinks",
  "clientId",
  "eventId",
  "rawFilesUrl",
  "referenceUrl",
  "script",
] as const satisfies readonly (keyof StaffTaskFields)[];

const EDITOR_KEYS = ["rawFilesUrl", "referenceUrl", "script"] as const satisfies readonly (keyof EditorFields)[];

/**
 * Staff tasks (REQUIREMENTS §5.9). The route checks the capability
 * (staff_tasks:read / :update / :assign); this service applies the row scope
 * -- the Admin sees every task; everyone else the tasks assigned to them, the
 * ones they created and (client managers) their clients' tasks, anything else
 * is a 404 -- and runs every write's rules against the locked row: edit,
 * reassign, reopen and delete are the Admin's or the creator's (a team
 * manager who merely sees the task gets a 403), status is the assignee's or
 * the Admin's, comments the assignee's, creator's or Admin's. Assigning goes
 * down the role ladder. Writes return the fresh detail so the UI needs no re-fetch.
 *
 * Notifications (M9) hook in through `StaffTaskNotifier`, called after commit.
 */
export class StaffTasksService {
  constructor(
    private readonly repo: StaffTasksRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
    private readonly notifier: StaffTaskNotifier = noopStaffTaskNotifier,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Who sees which rows; `viaTeam` is for roles that manage clients (a task-only role keeps no team visibility). */
  private scopeOf(caller: StaffTasksCaller): StaffTaskScope {
    const scope = getCapabilityScope(caller.role, "staff_tasks:read");
    if (scope === true) return { kind: "all" };
    if (scope === "own") return { kind: "own", userId: caller.userId, viaTeam: hasCapability(caller.role, "clients:read") };
    throw new ForbiddenError("Your role has no access to staff tasks");
  }

  /** Create, edit, reassign, reopen and delete need staff_tasks:assign (Admin, client managers); the route checks it too. */
  private assertAssigner(caller: StaffTasksCaller): void {
    if (!hasCapability(caller.role, "staff_tasks:assign")) {
      throw new ForbiddenError("Your role cannot assign or manage tasks");
    }
  }

  private async detail(caller: StaffTasksCaller, id: string): Promise<StaffTaskDetailView> {
    const task = await this.repo.findDetail(id);
    if (!task) throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
    return { ...task, canManage: canManageTask(caller, task) };
  }

  // -- reading ------------------------------------------------------------------

  async list(caller: StaffTasksCaller, query: StaffTaskQueryDto): Promise<StaffTaskListResult> {
    const scope = this.scopeOf(caller);
    if (query.relation === "team" && !hasCapability(caller.role, "clients:read")) {
      throw new BadRequestError("The team filter is for client managers", ERROR_CODES.VALIDATION_ERROR);
    }
    const filters: StaffTaskListFilters = {
      // Every filter is open to every caller; the scope is ANDed on top, so none can widen it.
      scope,
      callerId: caller.userId,
      relation: query.relation,
      assigneeId: query.assigneeId,
      role: query.role,
      clientId: query.clientId,
      status: query.status,
      openOnly: query.open,
      priority: query.priority,
      overdue: query.overdue,
      dueFrom: query.dueFrom,
      dueTo: query.dueTo,
      search: query.search,
      now: this.clock().toISOString(),
    };
    const page = { limit: query.limit, offset: query.offset };
    const [tasks, total] = await Promise.all([this.repo.findMany(filters, page), this.repo.countMany(filters)]);
    return {
      tasks: tasks.map((t) => ({ ...t, canManage: canManageTask(caller, { assignedBy: t.assignedById }) })),
      total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  async get(caller: StaffTasksCaller, id: string): Promise<StaffTaskDetailView> {
    const task = assertTaskVisible(this.scopeOf(caller), await this.repo.findDetail(id));
    return { ...task, canManage: canManageTask(caller, task) };
  }

  // -- creating and managing (Admin; client managers on their own tasks) --------------

  async create(caller: StaffTasksCaller, dto: CreateStaffTaskDto): Promise<StaffTaskDetailView> {
    this.assertAssigner(caller);
    const assignee = assertValidAssignee(await this.repo.findAssigneeCandidate(dto.assigneeId));
    assertCanAssign(caller.role, assignee.role);
    const [client, event] = await Promise.all([
      dto.clientId ? this.repo.findClient(dto.clientId) : Promise.resolve(null),
      dto.eventId ? this.repo.findEvent(dto.eventId) : Promise.resolve(null),
    ]);
    const allowed = restrictLinksToTeam(caller, client, event);
    const links = resolveTaskLinks(dto.clientId ?? null, allowed.client, dto.eventId ?? null, allowed.event);
    const sent: Partial<EditorFields> = { rawFilesUrl: dto.rawFilesUrl, referenceUrl: dto.referenceUrl, script: dto.script };
    const editor = resolveEditorFields(
      assignee.role,
      { rawFilesUrl: dto.rawFilesUrl ?? null, referenceUrl: dto.referenceUrl ?? null, script: dto.script ?? null },
      sent,
    );

    const id = await this.repo.create({
      title: dto.title,
      description: dto.description ?? null,
      dueAt: dto.dueAt ?? null,
      priority: dto.priority ?? "medium",
      referenceLinks: dto.referenceLinks ?? [],
      ...links,
      ...editor,
      assigneeId: assignee.id,
      assignedBy: caller.userId,
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.STAFF_TASK_CREATED,
      entityType: AUDIT_ENTITIES.STAFF_TASK,
      entityId: id,
      metadata: { assigneeId: assignee.id },
    });
    await this.notifier.taskAssigned({ taskId: id, title: dto.title, assigneeId: assignee.id, actorId: caller.userId });
    return this.detail(caller, id);
  }

  /**
   * FR-TSK-05: edit and/or reassign. Changing the client without naming an
   * event unlinks the old event (it belonged to the old client). Reassigning
   * to someone who isn't an editor clears the editor brief. The caller must be
   * the Admin or the task's creator (checked on the locked row) and can only
   * reassign downwards.
   */
  async update(caller: StaffTasksCaller, id: string, dto: UpdateStaffTaskDto): Promise<StaffTaskDetailView> {
    this.assertAssigner(caller);
    const changedKeys = FIELD_KEYS.filter((k) => dto[k] !== undefined);
    if (changedKeys.length === 0 && dto.assigneeId === undefined) {
      throw new BadRequestError("No fields to update", ERROR_CODES.VALIDATION_NO_FIELDS);
    }

    const [newAssignee, loadedClient, loadedEvent] = await Promise.all([
      dto.assigneeId !== undefined ? this.repo.findAssigneeCandidate(dto.assigneeId).then(assertValidAssignee) : Promise.resolve(null),
      dto.clientId ? this.repo.findClient(dto.clientId) : Promise.resolve(null),
      dto.eventId ? this.repo.findEvent(dto.eventId) : Promise.resolve(null),
    ]);
    const { client, event } = restrictLinksToTeam(caller, loadedClient, loadedEvent);
    const scope = this.scopeOf(caller);

    const outcome: { reassignedFrom?: string; title?: string } = {};
    await this.repo.update(id, (current) => {
      // Visibility first (a 404), then the creator/Admin rule (a 403), then the version.
      assertTaskVisible(scope, current);
      assertCanManage(caller, current);
      assertTaskVersion(current.version, dto.version);
      // Keeping the same assignee is not a (re)assignment, so the ladder only judges a change.
      if (newAssignee && newAssignee.id !== current.assigneeId) assertCanAssign(caller.role, newAssignee.role);

      const fields: Partial<StaffTaskFields> = {};
      if (dto.title !== undefined) fields.title = dto.title;
      if (dto.description !== undefined) fields.description = dto.description;
      if (dto.dueAt !== undefined) fields.dueAt = dto.dueAt;
      if (dto.priority !== undefined) fields.priority = dto.priority;
      if (dto.referenceLinks !== undefined) fields.referenceLinks = dto.referenceLinks;

      if (dto.clientId !== undefined || dto.eventId !== undefined) {
        const clientChanged = dto.clientId !== undefined && dto.clientId !== current.clientId;
        const clientId = dto.clientId !== undefined ? dto.clientId : current.clientId;
        const eventId = dto.eventId !== undefined ? dto.eventId : clientChanged ? null : current.eventId;
        const clientRef: TaskClientRef | null = dto.clientId !== undefined ? client : clientId ? { id: clientId, teamIds: current.teamIds } : null;
        const eventRef: TaskEventRef | null =
          dto.eventId !== undefined ? event : eventId ? { id: eventId, clientId: current.clientId ?? "", title: "", teamIds: current.teamIds } : null;
        Object.assign(fields, resolveTaskLinks(clientId, clientRef, eventId, eventRef));
      }

      const role = newAssignee?.role ?? current.assigneeRole;
      const sent: Partial<EditorFields> = {};
      for (const k of EDITOR_KEYS) if (dto[k] !== undefined) sent[k] = dto[k];
      Object.assign(
        fields,
        resolveEditorFields(
          role,
          {
            rawFilesUrl: dto.rawFilesUrl !== undefined ? dto.rawFilesUrl : current.rawFilesUrl,
            referenceUrl: dto.referenceUrl !== undefined ? dto.referenceUrl : current.referenceUrl,
            script: dto.script !== undefined ? dto.script : current.script,
          },
          sent,
        ),
      );

      const changes: StaffTaskChanges = { fields };
      if (newAssignee && newAssignee.id !== current.assigneeId) {
        outcome.reassignedFrom = current.assigneeId;
        changes.assigneeId = newAssignee.id;
        changes.entry = { kind: "reassigned", authorId: caller.userId, comment: null };
      }
      outcome.title = fields.title ?? current.title;
      return changes;
    });

    if (changedKeys.length > 0) {
      await this.audit.record({
        action: AUDIT_ACTIONS.STAFF_TASK_UPDATED,
        entityType: AUDIT_ENTITIES.STAFF_TASK,
        entityId: id,
        metadata: { fields: changedKeys },
      });
    }
    if (outcome.reassignedFrom !== undefined && newAssignee) {
      await this.audit.record({
        action: AUDIT_ACTIONS.STAFF_TASK_REASSIGNED,
        entityType: AUDIT_ENTITIES.STAFF_TASK,
        entityId: id,
        metadata: { from: outcome.reassignedFrom, to: newAssignee.id },
      });
      await this.notifier.taskAssigned({ taskId: id, title: outcome.title ?? "", assigneeId: newAssignee.id, actorId: caller.userId });
    }
    return this.detail(caller, id);
  }

  /** FR-TSK-05: a done task back to an open status (default todo), with an optional comment. Admin or the creator. */
  async reopen(caller: StaffTasksCaller, id: string, dto: ReopenDto): Promise<StaffTaskDetailView> {
    this.assertAssigner(caller);
    const scope = this.scopeOf(caller);
    const seen: { task?: StaffTaskEntity } = {};
    await this.repo.update(id, (current) => {
      assertTaskVisible(scope, current);
      assertCanManage(caller, current);
      assertTaskVersion(current.version, dto.version);
      assertReopenable(current.status);
      seen.task = current;
      return { status: dto.status, entry: { kind: "reopened", authorId: caller.userId, comment: dto.comment ?? null } };
    });
    await this.notifyStatus(seen.task, dto.status, caller.userId, dto.comment ?? null);
    return this.detail(caller, id);
  }

  /** Hard delete (FR-TSK-05); the timeline goes with it, the audit entry stays. Admin or the creator. */
  async delete(caller: StaffTasksCaller, id: string): Promise<void> {
    this.assertAssigner(caller);
    const scope = this.scopeOf(caller);
    const deleted = await this.repo.delete(id, (current) => {
      assertTaskVisible(scope, current);
      assertCanManage(caller, current);
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.STAFF_TASK_DELETED,
      entityType: AUDIT_ENTITIES.STAFF_TASK,
      entityId: id,
      metadata: { assigneeId: deleted.assigneeId, status: deleted.status },
    });
  }

  // -- the assignee's (and the Admin's) work --------------------------------------

  /** FR-TSK-03/04: any open status to any other, including done; a comment is optional. Assignee or Admin. */
  async changeStatus(caller: StaffTasksCaller, id: string, dto: ChangeStatusDto): Promise<StaffTaskDetailView> {
    const scope = this.scopeOf(caller);
    const seen: { task?: StaffTaskEntity } = {};
    await this.repo.update(id, (current) => {
      // Visibility first, so a stale version on someone else's task is still a 404.
      assertTaskVisible(scope, current);
      assertCanChangeStatus(caller, current);
      assertTaskVersion(current.version, dto.version);
      assertStatusChange(current.status, dto.status);
      seen.task = current;
      return { status: dto.status, entry: { kind: "status", authorId: caller.userId, comment: dto.comment ?? null } };
    });
    await this.notifyStatus(seen.task, dto.status, caller.userId, dto.comment ?? null);
    return this.detail(caller, id);
  }

  /** FR-TSK-06: the assignee, the creator and the Admin discuss the task at any time, done or not. */
  async comment(caller: StaffTasksCaller, id: string, dto: CommentDto): Promise<StaffTaskDetailView> {
    const scope = this.scopeOf(caller);
    const seen: { task?: StaffTaskEntity } = {};
    await this.repo.addComment(
      id,
      (current) => {
        assertTaskVisible(scope, current);
        assertCanComment(caller, current);
        seen.task = current;
      },
      caller.userId,
      dto.body,
    );
    const task = seen.task;
    if (task) {
      await this.notifier.commentAdded({ taskId: id, title: task.title, assigneeId: task.assigneeId, assignedBy: task.assignedBy, actorId: caller.userId });
    }
    return this.detail(caller, id);
  }

  private async notifyStatus(task: StaffTaskEntity | undefined, to: StaffTaskStatus, actorId: string, comment: string | null): Promise<void> {
    if (!task) return;
    await this.notifier.statusChanged({
      taskId: task.id,
      title: task.title,
      assigneeId: task.assigneeId,
      assignedBy: task.assignedBy,
      from: task.status,
      to,
      actorId,
      comment,
    });
  }
}
