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
}

export interface StageTemplate {
  id: string;
  name: string;
  active: boolean;
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
  history: EventHistoryEntry[];
  team: { id: string; fullName: string }[];
}
