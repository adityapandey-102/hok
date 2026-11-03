import type { Approval } from "../../../domain";

/** Domain -> response DTO. An explicit field list (the contract, round-3 spec §10), so nothing internal can leak by accident. */
export function toApprovalResponseDto(a: Approval): Approval {
  return {
    id: a.id,
    subject: a.subject,
    subjectId: a.subjectId,
    subjectTitle: a.subjectTitle,
    clientName: a.clientName,
    stageId: a.stageId,
    stageName: a.stageName,
    stagePosition: a.stagePosition,
    approvers: [...a.approvers],
    status: a.status,
    requestNote: a.requestNote,
    requestLink: a.requestLink,
    requestedById: a.requestedById,
    requestedByName: a.requestedByName,
    requestedAt: a.requestedAt,
    decidedById: a.decidedById,
    decidedByName: a.decidedByName,
    decidedVia: a.decidedVia,
    decidedAt: a.decidedAt,
    decisionComment: a.decisionComment,
    version: a.version,
    canDecide: a.canDecide,
    canCancel: a.canCancel,
  };
}
