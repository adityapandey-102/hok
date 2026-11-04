import type { Role } from "../constants/roles";
import type { Approval, ApproverToken, NextBlockedBy } from "./approval";
import type { WorkChild, WorkParent } from "./work";

/** Stage templates and client events (M4). Mirror hok-api's stage-templates and events modules. */
export const EVENT_TYPES = ["shoot", "campaign", "meeting", "content_posting", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  shoot: "Shoot",
  campaign: "Campaign",
  meeting: "Meeting",
  content_posting: "Content posting",
  other: "Other",
};

export const EVENT_STATES = ["active", "cancelled", "postponed"] as const;
export type EventState = (typeof EVENT_STATES)[number];
export const EVENT_STATE_LABELS: Record<EventState, string> = {
  active: "Active",
  cancelled: "Cancelled",
  postponed: "Postponed",
};

export interface StageRef {
  id: string;
  position: number;
  name: string;
  /** Who may approve this stage (round 3); empty = no approval needed. */
  approvers: ApproverToken[];
  /** Unfinished parts hanging on this stage (round 4; only on an event's or task's own stages, not a template's). */
  openChildren?: number;
}

/** What a stage template is for (round 2): the stages of a client event, or of a staff task. */
export const TEMPLATE_KINDS = ["event", "task"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export interface StageTemplate {
  id: string;
  name: string;
  active: boolean;
  kind: TemplateKind;
  /** Task templates: the assignee roles it is offered for. Empty = any role. Always empty for event templates. */
  roles: Role[];
  stages: StageRef[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventSummary {
  id: string;
  clientId: string;
  clientName: string;
  ownerId: string;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  location: string | null;
  state: EventState;
  templateName: string;
  currentStageId: string;
  currentStageName: string;
  currentStagePosition: number;
  stageCount: number;
  version: number;
}

export interface EventHistoryEntry {
  id: string;
  fromStageId: string | null;
  toStageId: string;
  note: string | null;
  visibleToClient: boolean;
  changedBy: string | null;
  changedByName: string | null;
  createdAt: string;
}

export interface EventDetail extends EventSummary {
  clientStatus: "active" | "paused" | "archived";
  description: string | null;
  assignedTeam: string[];
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
  stages: StageRef[];
  /** Every approval round, newest first (at most 100). */
  approvals: Approval[];
  /** The approval stage that stops forward moves, or null. */
  nextBlockedBy: NextBlockedBy | null;
  history: EventHistoryEntry[];
  team: { id: string; fullName: string }[];
  /** Round 4: the item this one is a part of (null when top-level or not visible to the caller). */
  parent: WorkParent | null;
  /** The parts the caller can see, in parent-stage order. */
  children: WorkChild[];
  /** Parts that exist but the caller cannot see (they still hold the parent's stage). */
  hiddenChildren: number;
}
