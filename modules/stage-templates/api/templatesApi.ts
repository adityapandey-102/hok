import type { StageTemplate } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";

export interface TemplateListResult {
  templates: StageTemplate[];
  total: number;
  limit: number;
  offset: number;
}

export const templatesApi = {
  /** Admin sees all (active filter); a manager only active ones. */
  list(filters: { search?: string; active?: boolean; limit?: number; offset?: number } = {}): Promise<TemplateListResult> {
    const q = new URLSearchParams();
    if (filters.search) q.set("search", filters.search);
    if (filters.active !== undefined) q.set("active", String(filters.active));
    if (filters.limit !== undefined) q.set("limit", String(filters.limit));
    if (filters.offset !== undefined) q.set("offset", String(filters.offset));
    return apiFetch(`/stage-templates?${q.toString()}`);
  },

  create(payload: { name: string; stages: string[] }): Promise<{ template: StageTemplate }> {
    return apiFetch("/stage-templates", { method: "POST", body: JSON.stringify(payload) });
  },

  update(
    id: string,
    payload: { name?: string; stages?: string[]; active?: boolean; version: number },
  ): Promise<{ template: StageTemplate }> {
    return apiFetch(`/stage-templates/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
};
