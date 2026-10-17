import type { Role } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";
import { SEARCH_SELECT_LIMIT, type SelectOption } from "../../../lib/api/options";

/** A staff account as returned by hok-api's /users endpoints. */
export interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  timeZone: string;
  phone: string | null;
  avatarUrl: string | null;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateUserPayload {
  fullName: string;
  email: string;
  role: Role;
  timeZone?: string;
  phone?: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  role?: Role;
  timeZone?: string;
  phone?: string | null;
}

export interface UserListFilters {
  search?: string;
  role?: Role;
  limit?: number;
  offset?: number;
}

/** GET /users envelope; `total` is the full count matching the filters, for the pager. */
export interface UserListResult {
  users: UserAccount[];
  total: number;
  limit: number;
  offset: number;
}

/** All HTTP calls the Admin Users module makes against hok-api; components never call apiFetch directly. */
export const usersApi = {
  list(filters: UserListFilters = {}): Promise<UserListResult> {
    const query = new URLSearchParams();
    if (filters.search) query.set("search", filters.search);
    if (filters.role) query.set("role", filters.role);
    if (filters.limit !== undefined) query.set("limit", String(filters.limit));
    if (filters.offset !== undefined) query.set("offset", String(filters.offset));
    return apiFetch(`/users?${query.toString()}`);
  },

  /** SearchSelect loader: active accounts matching `search` (name or email), at most 20, server-searched. */
  async searchOptions(search: string, role?: Role): Promise<SelectOption<UserAccount>[]> {
    const page = await usersApi.list({ search: search || undefined, role, limit: SEARCH_SELECT_LIMIT, offset: 0 });
    return page.users.map((u) => ({ id: u.id, label: u.fullName, hint: u.active ? u.email : `${u.email} (inactive)`, data: u }));
  },

  get(id: string): Promise<{ user: UserAccount }> {
    return apiFetch(`/users/${id}`);
  },

  /** Creates the account with a generated password (no invite email). The password is returned once. */
  create(payload: CreateUserPayload): Promise<{ userId: string; password: string }> {
    return apiFetch("/users", { method: "POST", body: JSON.stringify(payload) });
  },

  generatePassword(id: string): Promise<{ password: string }> {
    return apiFetch(`/users/${id}/generate-password`, { method: "POST" });
  },

  update(id: string, payload: UpdateUserPayload): Promise<null> {
    return apiFetch(`/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  deactivate(id: string): Promise<null> {
    return apiFetch(`/users/${id}/deactivate`, { method: "POST" });
  },

  reactivate(id: string): Promise<null> {
    return apiFetch(`/users/${id}/reactivate`, { method: "POST" });
  },
};
