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

/**
 * A request waiting for THIS client's approval (round 3): only on a stage whose approvers include the client.
 * Client-safe: the stage's name, the note and link staff attached, when it was asked -- no staff names or ids.
 */
export interface PortalPendingApproval {
  id: string;
  /** Echoed back with the decision (optimistic lock). */
  version: number;
  stageName: string;
  requestNote: string | null;
  requestLink: string | null;
  requestedAt: string;
}

/** A decided round on a stage the client approves (approved or changes requested). No staff names: `decidedVia` says only whether it was the client (portal) or staff on their behalf. */
export interface PortalApprovalHistoryEntry {
  stageName: string;
  status: "approved" | "changes_requested";
  decidedVia: "staff" | "portal" | null;
  decidedAt: string;
  decisionComment: string | null;
}

export interface PortalEventDetail extends PortalEvent {
  updates: PortalUpdate[];
  /** Newest first, at most PORTAL_ASSETS_LIMIT. */
  assets: PortalAsset[];
  /** The request waiting for the client, or null. */
  pendingApproval: PortalPendingApproval | null;
  /** Decided rounds on client-approved stages, newest first, at most 20. */
  approvalHistory: PortalApprovalHistoryEntry[];
}

/** GET /portal/:token -- the client's dashboard. */
export interface PortalDashboard {
  client: { businessName: string; logoUrl: string | null; timeZone: string };
  /** The account manager's first name only (FR-POR-07: no staff data beyond that). */
  manager: { firstName: string };
  /** The next or in-progress active event, if any; `awaitingYourApproval` = a request is waiting for the client on it. */
  current: (PortalEvent & { awaitingYourApproval: boolean }) | null;
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
