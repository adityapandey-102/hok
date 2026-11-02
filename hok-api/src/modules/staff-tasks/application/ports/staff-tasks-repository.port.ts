import type { Role } from "../../../../domain";
import type {
  StaffTaskDetail,
  StaffTaskEntity,
  StaffTaskFields,
  StaffTaskPriority,
  StaffTaskRelation,
  StaffTaskStatus,
  StaffTaskSummaryEntity,
} from "../../domain/staff-task.entity";
import type { AssigneeCandidate, StaffTaskScope, TaskClientRef, TaskEventRef } from "../../domain/staff-task.rules";

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

export interface NewStaffTaskRecord extends StaffTaskFields {
  assigneeId: string;
  assignedBy: string;
}

/** One timeline entry to append in the same transaction as the change. */
export interface StaffTaskUpdateEntry {
  kind: "status" | "reassigned" | "reopened";
  authorId: string;
  comment: string | null;
}

/**
 * What one guarded write changes. `status` stamps / clears completed_at in the
 * repository. `entry` (optional) is appended to the timeline in the same
 * transaction, with from/to taken from the locked row and these changes.
 * An empty object writes nothing (and doesn't bump the version).
 */
export interface StaffTaskChanges {
  fields?: Partial<StaffTaskFields>;
  assigneeId?: string;
  status?: StaffTaskStatus;
  entry?: StaffTaskUpdateEntry;
}

/** Guard callback: given the row as it stands after the lock, throw or return the changes. */
export type StaffTaskChangeDecision = (current: StaffTaskEntity) => StaffTaskChanges;

/** Persistence contract for staff tasks -- data access only, every multi-step write in one transaction. */
export interface StaffTasksRepositoryPort {
  /** One page joined to the assignee's name/role and the client's name (no per-row queries). */
  findMany(filters: StaffTaskListFilters, page: StaffTaskPage): Promise<StaffTaskSummaryEntity[]>;
  countMany(filters: StaffTaskListFilters): Promise<number>;
  findById(id: string): Promise<StaffTaskEntity | null>;
  /** The task + event title + the newest updates (capped); null if missing. */
  findDetail(id: string): Promise<StaffTaskDetail | null>;
  findAssigneeCandidate(userId: string): Promise<AssigneeCandidate | null>;
  /** The client and its team; null if there's no such client. */
  findClient(clientId: string): Promise<TaskClientRef | null>;
  /** Null if there's no such event -- or no events table yet (migration 20261013000004 not applied). */
  findEvent(eventId: string): Promise<TaskEventRef | null>;
  /** One transaction: insert the task and its "created" timeline entry. Returns the new id. */
  create(record: NewStaffTaskRecord): Promise<string>;
  /** One transaction: lock the task (FOR UPDATE), `decide`, apply, bump the version, append `entry`. */
  update(id: string, decide: StaffTaskChangeDecision): Promise<void>;
  /** Appends a comment (no version bump). `guard` sees the task first (scope check). */
  addComment(id: string, guard: (current: StaffTaskEntity) => void, authorId: string, comment: string): Promise<void>;
  /** Lock, `guard`, delete (the timeline cascades). Returns the deleted row as it was. */
  delete(id: string, guard: (current: StaffTaskEntity) => void): Promise<StaffTaskEntity>;
}

