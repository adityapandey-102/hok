import { pgTable, uuid, text, jsonb, date, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import type { ClientContact, ClientStatus, SocialAccount } from "../domain/client.entity";

/**
 * The Clients module owns `clients`. Other modules (events, assets, portal,
 * comments) that need a client row read it through an Infrastructure-to-
 * Infrastructure import of this file (docs/adr/0003-per-module-schema-ownership.md).
 *
 * Mirrors supabase/migrations/20261013000003_clients.sql for typed queries
 * only -- the DDL, CHECK constraints, indexes, trigger and RLS live there.
 * `contract_start`/`contract_end` are read as `YYYY-MM-DD` strings (calendar
 * days, no time zone), never as JS Dates.
 */
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull(),
  businessName: text("business_name").notNull(),
  logoUrl: text("logo_url"),
  industry: text("industry"),
  email: text("email"),
  address: text("address"),
  websites: text("websites").array().notNull().default([]),
  phones: text("phones").array().notNull().default([]),
  contacts: jsonb("contacts").notNull().$type<ClientContact[]>().default([]),
  socialAccounts: jsonb("social_accounts").notNull().$type<SocialAccount[]>().default([]),
  services: text("services").array().notNull().default([]),
  contractStart: date("contract_start", { mode: "string" }),
  contractEnd: date("contract_end", { mode: "string" }),
  timeZone: text("time_zone").notNull(),
  notes: text("notes"),
  status: text("status").notNull().$type<ClientStatus>().default("active"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A client's assigned team (migration 20261023000001). The lead
 * (`clients.owner_id`) is always one of them. A manager sees a client only
 * while they're on its team; the Admin sees every client.
 */
export const clientMembers = pgTable(
  "client_members",
  {
    clientId: uuid("client_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    addedBy: uuid("added_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.profileId] })],
);
