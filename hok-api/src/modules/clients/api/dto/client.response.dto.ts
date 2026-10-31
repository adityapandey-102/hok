import type { ClientContact, ClientStatus, ClientTeamMember, SocialAccount } from "../../domain/client.entity";

/** GET /clients/:id and every write's `{ client }`. */
export interface ClientResponseDto {
  id: string;
  ownerId: string;
  ownerName: string;
  businessName: string;
  logoUrl: string | null;
  industry: string | null;
  email: string | null;
  address: string | null;
  websites: string[];
  phones: string[];
  contacts: ClientContact[];
  socialAccounts: SocialAccount[];
  services: string[];
  contractStart: string | null;
  contractEnd: string | null;
  timeZone: string;
  notes: string | null;
  /** Everyone assigned, lead first (`ownerId` / `ownerName` are the lead). */
  team: ClientTeamMember[];
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
