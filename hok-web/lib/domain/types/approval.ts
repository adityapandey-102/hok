import type { Role } from "../constants/roles";

/**
 * Stage approvals (round 3). Mirror hok-api's approvals module.
 * An approver token on a template stage: the Admin, the client's team managers,
 * the client (event templates only) or any role except the Admin.
 */
export type ApproverToken = "admin" | "team_managers" | "client" | Exclude<Role, "admin">;

export const APPROVAL_STATUSES = ["pending", "approved", "changes_requested", "cancelled", "superseded"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export type ApprovalSubject = "event" | "task";

export interface Approval {
  id: string;
  subject: ApprovalSubject;
  subjectId: string;
  subjectTitle: string;
  clientName: string | null;
  stageId: string;
  stageName: string;
  stagePosition: number;
  approvers: ApproverToken[];
  status: ApprovalStatus;
  requestNote: string | null;
  requestLink: string | null;
  requestedById: string | null;
  requestedByName: string | null;
  requestedAt: string;
  decidedById: string | null;
  decidedByName: string | null;
  /** "portal" when the client decided; then there is no staff name. */
  decidedVia: "staff" | "portal" | null;
  decidedAt: string | null;
  decisionComment: string | null;
  version: number;
  canDecide: boolean;
  canCancel: boolean;
}

/** The stage that currently stops forward moves (events and tasks): it needs an approval, or has unfinished parts (round 4). */
export interface NextBlockedBy {
  stageId: string;
  stageName: string;
  reason: "approval" | "children";
  /** Unfinished parts at that stage (0 when the reason is an approval only). */
  openChildren: number;
}
