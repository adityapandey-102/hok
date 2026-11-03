import type { ApprovalRow, ApprovalStatus, ApprovalSubject } from "../../../../domain";
import type { ApprovalItemFacts } from "../../domain/approval.entity";

export interface NewApproval {
  subject: ApprovalSubject;
  itemId: string;
  note: string | null;
  link: string | null;
  requestedBy: string;
}

/** What a decision or a cancel writes on the locked row (the version always goes up by one). */
export interface ApprovalWrite {
  status: Extract<ApprovalStatus, "approved" | "changes_requested" | "cancelled">;
  /** The staff member; null when the client decided in the portal or the row was cancelled. */
  decidedBy: string | null;
  decidedVia: "staff" | "portal" | null;
  comment: string | null;
  /** Stamp decided_at (decisions yes, a cancel no). */
  stampTime: boolean;
}

export type ApprovalListView = "to_decide" | "requested" | "all_visible";

export interface ApprovalListFilters {
  view: ApprovalListView;
  status?: ApprovalStatus;
}

/** Persistence contract for approvals: data access only; every multi-step write in one transaction on a locked row. */
export interface ApprovalsRepositoryPort {
  /**
   * One transaction: lock the item (FOR UPDATE, so a move and a request never interleave), read its facts and its
   * current stage, let `guard` check them, insert the pending row. Returns the new id. A second simultaneous
   * request for the same stage is a 409 STAGE_APPROVAL_PENDING (the partial unique index is the backstop).
   * `guard` receives null when the item doesn't exist.
   */
  request(input: NewApproval, guard: (item: ApprovalItemFacts | null) => void): Promise<string>;
  /** One approval with its item's facts and team; null if missing. No lock. */
  findRow(id: string): Promise<ApprovalRow | null>;
  /**
   * One transaction: lock the approval row (`pinClientId`: only if it is on an event of that client -- the portal),
   * let `guard` check it (null if there is no such row) and return what to write, then write it and bump the version.
   */
  transition(id: string, pinClientId: string | null, guard: (row: ApprovalRow | null) => ApprovalWrite): Promise<void>;
  /** The inbox page, worked out in SQL for this caller. */
  list(userId: string, role: string, filters: ApprovalListFilters, limit: number, offset: number): Promise<ApprovalRow[]>;
  count(userId: string, role: string, filters: ApprovalListFilters): Promise<number>;
  /** Active people who could decide this approval (one query, capped). */
  deciderIds(approvalId: string): Promise<string[]>;
  /** An event's team members who hear about it (active client managers). */
  eventNotifiedTeam(eventId: string): Promise<string[]>;
}
