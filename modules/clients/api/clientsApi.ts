import type { Client, ClientStatus, ClientSummary, Role, SocialHandles } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";
import { usersApi, type UserAccount } from "../../admin-users/api/usersApi";

export interface ClientListFilters {
  search?: string;
  status?: ClientStatus;
  industry?: string;
  ownerId?: string;
  limit?: number;
  offset?: number;
}

export interface ClientListResult {
  clients: ClientSummary[];
  total: number;
  limit: number;
  offset: number;
}

/** Create/edit body. Optional text: "" or null clears it on update. */
export interface ClientFields {
  businessName: string;
  logoUrl?: string | null;
  industry?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  socialHandles?: SocialHandles;
  services?: string[];
  contractStart?: string | null;
  contractEnd?: string | null;
  timeZone?: string;
  notes?: string | null;
}

export interface CreateClientPayload extends ClientFields {
  ownerId?: string;
}

export interface UpdateClientPayload extends Partial<ClientFields> {
  status?: "active" | "paused";
  version: number;
}

const OWNER_ROLES: Role[] = ["admin", "social_media_manager", "marketing_manager"];

/** All HTTP calls the Clients module makes against hok-api. */
export const clientsApi = {
  list(filters: ClientListFilters = {}): Promise<ClientListResult> {
    const q = new URLSearchParams();
    if (filters.search) q.set("search", filters.search);
    if (filters.status) q.set("status", filters.status);
    if (filters.industry) q.set("industry", filters.industry);
    if (filters.ownerId) q.set("ownerId", filters.ownerId);
    if (filters.limit !== undefined) q.set("limit", String(filters.limit));
    if (filters.offset !== undefined) q.set("offset", String(filters.offset));
    return apiFetch(`/clients?${q.toString()}`);
  },

  get(id: string): Promise<{ client: Client }> {
    return apiFetch(`/clients/${id}`);
  },

  create(payload: CreateClientPayload): Promise<{ client: Client }> {
    return apiFetch("/clients", { method: "POST", body: JSON.stringify(payload) });
  },

  update(id: string, payload: UpdateClientPayload): Promise<{ client: Client }> {
    return apiFetch(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  archive(id: string, version: number): Promise<{ client: Client }> {
    return apiFetch(`/clients/${id}/archive`, { method: "POST", body: JSON.stringify({ version }) });
  },

  unarchive(id: string, version: number): Promise<{ client: Client }> {
    return apiFetch(`/clients/${id}/unarchive`, { method: "POST", body: JSON.stringify({ version }) });
  },

  reassign(id: string, ownerId: string, version: number): Promise<{ client: Client }> {
    return apiFetch(`/clients/${id}/reassign`, { method: "POST", body: JSON.stringify({ ownerId, version }) });
  },

  /** Admin only (needs users:manage): the active accounts that can own clients. One page per role, capped at 100 each. */
  async listOwnerCandidates(): Promise<UserAccount[]> {
    const pages = await Promise.all(OWNER_ROLES.map((role) => usersApi.list({ role, limit: 100, offset: 0 })));
    return pages
      .flatMap((p) => p.users)
      .filter((u) => u.active)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
};
