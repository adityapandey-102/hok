import type { Approval, ApprovalStatus, ApprovalSubject } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";

export type ApprovalView = "to_decide" | "requested" | "all_visible";

export interface ApprovalListResult {
  approvals: Approval[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApprovalListFilters {
  view?: ApprovalView;
  status?: ApprovalStatus;
  limit?: number;
  offset?: number;
}

export type ApprovalDecision = "approve" | "changes";

/** All HTTP calls the Approvals module makes against hok-api (round 3). */
export const approvalsApi = {
  /** Asks for approval of the item's CURRENT stage. */
  request(payload: { subject: ApprovalSubject; subjectId: string; note?: string; link?: string }): Promise<{ approval: Approval }> {
    return apiFetch("/approvals", { method: "POST", body: JSON.stringify(payload) });
  },

  decide(id: string, payload: { version: number; decision: ApprovalDecision; comment?: string }): Promise<{ approval: Approval }> {
    return apiFetch(`/approvals/${id}/decision`, { method: "POST", body: JSON.stringify(payload) });
  },

  cancel(id: string, version: number): Promise<{ approval: Approval }> {
    return apiFetch(`/approvals/${id}/cancel`, { method: "POST", body: JSON.stringify({ version }) });
  },

  list(filters: ApprovalListFilters = {}): Promise<ApprovalListResult> {
    const q = new URLSearchParams();
    if (filters.view) q.set("view", filters.view);
    if (filters.status) q.set("status", filters.status);
    if (filters.limit !== undefined) q.set("limit", String(filters.limit));
    if (filters.offset !== undefined) q.set("offset", String(filters.offset));
    return apiFetch(`/approvals?${q.toString()}`);
  },

  /** For the nav badge: how many pending approvals the caller can decide. */
  count(): Promise<{ toDecide: number }> {
    return apiFetch("/approvals/count");
  },
};
