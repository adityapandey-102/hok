import type { AssetType } from "../../assets/domain/asset.entity";
import type { EventState, EventType } from "../../events/domain/event.entity";

/** A client's portal link as staff see it -- never the token (only shown once, at generation). */
export interface PortalLinkEntity {
  id: string;
  clientId: string;
  active: boolean;
  createdAt: string;
  createdByName: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

/**
 * An event as the CLIENT may see it (FR-POR-04/07): title, type, dates in
 * UTC + the event's zone, where, the state, and a stage tracker. Never the
 * description, team, template, staff names, version or internal ids beyond
 * the event's own. (Since round 2 an event's detail also lists the assets staff
 * marked "visible to client" -- title, link, type, stage name and date only; never
 * their comment, tags, link preview or who added them.)
 */
export interface PortalEvent {
  id: string;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  location: string | null;
  state: EventState;
  stages: { position: number; name: string }[];
  currentStagePosition: number;
  stageCount: number;
}

/** A stage move the manager marked "visible to client" (FR-POR-06): no staff names. */
export interface PortalUpdate {
  stageName: string;
  note: string | null;
  createdAt: string;
}

/** A link staff chose to share with the client under this event ("Shared with you"). Client-safe: no comment, tags, preview or creator. */
export interface PortalAsset {
  id: string;
  title: string;
  url: string;
  type: AssetType;
  stageName: string | null;
  createdAt: string;
}

export interface PortalEventDetail extends PortalEvent {
  updates: PortalUpdate[];
  /** Newest first, at most PORTAL_ASSETS_LIMIT. */
  assets: PortalAsset[];
}

/** GET /portal/:token -- the client's dashboard. */
export interface PortalDashboard {
  client: { businessName: string; logoUrl: string | null; timeZone: string };
  /** The account manager's first name only (FR-POR-07: no staff data beyond that). */
  manager: { firstName: string };
  /** The next or in-progress active event, if any. */
  current: PortalEvent | null;
  upcoming: PortalEvent[];
  recent: PortalEvent[];
}

/** How many of each list the dashboard shows. */
export const PORTAL_UPCOMING_LIMIT = 10;
export const PORTAL_RECENT_LIMIT = 5;
/** Client-visible updates returned with one event (newest first). */
export const PORTAL_UPDATES_LIMIT = 50;
/** Client-visible assets returned with one event (newest first). */
export const PORTAL_ASSETS_LIMIT = 100;
