import type { ClientEntity, ClientSummaryEntity } from "../domain/client.entity";
import type { ClientResponseDto, ClientSummaryResponseDto } from "./dto/client.response.dto";

/** Domain entity -> response DTO. Identical today; kept explicit so the two can diverge later (e.g. a portal-safe view in M8). */
export function toClientResponseDto(c: ClientEntity): ClientResponseDto {
  return {
    id: c.id,
    ownerId: c.ownerId,
    ownerName: c.ownerName,
    businessName: c.businessName,
    logoUrl: c.logoUrl,
    industry: c.industry,
    email: c.email,
    address: c.address,
    websites: c.websites,
    phones: c.phones,
    contacts: c.contacts,
    socialAccounts: c.socialAccounts,
    services: c.services,
    contractStart: c.contractStart,
    contractEnd: c.contractEnd,
    timeZone: c.timeZone,
    notes: c.notes,
    status: c.status,
    archivedAt: c.archivedAt,
    version: c.version,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function toClientSummaryResponseDto(c: ClientSummaryEntity): ClientSummaryResponseDto {
  return {
    id: c.id,
    ownerId: c.ownerId,
    ownerName: c.ownerName,
    businessName: c.businessName,
    logoUrl: c.logoUrl,
    industry: c.industry,
    contactPerson: c.contactPerson,
    status: c.status,
    timeZone: c.timeZone,
    contractEnd: c.contractEnd,
    archivedAt: c.archivedAt,
    version: c.version,
    createdAt: c.createdAt,
  };
}
