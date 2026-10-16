/**
 * Pure domain shapes for the asset link library (REQUIREMENTS FR-AST-01..07).
 * The platform stores LINKS only -- never files. Instants are ISO strings (UTC).
 */

export const ASSET_TYPES = ["photo", "video", "document", "design", "audio", "other"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TAGS_MAX = 10;
export const ASSET_TAG_MAX_LENGTH = 30;

/** An asset in full, as stored: one shape for list rows, GET /assets/:id and every write's response. */
export interface AssetEntity {
  id: string;
  clientId: string;
  clientName: string;
  /** The client's owner and status: needed for the row scope and the archived rule; not part of the response's asset fields. */
  ownerId: string;
  clientStatus: "active" | "paused" | "archived";
  eventId: string | null;
  /** Joined in the same query, for display. */
  eventTitle: string | null;
  title: string;
  url: string;
  type: AssetType;
  comment: string | null;
  /** Tag names, sorted case-insensitively. */
  tags: string[];
  createdBy: string | null;
  createdByName: string | null;
  /** Optimistic-lock token: send it back with a write; a stale one is 409 ASSET_MODIFIED. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** The fields a create/update sets (tags are handled separately). */
export interface AssetFields {
  title: string;
  url: string;
  type: AssetType;
  comment: string | null;
  eventId: string | null;
}

/** A tag suggestion: the name and how many live assets use it. */
export interface TagSuggestion {
  name: string;
  uses: number;
}
