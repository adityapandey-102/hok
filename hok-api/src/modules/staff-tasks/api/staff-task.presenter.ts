import type { StaffTaskDetailView, StaffTaskSummaryView, TaskStage, TaskStageView } from "../domain/staff-task.entity";
import type { StaffTaskDetailResponseDto, StaffTaskSummaryResponseDto } from "./dto/staff-task.response.dto";

const stageDto = (s: TaskStage): TaskStage => ({ id: s.id, name: s.name, position: s.position });
const fullStageDto = (s: TaskStageView): TaskStageView => ({ id: s.id, name: s.name, position: s.position, approvers: [...s.approvers], openChildren: s.openChildren });

/** Domain -> response DTO. Explicit field lists so a new column never leaks by accident. */
export function toStaffTaskDetailResponseDto(t: StaffTaskDetailView): StaffTaskDetailResponseDto {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    brief: t.brief,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt,
    assigneeId: t.assigneeId,
    assigneeName: t.assigneeName,
    assigneeRole: t.assigneeRole,
    assignedBy: t.assignedBy,
    assignedById: t.assignedBy,
    assignedByName: t.assignedByName,
    clientId: t.clientId,
    clientName: t.clientName,
    eventId: t.eventId,
    eventTitle: t.eventTitle,
    templateName: t.templateName,
    stageCount: t.stageCount,
    currentStage: stageDto(t.currentStage),
    stages: t.stages.map(fullStageDto),
    blockedReason: t.blockedReason,
    links: t.links.map((l) => ({
      id: l.id,
      kind: l.kind,
      url: l.url,
      label: l.label,
      stageId: l.stageId,
      stageName: l.stageName,
      addedById: l.addedById,
      addedByName: l.addedByName,
      createdAt: l.createdAt,
      sharedAssetId: l.sharedAssetId,
    })),
    completedAt: t.completedAt,
    version: t.version,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    canManage: t.canManage,
    canShare: t.canShare,
    approvals: t.approvals.map((a) => ({ ...a, approvers: [...a.approvers] })),
    nextBlockedBy: t.nextBlockedBy
      ? { stageId: t.nextBlockedBy.stageId, stageName: t.nextBlockedBy.stageName, reason: t.nextBlockedBy.reason, openChildren: t.nextBlockedBy.openChildren }
      : null,
    parent: t.parent ? { ...t.parent } : null,
    children: t.children.map((c) => ({ ...c })),
    hiddenChildren: t.hiddenChildren,
    updates: t.updates.map((u) => ({
      id: u.id,
      kind: u.kind,
      authorId: u.authorId,
      authorName: u.authorName,
      fromStatus: u.fromStatus,
      toStatus: u.toStatus,
      fromAssigneeName: u.fromAssigneeName,
      toAssigneeName: u.toAssigneeName,
      fromStageName: u.fromStageName,
      toStageName: u.toStageName,
      comment: u.comment,
      createdAt: u.createdAt,
    })),
  };
}

export function toStaffTaskSummaryResponseDto(t: StaffTaskSummaryView): StaffTaskSummaryResponseDto {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt,
    assigneeId: t.assigneeId,
    assigneeName: t.assigneeName,
    assigneeRole: t.assigneeRole,
    assignedById: t.assignedById,
    assignedByName: t.assignedByName,
    clientId: t.clientId,
    clientName: t.clientName,
    eventId: t.eventId,
    templateName: t.templateName,
    stageCount: t.stageCount,
    currentStage: stageDto(t.currentStage),
    blockedReason: t.blockedReason,
    completedAt: t.completedAt,
    version: t.version,
    createdAt: t.createdAt,
    canManage: t.canManage,
  };
}
