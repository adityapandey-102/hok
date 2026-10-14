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
export type SocialHandles = Partial<Record<SocialPlatform, string>>;

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
  contactPerson: string | null;
  status: ClientStatus;
  timeZone: string;
  contractEnd: string | null;
  archivedAt: string | null;
  version: number;
  createdAt: string;
}

export interface Client extends ClientSummary {
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  socialHandles: SocialHandles;
  services: string[];
  contractStart: string | null;
  notes: string | null;
  updatedAt: string;
}
