import type { ClientContact, ClientEntity, ClientStatus, ClientSummaryEntity, SocialAccount } from "../domain/client.entity";

/** Raw shape of the repository's CLIENT_SELECT projection (pg returns timestamptz as Date; `date` columns are read as strings). */
export interface ClientRow {
  id: string;
  ownerId: string;
  ownerName: string;
  businessName: string;
  logoUrl: string | null;
  industry: string | null;
  /** The first contact's name; only the summary projection selects it. */
  contactPerson: string | null;
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
  status: ClientStatus;
  archivedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Raw shape of CLIENT_SUMMARY_SELECT. */
export type ClientSummaryRow = Pick<
  ClientRow,
  | "id"
  | "ownerId"
  | "ownerName"
  | "businessName"
  | "logoUrl"
  | "industry"
  | "contactPerson"
  | "status"
  | "timeZone"
  | "contractEnd"
  | "archivedAt"
  | "version"
  | "createdAt"
>;

/** Row -> domain entity. Sync, no logic beyond Date -> ISO string. */
export const ClientMapper = {
  toEntity(row: Omit<ClientRow, "contactPerson">): ClientEntity {
    return {
      ...row,
      websites: row.websites ?? [],
      phones: row.phones ?? [],
      contacts: row.contacts ?? [],
      socialAccounts: row.socialAccounts ?? [],
      services: row.services ?? [],
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  },

  toSummary(row: ClientSummaryRow): ClientSummaryEntity {
    return {
      ...row,
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  },
};
