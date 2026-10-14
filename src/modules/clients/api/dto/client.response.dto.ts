import type { ClientStatus, SocialHandles } from "../../domain/client.entity";

/** GET /clients/:id and every write's `{ client }`. */
export interface ClientResponseDto {
  id: string;
  ownerId: string;
  ownerName: string;
  businessName: string;
  logoUrl: string | null;
  industry: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  socialHandles: SocialHandles;
  services: string[];
  contractStart: string | null;
  contractEnd: string | null;
  timeZone: string;
  notes: string | null;
  status: ClientStatus;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** One row of GET /clients. */
export interface ClientSummaryResponseDto {
  id: string;
  ownerId: string;
  ownerName: string;
  businessName: string;
  logoUrl: string | null;
  industry: string | null;
  contactPerson: string | null;
  status: ClientStatus;
  timeZone: string;
  contractEnd: string | null;
  archivedAt: string | null;
  version: number;
  createdAt: string;
}

export interface ClientListResponseDto {
  clients: ClientSummaryResponseDto[];
  total: number;
  limit: number;
  offset: number;
}
