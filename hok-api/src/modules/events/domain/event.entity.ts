/**
 * Client events (REQUIREMENTS §5.3). Instants are ISO strings in UTC;
 * `timeZone` is the IANA zone the event happens in (ARCHITECTURE §10).
 */

import type { Approval, ApprovalRecord, ApproverToken, ParentRef, WorkChild, WorkChildRow, WorkParent, WorkParentRecord } from "../../../domain";

export const EVENT_TYPES = ["shoot", "campaign", "meeting", "content_posting", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** FR-EVT-04: on top of its stage, any event can be cancelled or postponed (and set back to active). */
export const EVENT_STATES = ["active", "cancelled", "postponed"] as const;
export type EventState = (typeof EVENT_STATES)[number];

// An event's longest span and the widest calendar range are the shared
// MAX_ITEM_DAYS / MAX_RANGE_DAYS in src/domain/time-range.ts: the calendar
// and the subscribe feed bound their scans on them, so there is one copy.
export const EVENT_TEAM_MAX = 20;

export interface EventStage {
  id: string;
  position: number;
  name: string;
  /** Round 3: who can approve this stage (empty = no approval needed). Snapshotted from the template. */
  approvers: ApproverToken[];
}

/** A stage as a detail lists it: with how many unfinished child events/tasks hang on it (round 4). */
export interface EventStageView extends EventStage {
  openChildren: number;
}

/** One stage move (FR-EVT-06); the first entry (fromStageId null) is written when the event is created. */
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

/** The event row plus what its client contributes to the rules (owner scope, archived = read-only). */
export interface EventEntity {
  id: string;
  clientId: string;
  clientName: string;
  /** The client's lead. */
  ownerId: string;
  /** The client's team: who may see and work on this event (internal, never sent to the browser). */
  teamIds: string[];
  clientStatus: "active" | "paused" | "archived";
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  location: string | null;
  description: string | null;
  assignedTeam: string[];
  templateId: string | null;
  templateName: string;
  currentStageId: string;
  stageCount: number;
  state: EventState;
  /** Round 4: the parent this event is a part of and the stage it hangs on; null for a top-level event. Internal. */
  parentRef: ParentRef | null;
  /** 1 = top level, up to 3. Internal. */
  depth: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** What the repository reads for a detail: the event with its stages, recent history, team names and approval rounds (without the caller's flags). */
export interface EventDetailRecord extends EventEntity {
  stages: EventStageView[];
  history: EventHistoryEntry[];
  team: { id: string; fullName: string }[];
  /** All approval rounds, newest first, capped. */
  approvalRecords: ApprovalRecord[];
  /** Round 4: the parent (with what visibility needs), the children (up to 200 per kind) and how many the database counted in all. */
  parentRecord: WorkParentRecord | null;
  childRows: WorkChildRow[];
  childTotal: number;
}

/** GET /events/:id and every write's response: the event with its stages, recent history, team names, approvals (round 3) and parts (round 4). */
export interface EventDetail extends Omit<EventDetailRecord, "approvalRecords" | "parentRef" | "depth" | "parentRecord" | "childRows" | "childTotal"> {
  approvals: Approval[];
  /** The stage that stops forward moves right now (it needs an approval, or has unfinished parts), or null. */
  nextBlockedBy: { stageId: string; stageName: string; reason: "approval" | "children"; openChildren: number } | null;
  /** "Part of: <parent> > <stage>": null for a top-level event, or when the caller can't see the parent. */
  parent: WorkParent | null;
  /** The child events and tasks the caller can see (parent-stage order), and how many more exist that they can't. */
  children: WorkChild[];
  hiddenChildren: number;
}

/** A list / calendar row: no description or team; the current stage's name and position for the tracker. */
export interface EventSummaryEntity {
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
