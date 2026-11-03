/**
 * Who hears about approvals (bell + web push). Called AFTER the change committed; never throws. The composition root
 * (api/approvals.routes.ts) adapts it to the Notifications module -- this layer never imports it (ADR 0003).
 */
export interface ApprovalNotifier {
  /** Someone asked for approval: to everyone who could decide it (never the requester). */
  requested(n: {
    approvalId: string;
    subject: "event" | "task";
    itemId: string;
    itemTitle: string;
    stageName: string;
    recipientIds: string[];
    actorId: string;
  }): Promise<void>;
  /** Approved or changes requested: to the requester and the item's people. `actorId` is null when the client decided. */
  decided(n: {
    approvalId: string;
    subject: "event" | "task";
    itemId: string;
    itemTitle: string;
    stageName: string;
    decision: "approve" | "changes";
    via: "staff" | "portal";
    recipientIds: string[];
    actorId: string | null;
  }): Promise<void>;
}

export const noopApprovalNotifier: ApprovalNotifier = { requested: async () => {}, decided: async () => {} };
