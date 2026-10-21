import { and, desc, eq, ilike, ne, sql, type SQL } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { containsPattern } from "../../../common/database/like-pattern";
import { NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
// Cross-module Infrastructure-only read: `profiles` is owned by the Users
// module's schema (owner name, owner candidate). See docs/adr/0003.
import { profiles } from "../../users/infrastructure/profile.schema";
// Cross-module Infrastructure-only write: the new owner's bell entry goes in
// the same transaction as the reassignment, through the Notifications
// module's public surface (ARCHITECTURE §8). See docs/adr/0003.
import { clientReassignedPayload, insertNotificationsInTransaction } from "../../notifications/notifications.module";
// Cross-module Infrastructure-only write: archiving a client revokes its active
// portal link in the same transaction (FR-CLI-07: archive disables the portal;
// an unarchive must never bring an old link back). See docs/adr/0003.
import { portalLinks } from "../../portal/infrastructure/portal.schema";
import { clients } from "./clients.schema";
import { ClientMapper, type ClientRow, type ClientSummaryRow } from "./client.mapper";
import type { ClientEntity } from "../domain/client.entity";
import type { OwnerCandidate } from "../domain/client-ownership.rules";
import type {
  ClientChangeDecision,
  ClientListFilters,
  ClientListPage,
  ClientsRepositoryPort,
  NewClientRecord } from "../application/ports/clients-repository.port";
import { guarded } from "../../../common/database/guarded";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A full client + its owner's name: one query, one join (never a per-row owner lookup). */
const CLIENT_SELECT = {
  id: clients.id,
  ownerId: clients.ownerId,
  ownerName: profiles.fullName,
  businessName: clients.businessName,
  logoUrl: clients.logoUrl,
  industry: clients.industry,
  contactPerson: clients.contactPerson,
  phone: clients.phone,
  email: clients.email,
  address: clients.address,
  website: clients.website,
  socialHandles: clients.socialHandles,
  services: clients.services,
  contractStart: clients.contractStart,
  contractEnd: clients.contractEnd,
  timeZone: clients.timeZone,
  notes: clients.notes,
  status: clients.status,
  archivedAt: clients.archivedAt,
  version: clients.version,
  createdAt: clients.createdAt,
  updatedAt: clients.updatedAt,
};

/** Exactly what a list row shows -- no notes, address or handles (engineering-practices: no unnecessary columns). */
const CLIENT_SUMMARY_SELECT = {
  id: clients.id,
  ownerId: clients.ownerId,
  ownerName: profiles.fullName,
  businessName: clients.businessName,
  logoUrl: clients.logoUrl,
  industry: clients.industry,
  contactPerson: clients.contactPerson,
  status: clients.status,
  timeZone: clients.timeZone,
  contractEnd: clients.contractEnd,
  archivedAt: clients.archivedAt,
  version: clients.version,
  createdAt: clients.createdAt,
};


async function selectClient(ex: Executor, id: string, forUpdate = false): Promise<ClientEntity | null> {
  const query = ex
    .select(CLIENT_SELECT)
    .from(clients)
    .innerJoin(profiles, eq(profiles.id, clients.ownerId))
    .where(eq(clients.id, id))
    .limit(1);
  // FOR UPDATE OF clients: lock only the client row, not its owner's profile.
  const rows: ClientRow[] = forUpdate ? await query.for("update", { of: clients }) : await query;
  const row = rows[0];
  return row ? ClientMapper.toEntity(row) : null;
}

/**
 * Persistence for clients through Drizzle. Scale: ~100-500 clients
 * (REQUIREMENTS NFR), so each list is one page query + one count, served by
 * the indexes in the migration (owner/status + created_at, lower(industry),
 * a trigram index on business_name).
 */
export class DrizzleClientsRepository implements ClientsRepositoryPort {
  /** Shared by findMany and countMany so the page and its total can never disagree. */
  private listConditions(filters: ClientListFilters): SQL | undefined {
    const conditions: SQL[] = [];
    // No status = the working list: archived clients are hidden (FR-CLI-07).
    conditions.push(filters.status ? eq(clients.status, filters.status) : ne(clients.status, "archived"));
    if (filters.ownerId) conditions.push(eq(clients.ownerId, filters.ownerId));
    if (filters.search) conditions.push(ilike(clients.businessName, containsPattern(filters.search)));
    if (filters.industry) conditions.push(sql`lower(${clients.industry}) = lower(${filters.industry})`);
    return and(...conditions);
  }

  findMany(filters: ClientListFilters, page: ClientListPage) {
    return guarded("load clients", async () => {
      const rows: ClientSummaryRow[] = await db
        .select(CLIENT_SUMMARY_SELECT)
        .from(clients)
        .innerJoin(profiles, eq(profiles.id, clients.ownerId))
        .where(this.listConditions(filters))
        // Newest first; id breaks ties so pages stay stable.
        .orderBy(desc(clients.createdAt), desc(clients.id))
        .limit(page.limit)
        .offset(page.offset);
      return rows.map((row) => ClientMapper.toSummary(row));
    });
  }

  countMany(filters: ClientListFilters) {
    return guarded("count clients", async () => {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(clients)
        .where(this.listConditions(filters));
      return row?.count ?? 0;
    });
  }

  findById(id: string) {
    return guarded("load the client", () => selectClient(db, id));
  }

  create(record: NewClientRecord) {
    return guarded("create the client", async () => {
      const [inserted] = await db
        .insert(clients)
        .values({
          ownerId: record.ownerId,
          businessName: record.businessName,
          logoUrl: record.logoUrl,
          industry: record.industry,
          contactPerson: record.contactPerson,
          phone: record.phone,
          email: record.email,
          address: record.address,
          website: record.website,
          socialHandles: record.socialHandles,
          services: record.services,
          contractStart: record.contractStart,
          contractEnd: record.contractEnd,
          timeZone: record.timeZone,
          notes: record.notes,
        })
        .returning({ id: clients.id });
      // Re-read with the owner's name (one more indexed lookup, on create only).
      return (await selectClient(db, inserted!.id))!;
    });
  }

  update(id: string, decide: ClientChangeDecision) {
    return guarded("update the client", async () => {
      await db.transaction(async (tx) => {
        const current = await selectClient(tx, id, true);
        if (!current) throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
        const changes = decide(current);

        const set: Partial<typeof clients.$inferInsert> = { ...changes.fields };
        if (changes.status !== undefined) set.status = changes.status;
        if (changes.ownerId !== undefined) set.ownerId = changes.ownerId;
        if (changes.archivedAt === null) set.archivedAt = null;
        if (Object.keys(set).length === 0 && changes.archivedAt === undefined) return; // nothing to write

        await tx
          .update(clients)
          .set({
            ...set,
            ...(changes.archivedAt === "now" ? { archivedAt: sql`now()` } : {}),
            version: sql`${clients.version} + 1`,
          })
          .where(eq(clients.id, id));

        if (changes.archivedAt === "now") {
          await tx
            .update(portalLinks)
            .set({ active: false, revokedAt: sql`now()` })
            .where(and(eq(portalLinks.clientId, id), eq(portalLinks.active, true)));
        }

        const notice = changes.reassignedNotice;
        if (notice) {
          await insertNotificationsInTransaction(tx, {
            type: "client_reassigned",
            recipientIds: [notice.toOwnerId],
            actorId: notice.actorId,
            payload: clientReassignedPayload({ clientId: notice.clientId, clientName: notice.clientName }),
          });
        }
      });
      return (await selectClient(db, id))!;
    });
  }

  findOwnerCandidate(userId: string) {
    return guarded("load the new owner", async (): Promise<OwnerCandidate | null> => {
      const [row] = await db
        .select({ id: profiles.id, role: profiles.role, active: profiles.active })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      return row ?? null;
    });
  }
}
