import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import { getCapabilityScope, hasCapability, type Role } from "../../../domain";
import {
  assertBlocked,
  assertCanAddLink,
  assertCanAssign,
  assertCanBlock,
  assertCanComment,
  assertCanComplete,
  assertCanManage,
  assertCanMoveStage,
  assertCanRaiseBlock,
  assertCanRemoveLink,
  assertCanShare,
  assertLinksRoom,
  assertReopenable,
  assertShareable,
  assertStageMove,
  assertTaskTemplateUsable,
  assertTaskVersion,
  assertTaskVisible,
  assertValidAssignee,
  canManageTask,
  canShareWithClient,
  findStage,
  reopenTarget,
  resolveTaskLinks,
  restrictLinksToTeam,
  statusForStage,
  type StaffTaskScope,
  type TaskClientRef,
  type TaskEventRef,
} from "../domain/staff-task.rules";
import type { StaffTaskDetail, StaffTaskDetailView, StaffTaskEntity, StaffTaskFields, StaffTaskSummaryView } from "../domain/staff-task.entity";
import type { StaffTaskChanges, StaffTaskListFilters, StaffTasksRepositoryPort } from "./ports/staff-tasks-repository.port";
import { noopStaffTaskNotifier, type StaffTaskNotifier, type TaskChangeAction } from "./ports/staff-task-notifier.port";
import type {
  AddLinkDto,
  BlockDto,
  CommentDto,
  CreateStaffTaskDto,
  ReopenDto,
  ShareLinkDto,
  StaffTaskQueryDto,
  StageMoveDto,
  UnblockDto,
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

/** Fetches the preview (title, image...) of a freshly shared link in the background; the assets module's. */
export interface AssetPreviewQueue {
  refresh(assetId: string, url: string): void;
}

/** The plain fields a PATCH may carry, in a stable order (also what the audit records). */
const FIELD_KEYS = ["title", "description", "brief", "dueAt", "priority", "clientId", "eventId"] as const satisfies readonly (keyof StaffTaskFields)[];

/**
 * Staff tasks (REQUIREMENTS §5.9). The route checks the capability
 * (staff_tasks:read / :update / :assign); this service applies the row scope
 * -- the Admin sees every task; everyone else the tasks assigned to them, the
 * ones they created and (client managers) their clients' tasks, anything else
 * is a 404 -- and runs every write's rules against the locked row: edit,
 * reassign, reopen and delete are the Admin's or the creator's (a team
 * manager who merely sees the task gets a 403); moving a task through its stages,
 * completing and unblocking are the assignee's, creator's or Admin's; blocking the
 * assignee's or Admin's; comments the assignee's, creator's or Admin's. Assigning goes
 * down the role ladder. Writes return the fresh detail so the UI needs no re-fetch.
 *
 * A task's `status` is derived from its stage (stage 1 todo, 2..N in progress, completed
 * done) and the blocked flag -- see `statusForStage`.
 *
 * Notifications (M9) hook in through `StaffTaskNotifier`, called after commit.
 */
export class StaffTasksService {
  constructor(
    private readonly repo: StaffTasksRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
    private readonly notifier: StaffTaskNotifier = noopStaffTaskNotifier,
    private readonly clock: () => Date = () => new Date(),
    /** Background link previews for assets created by "share with client"; a no-op unless the composition root passes one. */
    private readonly previews: AssetPreviewQueue = { refresh: () => undefined },
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

  private view(caller: StaffTasksCaller, task: StaffTaskDetail): StaffTaskDetailView {
    return { ...task, canManage: canManageTask(caller, task), canShare: canShareWithClient(caller, task) };
  }

  private async detail(caller: StaffTasksCaller, id: string): Promise<StaffTaskDetailView> {
    const task = await this.repo.findDetail(id);
    if (!task) throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
    return this.view(caller, task);
  }

  /** The visibility check on its own, before a write whose repository lookup could otherwise answer with a different 404 code. */
  private async assertVisible(caller: StaffTasksCaller, id: string): Promise<StaffTaskScope> {
    const scope = this.scopeOf(caller);
    assertTaskVisible(scope, await this.repo.findById(id));
    return scope;
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
    return this.view(caller, task);
  }

  // -- creating and managing (Admin; client managers on their own tasks) --------------

  async create(caller: StaffTasksCaller, dto: CreateStaffTaskDto): Promise<StaffTaskDetailView> {
    this.assertAssigner(caller);
    const assignee = assertValidAssignee(await this.repo.findAssigneeCandidate(dto.assigneeId));
    assertCanAssign(caller.role, assignee.role);
    const [template, client, event] = await Promise.all([
      this.repo.findTemplate(dto.templateId),
      dto.clientId ? this.repo.findClient(dto.clientId) : Promise.resolve(null),
      dto.eventId ? this.repo.findEvent(dto.eventId) : Promise.resolve(null),
    ]);
    const usable = assertTaskTemplateUsable(template, assignee.role);
    const allowed = restrictLinksToTeam(caller, client, event);
    const links = resolveTaskLinks(dto.clientId ?? null, allowed.client, dto.eventId ?? null, allowed.event);

    const id = await this.repo.create({
      title: dto.title,
      description: dto.description ?? null,
      brief: dto.brief ?? null,
      dueAt: dto.dueAt ?? null,
      priority: dto.priority ?? "medium",
      ...links,
      assigneeId: assignee.id,
      assignedBy: caller.userId,
      templateId: usable.id,
      templateName: usable.name,
      stageNames: usable.stageNames,
      links: (dto.links ?? []).map((l) => ({ url: l.url, label: l.label })),
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.STAFF_TASK_CREATED,
      entityType: AUDIT_ENTITIES.STAFF_TASK,
      entityId: id,
      metadata: { assigneeId: assignee.id, templateId: usable.id },
    });
    await this.notifier.taskAssigned({ taskId: id, title: dto.title, assigneeId: assignee.id, actorId: caller.userId });
    return this.detail(caller, id);
  }

  /**
   * FR-TSK-05: edit and/or reassign. Changing the client without naming an
   * event unlinks the old event (it belonged to the old client). The stages
   * are fixed at creation, so a reassignment to a role the template wasn't
   * offered for is fine. The caller must be the Admin or the task's creator
   * (checked on the locked row) and can only reassign downwards.
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
      if (dto.brief !== undefined) fields.brief = dto.brief;
      if (dto.dueAt !== undefined) fields.dueAt = dto.dueAt;
      if (dto.priority !== undefined) fields.priority = dto.priority;

      if (dto.clientId !== undefined || dto.eventId !== undefined) {
        const clientChanged = dto.clientId !== undefined && dto.clientId !== current.clientId;
        const clientId = dto.clientId !== undefined ? dto.clientId : current.clientId;
        const eventId = dto.eventId !== undefined ? dto.eventId : clientChanged ? null : current.eventId;
        const clientRef: TaskClientRef | null = dto.clientId !== undefined ? client : clientId ? { id: clientId, teamIds: current.teamIds } : null;
        const eventRef: TaskEventRef | null =
          dto.eventId !== undefined ? event : eventId ? { id: eventId, clientId: current.clientId ?? "", title: "", teamIds: current.teamIds } : null;
        Object.assign(fields, resolveTaskLinks(clientId, clientRef, eventId, eventRef));
      }

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

  /**
   * FR-TSK-05: a done task back to a stage (default: its last), status from that stage,
   * with an optional comment. Admin or the creator.
   */
  async reopen(caller: StaffTasksCaller, id: string, dto: ReopenDto): Promise<StaffTaskDetailView> {
    this.assertAssigner(caller);
    const scope = this.scopeOf(caller);
    const seen: { task?: StaffTaskEntity; stage?: string } = {};
    await this.repo.update(id, (current, stages) => {
      assertTaskVisible(scope, current);
      assertCanManage(caller, current);
      assertTaskVersion(current.version, dto.version);
      assertReopenable(current.status);
      const target = reopenTarget(stages, dto.stageId);
      seen.task = current;
      seen.stage = target.name;
      return {
        stageId: target.id,
        status: statusForStage(target.position, current.stageCount),
        blockedReason: null,
        entry: { kind: "reopened", authorId: caller.userId, comment: dto.comment ?? null, toStageId: target.id },
      };
    });
    await this.notifyChange(seen.task, "reopened", seen.stage ?? null, null, caller.userId, dto.comment ?? null);
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

  // -- moving through the stages (assignee, creator and Admin) ---------------------------

  /**
   * Moves to any of the task's stages (forward or back), or completes it (only from the last
   * stage). Either way the blocked flag is cleared and the status follows the stage.
   */
  async moveStage(caller: StaffTasksCaller, id: string, dto: StageMoveDto): Promise<StaffTaskDetailView> {
    const scope = this.scopeOf(caller);
    const seen: { task?: StaffTaskEntity; action?: TaskChangeAction; stage?: string } = {};
    await this.repo.update(id, (current, stages) => {
      // Visibility first, so a stale version on someone else's task is still a 404.
      assertTaskVisible(scope, current);
      assertCanMoveStage(caller, current);
      assertTaskVersion(current.version, dto.version);
      seen.task = current;
      const comment = dto.comment ?? null;
      if (dto.complete) {
        assertCanComplete({ status: current.status, currentStagePosition: current.currentStage.position, stageCount: current.stageCount });
        seen.action = "completed";
        seen.stage = current.currentStage.name;
        return { status: "done", blockedReason: null, entry: { kind: "completed", authorId: caller.userId, comment } };
      }
      const target = assertStageMove({ status: current.status, currentStageId: current.currentStage.id, stages, targetStageId: dto.stageId! });
      seen.action = "stage";
      seen.stage = target.name;
      return {
        stageId: target.id,
        status: statusForStage(target.position, current.stageCount),
        blockedReason: null,
        entry: { kind: "stage", authorId: caller.userId, comment, toStageId: target.id },
      };
    });
    await this.notifyChange(seen.task, seen.action ?? "stage", seen.stage ?? null, null, caller.userId, dto.comment ?? null);
    return this.detail(caller, id);
  }

  /** Raises the blocked flag with a reason; the stage stays. The assignee or the Admin. */
  async block(caller: StaffTasksCaller, id: string, dto: BlockDto): Promise<StaffTaskDetailView> {
    const scope = this.scopeOf(caller);
    const seen: { task?: StaffTaskEntity } = {};
    await this.repo.update(id, (current) => {
      assertTaskVisible(scope, current);
      assertCanBlock(caller, current);
      assertTaskVersion(current.version, dto.version);
      assertCanRaiseBlock(current.status);
      seen.task = current;
      return { status: "blocked", blockedReason: dto.reason, entry: { kind: "blocked", authorId: caller.userId, comment: dto.reason } };
    });
    await this.notifyChange(seen.task, "blocked", seen.task?.currentStage.name ?? null, dto.reason, caller.userId, null);
    return this.detail(caller, id);
  }

  /** Lowers the flag: the status comes back from the stage. The assignee, the creator or the Admin. */
  async unblock(caller: StaffTasksCaller, id: string, dto: UnblockDto): Promise<StaffTaskDetailView> {
    const scope = this.scopeOf(caller);
    const seen: { task?: StaffTaskEntity } = {};
    await this.repo.update(id, (current) => {
      assertTaskVisible(scope, current);
      assertCanMoveStage(caller, current);
      assertTaskVersion(current.version, dto.version);
      assertBlocked(current.status);
      seen.task = current;
      return {
        status: statusForStage(current.currentStage.position, current.stageCount),
        blockedReason: null,
        entry: { kind: "unblocked", authorId: caller.userId, comment: dto.comment ?? null },
      };
    });
    await this.notifyChange(seen.task, "unblocked", seen.task?.currentStage.name ?? null, null, caller.userId, dto.comment ?? null);
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

  // -- links ------------------------------------------------------------------------

  /** A brief link (inputs) by whoever manages the task; a delivered one (finished work) by the assignee or the Admin. */
  async addLink(caller: StaffTasksCaller, id: string, dto: AddLinkDto): Promise<StaffTaskDetailView> {
    const scope = this.scopeOf(caller);
    const linkId = await this.repo.addLink(
      id,
      ({ task, stages, linkCount }) => {
        assertTaskVisible(scope, task);
        assertCanAddLink(caller, task, dto.kind);
        assertLinksRoom(linkCount);
        if (dto.stageId) findStage(stages, dto.stageId);
      },
      { kind: dto.kind, url: dto.url, label: dto.label, stageId: dto.stageId ?? null, addedBy: caller.userId },
    );
    await this.audit.record({
      action: AUDIT_ACTIONS.STAFF_TASK_LINK_ADDED,
      entityType: AUDIT_ENTITIES.STAFF_TASK,
      entityId: id,
      metadata: { linkId, kind: dto.kind },
    });
    return this.detail(caller, id);
  }

  /** Whoever added the link, or whoever manages the task. */
  async removeLink(caller: StaffTasksCaller, id: string, linkId: string): Promise<StaffTaskDetailView> {
    const scope = await this.assertVisible(caller, id);
    const removed = await this.repo.removeLink(id, linkId, ({ task, link }) => {
      assertTaskVisible(scope, task);
      assertCanRemoveLink(caller, task, link);
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.STAFF_TASK_LINK_REMOVED,
      entityType: AUDIT_ENTITIES.STAFF_TASK,
      entityId: id,
      metadata: { linkId, kind: removed.kind },
    });
    return this.detail(caller, id);
  }

  /**
   * Turns a delivered link into an asset the client sees under the task's event, in ONE transaction
   * (the asset and the link's mark). The caller must be able to write assets on that client: the
   * Admin, or a client manager on its team -- an editor can't, their manager shares.
   */
  async shareLink(caller: StaffTasksCaller, id: string, linkId: string, dto: ShareLinkDto): Promise<{ task: StaffTaskDetailView; assetId: string }> {
    const scope = await this.assertVisible(caller, id);
    const { assetId, url } = await this.repo.shareLink(
      id,
      linkId,
      { title: dto.title, stageId: dto.stageId ?? null, createdBy: caller.userId },
      ({ task, link }, event) => {
        assertTaskVisible(scope, task);
        // The event's client's team, read under the share lock (falls back to the task's copy of it).
        assertCanShare(caller, { eventId: task.eventId, teamIds: event?.teamIds ?? task.teamIds });
        assertShareable(link);
        if (event?.clientStatus === "archived") {
          throw new ConflictError("This client is archived, so its assets are read-only. Unarchive the client first.", ERROR_CODES.CLIENT_ARCHIVED);
        }
        if (dto.stageId && !event?.stageIds.includes(dto.stageId)) {
          throw new BadRequestError("Pick one of the event's stages", ERROR_CODES.ASSET_STAGE_INVALID);
        }
      },
    );
    await this.audit.record({ action: AUDIT_ACTIONS.ASSET_CREATED, entityType: AUDIT_ENTITIES.ASSET, entityId: assetId, metadata: { taskId: id } });
    await this.audit.record({
      action: AUDIT_ACTIONS.STAFF_TASK_LINK_SHARED,
      entityType: AUDIT_ENTITIES.STAFF_TASK,
      entityId: id,
      metadata: { linkId, assetId },
    });
    this.previews.refresh(assetId, url);
    return { task: await this.detail(caller, id), assetId };
  }

  private async notifyChange(
    task: StaffTaskEntity | undefined,
    action: TaskChangeAction,
    stageName: string | null,
    reason: string | null,
    actorId: string,
    comment: string | null,
  ): Promise<void> {
    if (!task) return;
    await this.notifier.statusChanged({
      taskId: task.id,
      title: task.title,
      assigneeId: task.assigneeId,
      assignedBy: task.assignedBy,
      action,
      stageName,
      reason,
      actorId,
      comment,
    });
  }
}
