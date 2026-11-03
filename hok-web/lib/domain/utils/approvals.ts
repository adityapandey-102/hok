import { ROLE_LABELS, ROLES, type Role } from "../constants/roles";
import type { Approval, ApproverToken, NextBlockedBy } from "../types/approval";

/** Chip order in the template editor: Admin, the client's team managers, every other role, then the client (events only). */
export const APPROVER_ROLE_TOKENS: readonly Exclude<Role, "admin">[] = ROLES.filter((r): r is Exclude<Role, "admin"> => r !== "admin");

/** "Admin", "Client's team managers", "The client", or a role's name. */
export function approverLabel(token: ApproverToken): string {
  switch (token) {
    case "admin":
      return "Admin";
    case "team_managers":
      return "Client's team managers";
    case "client":
      return "The client";
    default:
      return ROLE_LABELS[token] ?? token;
  }
}

/** "Social Media Manager or Admin", "A, B or C". Admin comes last-named only if it was last in the list. */
export function approversLabel(tokens: readonly ApproverToken[]): string {
  const names = tokens.map(approverLabel);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/** Stages of a template (or an item) that need approval. */
export function approvalStageCount(stages: readonly { approvers?: readonly ApproverToken[] }[]): number {
  return stages.filter((s) => (s.approvers?.length ?? 0) > 0).length;
}

/** "1 approval stage" / "2 approval stages". */
export function approvalStageCountLabel(count: number): string {
  return `${count} approval ${count === 1 ? "stage" : "stages"}`;
}

/**
 * Is a move to `targetPosition` stopped by an approval? Backward moves are never stopped.
 * A forward move may enter the blocking stage but not pass it. Completing is `targetPosition = null`
 * and is stopped whenever something blocks. The API enforces this too (409 STAGE_APPROVAL_REQUIRED).
 */
export function isMoveBlocked(blockedBy: (NextBlockedBy & { position: number }) | null, currentPosition: number, targetPosition: number | null): boolean {
  if (!blockedBy) return false;
  if (targetPosition === null) return true;
  return targetPosition > currentPosition && targetPosition > blockedBy.position;
}

/** Resolves `nextBlockedBy` to a stage position using the item's own stages (null when unknown). */
export function blockedByWithPosition(blockedBy: NextBlockedBy | null, stages: readonly { id: string; position: number }[]): (NextBlockedBy & { position: number }) | null {
  if (!blockedBy) return null;
  const stage = stages.find((s) => s.id === blockedBy.stageId);
  return stage ? { ...blockedBy, position: stage.position } : null;
}

/** The reason shown beside a disabled forward button. */
export function blockedReason(blockedBy: NextBlockedBy): string {
  return `Needs approval at ${blockedBy.stageName}`;
}

/** The newest approval row of one stage (rows arrive newest first), or null. */
export function latestApprovalForStage(approvals: readonly Approval[], stageId: string): Approval | null {
  return approvals.find((a) => a.stageId === stageId && a.status !== "cancelled" && a.status !== "superseded") ?? null;
}

export const APPROVAL_STATUS_LABELS: Record<Approval["status"], string> = {
  pending: "Waiting",
  approved: "Approved",
  changes_requested: "Changes requested",
  cancelled: "Cancelled",
  superseded: "No longer counts",
};

/** Who decided: a staff name, or "the client" when it came from the portal. */
export function deciderLabel(a: Pick<Approval, "decidedVia" | "decidedByName">): string {
  return a.decidedVia === "portal" ? "the client" : (a.decidedByName ?? "Someone");
}

/** Stage ids whose newest counting approval is "approved" (for the tracker's green seals). */
export function approvedStageIds(approvals: readonly Approval[]): string[] {
  const ids = new Set<string>();
  const seen = new Set<string>();
  for (const a of approvals) {
    if (a.status === "cancelled" || a.status === "superseded" || seen.has(a.stageId)) continue;
    seen.add(a.stageId);
    if (a.status === "approved") ids.add(a.stageId);
  }
  return [...ids];
}
