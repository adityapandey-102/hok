import type { ApprovalSubject, ApproverToken } from "../../../domain";

/** The facts about an item (and its current stage) the request rules read, taken under the item's row lock. */
export interface ApprovalItemFacts {
  subject: ApprovalSubject;
  itemId: string;
  title: string;
  clientId: string | null;
  clientArchived: boolean;
  /** The item's client's team (profile ids); [] for a task without a client. */
  teamIds: string[];
  /** Tasks only. */
  assigneeId: string | null;
  assignedBy: string | null;
  /** An event that is cancelled or postponed, or a done task: no approval can be requested. */
  inactive: "event_not_active" | "task_done" | null;
  stageId: string;
  stageName: string;
  stagePosition: number;
  approvers: ApproverToken[];
  /** The current stage already has an approved approval in this visit. */
  approved: boolean;
  /** A request for the current stage is already waiting. */
  pending: boolean;
}
