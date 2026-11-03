import type { ApproverToken, Role, StageTemplate, TemplateKind } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";
import { SEARCH_SELECT_LIMIT, type SelectOption } from "../../../lib/api/options";

/** A stage as sent to the API: a plain name (no approvers) or a name with who approves it. */
export type StageInput = string | { name: string; approvers?: ApproverToken[] };

export interface TemplateListResult {
  templates: StageTemplate[];
  total: number;
  limit: number;
  offset: number;
}

export interface TemplateListFilters {
  search?: string;
  active?: boolean;
  /** Event templates or task templates (round 2). */
  kind?: TemplateKind;
  /** Task templates offered for this assignee role (empty "for roles" counts as any role). */
  role?: Role;
  limit?: number;
  offset?: number;
}

export const templatesApi = {
  /** Admin sees all (active filter); managers only active ones (events: `kind=event`; the task picker: `kind=task`). */
  list(filters: TemplateListFilters = {}): Promise<TemplateListResult> {
    const q = new URLSearchParams();
    if (filters.search) q.set("search", filters.search);
    if (filters.active !== undefined) q.set("active", String(filters.active));
    if (filters.kind) q.set("kind", filters.kind);
    if (filters.role) q.set("role", filters.role);
    if (filters.limit !== undefined) q.set("limit", String(filters.limit));
    if (filters.offset !== undefined) q.set("offset", String(filters.offset));
    return apiFetch(`/stage-templates?${q.toString()}`);
  },

  /** SearchSelect loader for the event form: active EVENT templates matching `search`, at most 20. */
  async searchActiveOptions(search: string): Promise<SelectOption<StageTemplate>[]> {
    const page = await templatesApi.list({ kind: "event", active: true, search: search || undefined, limit: SEARCH_SELECT_LIMIT, offset: 0 });
    return page.templates.filter((t) => t.active).map((t) => ({ id: t.id, label: t.name, hint: `${t.stages.length} stages`, data: t }));
  },

  /** SearchSelect loader for the task form: active TASK templates offered for `role`, matching `search`, at most 20. */
  async searchTaskOptions(role: Role, search: string): Promise<SelectOption<StageTemplate>[]> {
    const page = await templatesApi.list({ kind: "task", role, active: true, search: search || undefined, limit: SEARCH_SELECT_LIMIT, offset: 0 });
    return page.templates.filter((t) => t.active).map((t) => ({ id: t.id, label: t.name, hint: `${t.stages.length} stages`, data: t }));
  },

  create(payload: { name: string; stages: StageInput[]; kind?: TemplateKind; roles?: Role[] }): Promise<{ template: StageTemplate }> {
    return apiFetch("/stage-templates", { method: "POST", body: JSON.stringify(payload) });
  },

  /** `kind` can never change after creation, so it is not part of the update. */
  update(
    id: string,
    payload: { name?: string; stages?: StageInput[]; active?: boolean; roles?: Role[]; version: number },
  ): Promise<{ template: StageTemplate }> {
    return apiFetch(`/stage-templates/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
};
