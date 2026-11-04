import { Router, type Request } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody, validateQuery } from "../../../common/http/validate.middleware";
import { uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { StaffTasksService, type StaffTasksCaller } from "../application/staff-tasks.service";
import { DrizzleStaffTasksRepository } from "../infrastructure/drizzle-staff-tasks.repository";
import { auditLogger } from "../../../common/audit/drizzle-audit-logger";
import { notifier, taskAssignedPayload, taskCommentedPayload, taskStatusChangedPayload } from "../../notifications/notifications.module";
import type { StaffTaskNotifier } from "../application/ports/staff-task-notifier.port";
import { workTreeNotifier } from "../../work-tree/work-tree.module";
import { HttpLinkPreviewer, NoLinkPreviewer } from "../../assets/infrastructure/http-link-previewer";
import { toStaffTaskDetailResponseDto, toStaffTaskSummaryResponseDto } from "./staff-task.presenter";
import {
  addLinkDtoSchema,
  blockDtoSchema,
  commentDtoSchema,
  createStaffTaskDtoSchema,
  reopenDtoSchema,
  shareLinkDtoSchema,
  staffTaskQueryDtoSchema,
  stageMoveDtoSchema,
  unblockDtoSchema,
  updateStaffTaskDtoSchema,
  type AddLinkDto,
  type BlockDto,
  type CommentDto,
  type CreateStaffTaskDto,
  type ReopenDto,
  type ShareLinkDto,
  type StaffTaskQueryDto,
  type StageMoveDto,
  type UnblockDto,
  type UpdateStaffTaskDto,
} from "./dto/staff-task.dto";

/**
 * M9 wiring (FR-TSK-07): bell + web push, never email. The dispatcher skips the
 * actor, so nobody is notified about their own action.
 * - assigned: the assignee.
 * - stage moved / completed / blocked / unblocked / reopened (all "task_status_changed"), and comments:
 *   the other side -- the assignee when the creator or Admin acts, the creator when the assignee acts.
 */
const otherSide = (e: { assigneeId: string; assignedBy: string | null; actorId: string }) =>
  e.actorId === e.assigneeId ? (e.assignedBy ? [e.assignedBy] : []) : [e.assigneeId];

const taskNotifier: StaffTaskNotifier = {
  taskAssigned: (e) =>
    notifier.notify({ type: "task_assigned", recipientIds: [e.assigneeId], actorId: e.actorId, payload: taskAssignedPayload({ taskId: e.taskId, title: e.title }) }),
  statusChanged: (e) =>
    notifier.notify({ type: "task_status_changed", recipientIds: otherSide(e), actorId: e.actorId, payload: taskStatusChangedPayload({ taskId: e.taskId, title: e.title, action: e.action, stageName: e.stageName, reason: e.reason }) }),
  commentAdded: (e) =>
    notifier.notify({ type: "task_commented", recipientIds: otherSide(e), actorId: e.actorId, payload: taskCommentedPayload({ taskId: e.taskId, title: e.title }) }),
};

/** Composition root for the Staff Tasks module. */
// "Share with client" creates an asset, so it queues the same background link preview asset creation does (never in tests).
const previewer = process.env.NODE_ENV === "test" || process.env.LINK_PREVIEWS === "off" ? new NoLinkPreviewer() : new HttpLinkPreviewer();
const service = new StaffTasksService(new DrizzleStaffTasksRepository(), auditLogger, taskNotifier, undefined, previewer, workTreeNotifier);

export const staffTasksRouter = Router();

// Every role reads tasks: the Admin all, everyone else the ones assigned to
// them or created by them, plus -- client managers -- their clients' tasks
// (others' are 404, applied by the service).
staffTasksRouter.use(requireAuth, requireCapability("staff_tasks:read"));
staffTasksRouter.param("id", uuidParam(ERROR_CODES.STAFF_TASK_NOT_FOUND, "Task"));
staffTasksRouter.param("linkId", uuidParam(ERROR_CODES.STAFF_TASK_LINK_NOT_FOUND, "Link"));

const callerOf = (req: Request): StaffTasksCaller => ({ userId: req.authUserId!, role: req.profile!.role });

staffTasksRouter.get(
  "/",
  validateQuery(staffTaskQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const result = await service.list(callerOf(req), req.query as unknown as StaffTaskQueryDto);
    res.json({ ...result, tasks: result.tasks.map(toStaffTaskSummaryResponseDto) });
  }),
);

staffTasksRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ task: toStaffTaskDetailResponseDto(await service.get(callerOf(req), req.params.id!)) });
  }),
);

/** Admin or a client manager, assigning down the role ladder (FR-TSK-01). */
staffTasksRouter.post(
  "/",
  requireCapability("staff_tasks:assign"),
  validateBody(createStaffTaskDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ task: toStaffTaskDetailResponseDto(await service.create(callerOf(req), req.body as CreateStaffTaskDto)) });
  }),
);

/** Admin or the task's creator: edit and/or reassign (FR-TSK-05). A team manager who only sees it gets 403. */
staffTasksRouter.patch(
  "/:id",
  requireCapability("staff_tasks:assign"),
  validateBody(updateStaffTaskDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ task: toStaffTaskDetailResponseDto(await service.update(callerOf(req), req.params.id!, req.body as UpdateStaffTaskDto)) });
  }),
);

/** Admin or the task's creator (FR-TSK-05). */
staffTasksRouter.delete(
  "/:id",
  requireCapability("staff_tasks:assign"),
  asyncHandler(async (req, res) => {
    await service.delete(callerOf(req), req.params.id!);
    res.status(204).end();
  }),
);

/** The assignee, the creator or the Admin: move to any stage, or complete from the last one. */
staffTasksRouter.post(
  "/:id/stage",
  requireCapability("staff_tasks:update"),
  validateBody(stageMoveDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ task: toStaffTaskDetailResponseDto(await service.moveStage(callerOf(req), req.params.id!, req.body as StageMoveDto)) });
  }),
);

/** The assignee or the Admin: raise the blocked flag, with a reason. */
staffTasksRouter.post(
  "/:id/block",
  requireCapability("staff_tasks:update"),
  validateBody(blockDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ task: toStaffTaskDetailResponseDto(await service.block(callerOf(req), req.params.id!, req.body as BlockDto)) });
  }),
);

/** The assignee, the creator or the Admin: lower the blocked flag. */
staffTasksRouter.post(
  "/:id/unblock",
  requireCapability("staff_tasks:update"),
  validateBody(unblockDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ task: toStaffTaskDetailResponseDto(await service.unblock(callerOf(req), req.params.id!, req.body as UnblockDto)) });
  }),
);

/** Admin or the task's creator (FR-TSK-05). */
staffTasksRouter.post(
  "/:id/reopen",
  requireCapability("staff_tasks:assign"),
  validateBody(reopenDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ task: toStaffTaskDetailResponseDto(await service.reopen(callerOf(req), req.params.id!, req.body as ReopenDto)) });
  }),
);

/** The assignee, the creator or the Admin (FR-TSK-06). */
staffTasksRouter.post(
  "/:id/comments",
  requireCapability("staff_tasks:update"),
  validateBody(commentDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ task: toStaffTaskDetailResponseDto(await service.comment(callerOf(req), req.params.id!, req.body as CommentDto)) });
  }),
);

/** Brief links: the creator, a manager or the Admin. Delivered links: the assignee or the Admin. */
staffTasksRouter.post(
  "/:id/links",
  requireCapability("staff_tasks:update"),
  validateBody(addLinkDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ task: toStaffTaskDetailResponseDto(await service.addLink(callerOf(req), req.params.id!, req.body as AddLinkDto)) });
  }),
);

staffTasksRouter.delete(
  "/:id/links/:linkId",
  requireCapability("staff_tasks:update"),
  asyncHandler(async (req, res) => {
    res.json({ task: toStaffTaskDetailResponseDto(await service.removeLink(callerOf(req), req.params.id!, req.params.linkId!)) });
  }),
);

/** Admin or a manager on the client's team: a delivered link becomes an asset the client sees (one transaction). */
staffTasksRouter.post(
  "/:id/links/:linkId/share",
  requireCapability("staff_tasks:update"),
  validateBody(shareLinkDtoSchema),
  asyncHandler(async (req, res) => {
    const { task, assetId } = await service.shareLink(callerOf(req), req.params.id!, req.params.linkId!, req.body as ShareLinkDto);
    res.status(201).json({ task: toStaffTaskDetailResponseDto(task), assetId });
  }),
);
