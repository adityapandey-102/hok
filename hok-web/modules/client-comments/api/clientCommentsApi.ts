import { apiFetch } from "../../../lib/api/client";
import type { CommentStatus } from "../lib/commentStatus";

export interface ClientComment {
  id: string;
  clientId: string;
  clientName: string;
  ownerId: string;
  eventId: string | null;
  eventTitle: string | null;
  body: string;
  status: CommentStatus;
  reply: string | null;
  repliedAt: string | null;
  repliedByName: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentListFilters {
  clientId?: string;
  status?: CommentStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CommentListResult {
  comments: ClientComment[];
  total: number;
  limit: number;
  offset: number;
}

export const clientCommentsApi = {
  list(filters: CommentListFilters = {}): Promise<CommentListResult> {
    const q = new URLSearchParams();
    if (filters.clientId) q.set("clientId", filters.clientId);
    if (filters.status) q.set("status", filters.status);
    if (filters.search) q.set("search", filters.search);
    if (filters.limit !== undefined) q.set("limit", String(filters.limit));
    if (filters.offset !== undefined) q.set("offset", String(filters.offset));
    return apiFetch(`/client-comments?${q.toString()}`);
  },
  counts(): Promise<{ received: number; inProgress: number }> {
    return apiFetch("/client-comments/counts");
  },
  get(id: string): Promise<{ comment: ClientComment }> {
    return apiFetch(`/client-comments/${id}`);
  },
  update(
    id: string,
    payload: { status?: CommentStatus; reply?: string | null; version: number },
  ): Promise<{ comment: ClientComment }> {
    return apiFetch(`/client-comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};
