import type { StaffTaskDetail, StaffTaskSummaryEntity } from "../domain/staff-task.entity";
import type { StaffTaskDetailResponseDto, StaffTaskSummaryResponseDto } from "./dto/staff-task.response.dto";

/** Domain -> response DTO. Explicit field lists so a new column never leaks by accident. */
export function toStaffTaskDetailResponseDto(t: StaffTaskDetail): StaffTaskDetailResponseDto {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt,
    assigneeId: t.assigneeId,
    assigneeName: t.assigneeName,
    assigneeRole: t.assigneeRole,
    assignedBy: t.assignedBy,
    assignedByName: t.assignedByName,
    clientId: t.clientId,
    clientName: t.clientName,
    eventId: t.eventId,
    eventTitle: t.eventTitle,
    rawFilesUrl: t.rawFilesUrl,
    referenceUrl: t.referenceUrl,
    script: t.script,
    referenceLinks: t.referenceLinks,
    completedAt: t.completedAt,
    version: t.version,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    updates: t.updates.map((u) => ({
      id: u.id,
      kind: u.kind,
      authorId: u.authorId,
      authorName: u.authorName,
      fromStatus: u.fromStatus,
      toStatus: u.toStatus,
      fromAssigneeName: u.fromAssigneeName,
      toAssigneeName: u.toAssigneeName,
      comment: u.comment,
      createdAt: u.createdAt,
    })),
  };
}

export function toStaffTaskSummaryResponseDto(t: StaffTaskSummaryEntity): StaffTaskSummaryResponseDto {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt,
    assigneeId: t.assigneeId,
    assigneeName: t.assigneeName,
    assigneeRole: t.assigneeRole,
    clientId: t.clientId,
    clientName: t.clientName,
    eventId: t.eventId,
    hasEditorBrief: t.hasEditorBrief,
    completedAt: t.completedAt,
    version: t.version,
    createdAt: t.createdAt,
  };
}
