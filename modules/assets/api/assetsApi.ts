import type { Asset, AssetType, TagSuggestion } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";

export interface AssetListFilters {
  clientId?: string;
  eventId?: string;
  search?: string;
  type?: AssetType;
  tag?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AssetListResult {
  assets: Asset[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateAssetPayload {
  clientId: string;
  title: string;
  url: string;
  type: AssetType;
  comment?: string | null;
  eventId?: string | null;
  tags?: string[];
}

export interface UpdateAssetPayload {
  title?: string;
  url?: string;
  type?: AssetType;
  comment?: string | null;
  eventId?: string | null;
  tags?: string[];
  version: number;
}

/** All HTTP calls the Assets module makes against hok-api. */
export const assetsApi = {
  list(filters: AssetListFilters = {}): Promise<AssetListResult> {
    const q = new URLSearchParams();
    for (const key of ["clientId", "eventId", "search", "type", "tag", "from", "to"] as const) {
      const value = filters[key];
      if (value) q.set(key, value);
    }
    if (filters.limit !== undefined) q.set("limit", String(filters.limit));
    if (filters.offset !== undefined) q.set("offset", String(filters.offset));
    return apiFetch(`/assets?${q.toString()}`);
  },

  create(payload: CreateAssetPayload): Promise<{ asset: Asset }> {
    return apiFetch("/assets", { method: "POST", body: JSON.stringify(payload) });
  },

  update(id: string, payload: UpdateAssetPayload): Promise<{ asset: Asset }> {
    return apiFetch(`/assets/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  remove(id: string, version: number): Promise<null> {
    return apiFetch(`/assets/${id}?version=${version}`, { method: "DELETE" });
  },

  /** Tag auto-suggest: one client's tags (or all in scope), `q` matches anywhere, most used first. */
  tags(params: { clientId?: string; q?: string; limit?: number } = {}): Promise<{ tags: TagSuggestion[] }> {
    const q = new URLSearchParams();
    if (params.clientId) q.set("clientId", params.clientId);
    if (params.q) q.set("q", params.q);
    if (params.limit !== undefined) q.set("limit", String(params.limit));
    return apiFetch(`/assets/tags?${q.toString()}`);
  },
};
