/** Asset links (M6). Mirror hok-api's assets module. Links only, never files. */
export const ASSET_TYPES = ["photo", "video", "document", "design", "audio", "other"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  photo: "Photo",
  video: "Video",
  document: "Document",
  design: "Design",
  audio: "Audio",
  other: "Other",
};

export const ASSET_TAGS_MAX = 10;
export const ASSET_TAG_MAX_LENGTH = 30;

export interface Asset {
  id: string;
  clientId: string;
  clientName: string;
  clientStatus: "active" | "paused" | "archived";
  eventId: string | null;
  eventTitle: string | null;
  title: string;
  url: string;
  type: AssetType;
  comment: string | null;
  /** What the link points to, fetched by the API after a save; null until then or when the page has none. */
  preview: { title: string | null; description: string | null; imageUrl: string | null; siteName: string | null } | null;
  tags: string[];
  /** The client sees this link on its event page in the portal (round 2). Needs an event. */
  visibleToClient: boolean;
  /** The event stage it belongs to, for the client's "Shared with you" list. */
  eventStageId: string | null;
  eventStageName: string | null;
  createdBy: string | null;
  createdByName: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TagSuggestion {
  name: string;
  uses: number;
}
