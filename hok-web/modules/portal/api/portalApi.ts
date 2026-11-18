import { apiFetch } from "../../../lib/api/client";

export interface PortalLink {
  id: string;
  clientId: string;
  active: boolean;
  createdAt: string;
  createdByName: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  /** The shareable link while the link is active (staff routes only); null when switched off or made before round 5. */
  url: string | null;
}

export interface GeneratedPortalLink {
  link: PortalLink;
  token: string;
  url: string;
}

export const portalApi = {
  get(clientId: string): Promise<{ link: PortalLink | null }> {
    return apiFetch(`/portal-links/${clientId}`);
  },
  generate(clientId: string): Promise<GeneratedPortalLink> {
    return apiFetch(`/portal-links/${clientId}`, { method: "POST" });
  },
  disable(clientId: string): Promise<{ link: PortalLink | null }> {
    return apiFetch(`/portal-links/${clientId}/disable`, { method: "POST" });
  },
};
