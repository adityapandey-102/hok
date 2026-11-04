import type { EventState } from "./event";
import type { StaffTaskStatus } from "./staffTask";

/**
 * Parent and child work (round 4, "Parts"). Mirror hok-api's work-tree rules. From any stage of an event or a
 * task, someone allowed to move it adds child events or tasks tied to that stage. While a stage has unfinished
 * parts the parent can't pass it.
 */
export type WorkKind = "event" | "task";

/** The `parent` body of POST /events and POST /staff-tasks. */
export interface WorkParentRef {
  kind: WorkKind;
  id: string;
  stageId: string;
}

/** "Part of: <title> > <stageName>" on a child's detail; null when there is no parent or the caller can't see it. */
export interface WorkParent extends WorkParentRef {
  title: string;
  stageName: string;
}

/** One part (child) as a parent's detail lists it. Only parts the caller can see. */
export interface WorkChild {
  kind: WorkKind;
  id: string;
  title: string;
  /** The parent's stage it hangs on. */
  stageId: string;
  stageName: string;
  currentStageName: string;
  currentPosition: number;
  stageCount: number;
  /** Tasks only. */
  status: StaffTaskStatus | null;
  /** Events only. */
  state: EventState | null;
  /** Done (task) / on its last stage and approved if needed (event). A cancelled event is not finished, but does not block. */
  finished: boolean;
  /** Tasks only. */
  assigneeName: string | null;
}

/** The API's limits on one parent: how deep parts nest, and (this screen's own cap) how many to create in one go. */
export const WORK_MAX_DEPTH = 3;
export const PARTS_MAX_AT_ONCE = 20;
