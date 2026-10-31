import type { StageTemplate } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";
import { SEARCH_SELECT_LIMIT, type SelectOption } from "../../../lib/api/options";

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

  /** SearchSelect loader: active templates matching `search`, at most 20. */
  async searchActiveOptions(search: string): Promise<SelectOption<StageTemplate>[]> {
    const page = await templatesApi.list({ active: true, search: search || undefined, limit: SEARCH_SELECT_LIMIT, offset: 0 });
    return page.templates.filter((t) => t.active).map((t) => ({ id: t.id, label: t.name, hint: `${t.stages.length} stages`, data: t }));
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
