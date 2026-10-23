/**
 * Pure domain shapes for a client (REQUIREMENTS FR-CLI-02) -- no persistence
 * or HTTP concerns. Dates (`contractStart`/`contractEnd`) are calendar days,
 * `YYYY-MM-DD`; instants are ISO strings in UTC.
 */

export const CLIENT_STATUSES = ["active", "paused", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

/** The statuses a normal edit (PATCH) may set. Archiving has its own action, because it also stamps archived_at. */
export const EDITABLE_CLIENT_STATUSES = ["active", "paused"] as const satisfies readonly ClientStatus[];
export type EditableClientStatus = (typeof EDITABLE_CLIENT_STATUSES)[number];

/** The social networks a client can list accounts on (the form's drop-down). */
export const SOCIAL_PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "linkedin", "x", "threads", "pinterest", "snapchat"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** One account, e.g. `{ platform: "instagram", handle: "@acme" }`. A business may have several on the same platform. */
export interface SocialAccount {
  platform: SocialPlatform;
  handle: string;
}

/** A person to talk to at the client; phone and email are optional. */
export interface ClientContact {
  name: string;
  phone: string | null;
  email: string | null;
}

/** The editable profile fields, shared by create and update. */
export interface ClientProfileFields {
  businessName: string;
  logoUrl: string | null;
  industry: string | null;
  /** The business's own email. People have theirs in `contacts`. */
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
}

/** A client in full (GET /clients/:id and every write's response). */
export interface ClientEntity extends ClientProfileFields {
  id: string;
  ownerId: string;
  /** The owning manager's name, joined in the same query. */
  ownerName: string;
  status: ClientStatus;
  archivedAt: string | null;
  /** Optimistic-lock token: send it back with a write; a stale one is 409 CLIENT_MODIFIED. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** A list row: what a client list shows, without the long free-text fields (notes, address, handles). */
export interface ClientSummaryEntity {
  id: string;
  ownerId: string;
  ownerName: string;
  businessName: string;
  logoUrl: string | null;
  industry: string | null;
  /** The first contact's name (what a list row shows). */
  contactPerson: string | null;
  status: ClientStatus;
  timeZone: string;
  contractEnd: string | null;
  archivedAt: string | null;
  version: number;
  createdAt: string;
}
