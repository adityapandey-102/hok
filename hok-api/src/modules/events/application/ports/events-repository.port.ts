import type { ApproverToken } from "../../../../domain";
import type { EventDetailRecord, EventEntity, EventStage, EventState, EventSummaryEntity, EventType } from "../../domain/event.entity";
import type { EventClient, EventTemplate } from "../../domain/event.rules";

/** List filters; `ownerId` (events of clients whose team includes this person) already resolved from the caller's scope by the service. */
export interface EventListFilters {
  ownerId?: string;
  clientId?: string;
  /** Overlap: events with starts_at < to and ends_at > from. Ordered earliest first when set, newest first otherwise. */
  range?: { from: string; to: string };
  state?: EventState;
  type?: EventType;
  search?: string;
}

export interface EventPage {
  limit: number;
  offset: number;
}

export interface NewEventRecord {
  clientId: string;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  location: string | null;
  description: string | null;
  assignedTeam: string[];
  templateId: string;
  templateName: string;
  /** Copied onto the event in this order; the first becomes the current stage. */
  stageNames: string[];
  /** Round 3: each stage's approvers (same order as `stageNames`); a missing entry means none. */
  stageApprovers?: ApproverToken[][];
  createdBy: string;
}

export interface EventChanges {
  title?: string;
  type?: EventType;
  startsAt?: string;
  endsAt?: string;
  timeZone?: string;
  location?: string | null;
  description?: string | null;
  assignedTeam?: string[];
  state?: EventState;
}

/** What a back move dropped: approvals that no longer count, and pending requests cancelled. */
export interface SupersededCounts {
  superseded: number;
  cancelled: number;
}

export interface StageMoveEntry {
  note: string | null;
  visibleToClient: boolean;
  changedBy: string;
}

/** Persistence contract for events -- data access only, every multi-step write in one transaction. */
export interface EventsRepositoryPort {
  /** One page joined to client name and current stage (no per-row queries). */
  findMany(filters: EventListFilters, page: EventPage): Promise<EventSummaryEntity[]>;
  countMany(filters: EventListFilters): Promise<number>;
  /** The event + stages + recent history (newest first, capped) + team names + approval rounds (newest first, capped); null if missing. */
  findDetail(id: string): Promise<EventDetailRecord | null>;
  findClient(clientId: string): Promise<EventClient | null>;
  findTemplate(templateId: string): Promise<EventTemplate | null>;
  /** Which of these ids are active staff accounts. */
  findActiveProfileIds(ids: readonly string[]): Promise<Set<string>>;
  /**
   * One transaction: lock the client row (FOR SHARE) and pass it to `guard`
   * (scope / archived re-checked after the lock), insert the event, copy the
   * stages, set the first as current, write the first history entry.
   */
  create(record: NewEventRecord, guard: (client: EventClient) => void): Promise<string>;
  /** Lock the event (FOR UPDATE), let `decide` check it and return the changes, apply them + bump the version. */
  update(id: string, decide: (current: EventEntity) => EventChanges): Promise<void>;
  /**
   * Lock the event, let `decide` check it against its stages and return the
   * target stage, then set it as current, bump the version and append the
   * history entry -- all in one transaction. `approvedStageIds` (round 3) = the stages
   * holding an approved approval, for the move gate. A BACK move also supersedes the
   * approvals of the stages from the target on, in the same transaction; the counts come back.
   */
  moveStage(
    id: string,
    decide: (current: EventEntity, stages: EventStage[], approvedStageIds: ReadonlySet<string>) => EventStage,
    entry: StageMoveEntry,
  ): Promise<SupersededCounts>;
}
