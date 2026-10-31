import { apiFetch } from "../../../lib/api/client";

export const ACTIVITY_KINDS = ["all", "clients", "events", "tasks", "comments", "assets", "accounts"] as const;
export type ActivityFilterKind = (typeof ACTIVITY_KINDS)[number];
export type ActivityKind = Exclude<ActivityFilterKind, "all">;

/** Wire shape of GET /activity (mirrors hok-api's activity.entity.ts). */
export interface ActivityItem {
  id: string;
  at: string;
  kind: ActivityKind;
  actor: { id: string; name: string } | null;
  summary: string;
  url: string | null;
}

export interface ActivityPage {
  items: ActivityItem[];
  total: number;
  limit: number;
  offset: number;
}

/** All HTTP calls the Activity module makes against hok-api. */
export const activityApi = {
  /** The activity log (Admin): server-side range, kind and person filters and paging. */
  list(params: { from: string; to: string; kind: ActivityFilterKind; actorId?: string; limit: number; offset: number }): Promise<ActivityPage> {
    const q = new URLSearchParams({ from: params.from, to: params.to, limit: String(params.limit), offset: String(params.offset) });
    if (params.kind !== "all") q.set("kind", params.kind);
    if (params.actorId) q.set("actorId", params.actorId);
    return apiFetch(`/activity?${q.toString()}`);
  },
};
