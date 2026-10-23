/** Client portfolio types. Mirror hok-api's clients module responses (FR-CLI-01..07). */
export const CLIENT_STATUSES = ["active", "paused", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "linkedin",
  "x",
  "threads",
  "pinterest",
  "snapchat",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
/** One account; a business may have several on the same platform. */
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

/** How many of each a client can list (hok-api enforces the same). */
export const CLIENT_LIST_MAX = { websites: 10, phones: 10, contacts: 20, socialAccounts: 20 } as const;

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
  threads: "Threads",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
};

export interface ClientSummary {
  id: string;
  ownerId: string;
  ownerName: string;
  businessName: string;
  logoUrl: string | null;
  industry: string | null;
  /** The first contact's name. */
  contactPerson: string | null;
  status: ClientStatus;
  timeZone: string;
  contractEnd: string | null;
  archivedAt: string | null;
  version: number;
  createdAt: string;
}

export interface Client extends Omit<ClientSummary, "contactPerson"> {
  /** The business's own email; people have theirs in `contacts`. */
  email: string | null;
  address: string | null;
  websites: string[];
  phones: string[];
  contacts: ClientContact[];
  socialAccounts: SocialAccount[];
  services: string[];
  contractStart: string | null;
  notes: string | null;
  updatedAt: string;
}
