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
import { toStaffTaskDetailResponseDto, toStaffTaskSummaryResponseDto } from "./staff-task.presenter";
import {
  changeStatusDtoSchema,
  commentDtoSchema,
  createStaffTaskDtoSchema,
  reopenDtoSchema,
  staffTaskQueryDtoSchema,
  updateStaffTaskDtoSchema,
  type ChangeStatusDto,
  type CommentDto,
  type CreateStaffTaskDto,
  type ReopenDto,
  type StaffTaskQueryDto,
  type UpdateStaffTaskDto,
} from "./dto/staff-task.dto";

/**
 * M9 wiring (FR-TSK-07): bell + web push, never email. The dispatcher skips the
 * actor, so nobody is notified about their own action.
 * - assigned: the assignee.
 * - status changed / comment: the other side -- the assignee when the Admin acts,
 *   the assigning Admin when the assignee acts.
 */
const otherSide = (e: { assigneeId: string; assignedBy: string | null; actorId: string }) =>
  e.actorId === e.assigneeId ? (e.assignedBy ? [e.assignedBy] : []) : [e.assigneeId];

const taskNotifier: StaffTaskNotifier = {
  taskAssigned: (e) =>
    notifier.notify({ type: "task_assigned", recipientIds: [e.assigneeId], actorId: e.actorId, payload: taskAssignedPayload({ taskId: e.taskId, title: e.title }) }),
  statusChanged: (e) =>
    notifier.notify({ type: "task_status_changed", recipientIds: otherSide(e), actorId: e.actorId, payload: taskStatusChangedPayload({ taskId: e.taskId, title: e.title, to: e.to }) }),
  commentAdded: (e) =>
    notifier.notify({ type: "task_commented", recipientIds: otherSide(e), actorId: e.actorId, payload: taskCommentedPayload({ taskId: e.taskId, title: e.title }) }),
};

/** Composition root for the Staff Tasks module. */
const service = new StaffTasksService(new DrizzleStaffTasksRepository(), auditLogger, taskNotifier);

export const staffTasksRouter = Router();

// Every role reads tasks: the Admin all, everyone else the ones assigned to
// them (others' are 404, applied by the service).
staffTasksRouter.use(requireAuth, requireCapability("staff_tasks:read"));
staffTasksRouter.param("id", uuidParam(ERROR_CODES.STAFF_TASK_NOT_FOUND, "Task"));

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

/** Admin only (FR-TSK-01). */
staffTasksRouter.post(
  "/",
  requireCapability("staff_tasks:assign"),
  validateBody(createStaffTaskDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ task: toStaffTaskDetailResponseDto(await service.create(callerOf(req), req.body as CreateStaffTaskDto)) });
  }),
);

/** Admin only: edit and/or reassign (FR-TSK-05). */
staffTasksRouter.patch(
  "/:id",
  requireCapability("staff_tasks:assign"),
  validateBody(updateStaffTaskDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ task: toStaffTaskDetailResponseDto(await service.update(callerOf(req), req.params.id!, req.body as UpdateStaffTaskDto)) });
  }),
);

/** Admin only (FR-TSK-05). */
staffTasksRouter.delete(
  "/:id",
  requireCapability("staff_tasks:assign"),
  asyncHandler(async (req, res) => {
    await service.delete(callerOf(req), req.params.id!);
    res.status(204).end();
  }),
);

/** The assignee (own) or the Admin (FR-TSK-03/04). */
staffTasksRouter.post(
  "/:id/status",
  requireCapability("staff_tasks:update"),
  validateBody(changeStatusDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ task: toStaffTaskDetailResponseDto(await service.changeStatus(callerOf(req), req.params.id!, req.body as ChangeStatusDto)) });
  }),
);

/** Admin only (FR-TSK-05). */
staffTasksRouter.post(
  "/:id/reopen",
  requireCapability("staff_tasks:assign"),
  validateBody(reopenDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ task: toStaffTaskDetailResponseDto(await service.reopen(callerOf(req), req.params.id!, req.body as ReopenDto)) });
  }),
);

/** The assignee (own) or the Admin (FR-TSK-06). */
staffTasksRouter.post(
  "/:id/comments",
  requireCapability("staff_tasks:update"),
  validateBody(commentDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ task: toStaffTaskDetailResponseDto(await service.comment(callerOf(req), req.params.id!, req.body as CommentDto)) });
  }),
);
