import type { StaffTaskStatus } from "../../domain/staff-task.entity";

/**
 * HOOK POINT FOR M9 (notifications). FR-TSK-07 / FR-NTF-03:
 *
 *   - "task assigned"   -> the assignee        (create, and reassign to someone new)
 *   - "status changed"  -> the Admin who assigned it (or every Admin) when the
 *                          assignee moves it; the assignee when the Admin
 *                          moves or reopens it
 *   - "comment added"   -> the other side (Admin <-> assignee)
 *
 * StaffTasksService calls these AFTER the change has committed, with the
 * actor, so M9 can skip notifying people about their own actions. Today the
 * default implementation does nothing. M9 replaces it with one that writes
 * the in-app `notifications` row and sends web push (ARCHITECTURE §8). If M9
 * wants the in-app row inside the same transaction, it can move that insert
 * into the repository's write (the `entry` already passed there) and keep
 * only the push here.
 */
export interface StaffTaskNotifier {
  taskAssigned(event: { taskId: string; title: string; assigneeId: string; actorId: string }): Promise<void>;
  statusChanged(event: {
    taskId: string;
    title: string;
    assigneeId: string;
    assignedBy: string | null;
    from: StaffTaskStatus;
    to: StaffTaskStatus;
    actorId: string;
    comment: string | null;
  }): Promise<void>;
  commentAdded(event: { taskId: string; title: string; assigneeId: string; assignedBy: string | null; actorId: string }): Promise<void>;
}

/** TODO(M9): replace with the notifications module's implementation. */
export const noopStaffTaskNotifier: StaffTaskNotifier = {
  taskAssigned: () => Promise.resolve(),
  statusChanged: () => Promise.resolve(),
  commentAdded: () => Promise.resolve(),
};
