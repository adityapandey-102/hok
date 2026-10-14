/**
 * Client events (REQUIREMENTS §5.3). Instants are ISO strings in UTC;
 * `timeZone` is the IANA zone the event happens in (ARCHITECTURE §10).
 */

export const EVENT_TYPES = ["shoot", "campaign", "meeting", "content_posting", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** FR-EVT-04: on top of its stage, any event can be cancelled or postponed (and set back to active). */
export const EVENT_STATES = ["active", "cancelled", "postponed"] as const;
export type EventState = (typeof EVENT_STATES)[number];

/** Longest event; also lets a calendar range query bound its scan on starts_at. */
export const EVENT_MAX_DURATION_DAYS = 31;
/** Widest calendar range one request may ask for (a month view plus its leading/trailing weeks, or a quarter). */
export const EVENT_RANGE_MAX_DAYS = 92;
export const EVENT_TEAM_MAX = 20;

export interface EventStage {
  id: string;
  position: number;
  name: string;
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
  ownerId: string;
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
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /events/:id and every write's response: the event with its stages, recent history and team names. */
export interface EventDetail extends EventEntity {
  stages: EventStage[];
  history: EventHistoryEntry[];
  team: { id: string; fullName: string }[];
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
