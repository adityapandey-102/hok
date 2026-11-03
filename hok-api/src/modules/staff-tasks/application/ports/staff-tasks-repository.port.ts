import type { ApproverToken, Role } from "../../../../domain";
import type {
  StaffTaskDetail,
  StaffTaskEntity,
  StaffTaskFields,
  StaffTaskLink,
  StaffTaskPriority,
  StaffTaskRelation,
  StaffTaskStatus,
  StaffTaskSummaryEntity,
  TaskLinkKind,
  TaskStageFull,
} from "../../domain/staff-task.entity";
import type { AssigneeCandidate, StaffTaskScope, TaskClientRef, TaskEventRef, TaskTemplate } from "../../domain/staff-task.rules";

/**
 * Server-side list filters. `scope` is the caller's row scope and is ANDed
 * with every other filter (one query, no per-row work): "all" adds nothing;
 * "own" adds `assignee = me OR creator = me [OR on the client's team]`.
 */
export interface StaffTaskListFilters {
  scope: StaffTaskScope;
  /** The caller, for `relation`. */
  callerId: string;
  relation?: StaffTaskRelation;
  assigneeId?: string;
  /** The assignee's role. */
  role?: Role;
  status?: StaffTaskStatus;
  /** Every status except done. Ignored when `status` is set. */
  openOnly?: boolean;
  priority?: StaffTaskPriority;
  clientId?: string;
  /** Past due and not done, as of `now`. */
  overdue?: boolean;
  /** Due inside [dueFrom, dueTo). */
  dueFrom?: string;
  dueTo?: string;
  search?: string;
  /** The clock the overdue filter compares against (the service passes it so tests are deterministic). */
  now: string;
}

export interface StaffTaskPage {
  limit: number;
  offset: number;
}

/** A link to add to a task: the brief links of a new task, or one added later. */
export interface NewTaskLink {
  kind: TaskLinkKind;
  url: string;
  label: string | null;
  stageId: string | null;
  addedBy: string;
}

export interface NewStaffTaskRecord extends StaffTaskFields {
  assigneeId: string;
  assignedBy: string;
  /** The task template; its name and stage names are snapshotted onto the task. */
  templateId: string;
  templateName: string;
  stageNames: string[];
  /** Round 3: each stage's approvers (same order as `stageNames`); a missing entry means none. */
  stageApprovers?: ApproverToken[][];
  /** Brief links added at creation. */
  links: { url: string; label: string | null }[];
}

/** One timeline entry to append in the same transaction as the change. */
export interface StaffTaskUpdateEntry {
  kind: "reassigned" | "reopened" | "stage" | "completed" | "blocked" | "unblocked";
  authorId: string;
  comment: string | null;
  /** The stage a move or reopen lands on. The stage the task was at is taken from the locked row. */
  toStageId?: string;
}

/**
 * What one guarded write changes. `status` stamps / clears completed_at in the
 * repository. `stageId` moves the task to that stage. `blockedReason` sets (or, null,
 * clears) the reason. `entry` (optional) is appended to the timeline in the same
 * transaction, with from/to taken from the locked row and these changes.
 * An empty object writes nothing (and doesn't bump the version).
 */
export interface StaffTaskChanges {
  fields?: Partial<StaffTaskFields>;
  assigneeId?: string;
  status?: StaffTaskStatus;
  stageId?: string;
  blockedReason?: string | null;
  entry?: StaffTaskUpdateEntry;
  /**
   * Round 3, a BACK move or a reopen to the stage at this position: approvals of the stages from there on stop
   * counting (approved -> superseded, pending -> cancelled), in the same transaction.
   */
  supersedeFromPosition?: number;
}

/** What a back move dropped: approvals that no longer count, and pending requests cancelled. */
export interface SupersededCounts {
  superseded: number;
  cancelled: number;
}

/**
 * Guard callback: given the row as it stands after the lock (and its stages, with their approvers, and the ids of the
 * stages holding an approved approval -- the move gate's input), throw or return the changes.
 */
export type StaffTaskChangeDecision = (current: StaffTaskEntity, stages: TaskStageFull[], approvedStageIds: ReadonlySet<string>) => StaffTaskChanges;

/** What a link write sees under the task's lock. */
export interface LinkWriteContext {
  task: StaffTaskEntity;
  stages: TaskStageFull[];
  /** How many links the task holds right now. */
  linkCount: number;
}

/** What a link removal / share sees under the task's lock. */
export interface LinkTargetContext {
  task: StaffTaskEntity;
  link: StaffTaskLink;
}

/** The event (and its client) a delivered link is shared on, read under a lock inside the share transaction. */
export interface ShareEventContext {
  eventId: string;
  clientId: string;
  /** The client's team and status: the caller must be on it, and an archived client is read-only. */
  teamIds: string[];
  clientStatus: "active" | "paused" | "archived";
  /** The event's stage ids, to validate the chosen one. */
  stageIds: string[];
}

export interface ShareInput {
  title: string | null;
  /** An event stage, or null. */
  stageId: string | null;
  createdBy: string;
}

/** Persistence contract for staff tasks -- data access only, every multi-step write in one transaction. */
export interface StaffTasksRepositoryPort {
  /** One page joined to the assignee's name/role, the client's name and the current stage (no per-row queries). */
  findMany(filters: StaffTaskListFilters, page: StaffTaskPage): Promise<StaffTaskSummaryEntity[]>;
  countMany(filters: StaffTaskListFilters): Promise<number>;
  findById(id: string): Promise<StaffTaskEntity | null>;
  /** The task + event title + its stages, links and the newest updates (each one query); null if missing. */
  findDetail(id: string): Promise<StaffTaskDetail | null>;
  findAssigneeCandidate(userId: string): Promise<AssigneeCandidate | null>;
  /** The client and its team; null if there's no such client. */
  findClient(clientId: string): Promise<TaskClientRef | null>;
  /** Null if there's no such event -- or no events table yet (migration 20261013000004 not applied). */
  findEvent(eventId: string): Promise<TaskEventRef | null>;
  /** The stage template (any kind) with its stage names, or null. */
  findTemplate(templateId: string): Promise<TaskTemplate | null>;
  /** One transaction: insert the task, its stages, its brief links and its "created" timeline entry. Returns the new id. */
  create(record: NewStaffTaskRecord): Promise<string>;
  /** One transaction: lock the task (FOR UPDATE), `decide`, apply, bump the version, append `entry`; a back move / reopen also supersedes approvals. */
  update(id: string, decide: StaffTaskChangeDecision): Promise<SupersededCounts>;
  /** Appends a comment (no version bump). `guard` sees the task first (scope check). */
  addComment(id: string, guard: (current: StaffTaskEntity) => void, authorId: string, comment: string): Promise<void>;
  /** Lock, `guard`, delete (the timeline cascades). Returns the deleted row as it was. */
  delete(id: string, guard: (current: StaffTaskEntity) => void): Promise<StaffTaskEntity>;
  /** Lock the task, `guard` (sees the stages and the link count), insert the link (no version bump). Returns the link id. */
  addLink(taskId: string, guard: (ctx: LinkWriteContext) => void, link: NewTaskLink): Promise<string>;
  /** Lock the task, find the link on it (404 STAFF_TASK_LINK_NOT_FOUND), `guard`, delete it. Returns the removed link. */
  removeLink(taskId: string, linkId: string, guard: (ctx: LinkTargetContext) => void): Promise<StaffTaskLink>;
  /**
   * ONE transaction: lock the task and the link, read the event's client (locked FOR SHARE), `guard`,
   * insert the client-visible asset and set the link's shared_asset_id. Returns the new asset's id.
   * Cross-module write (assets), Infrastructure-to-Infrastructure (ADR 0003).
   */
  shareLink(
    taskId: string,
    linkId: string,
    input: ShareInput,
    guard: (ctx: LinkTargetContext, event: ShareEventContext | null) => void,
  ): Promise<{ assetId: string; url: string }>;
}
