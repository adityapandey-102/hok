/** A web push to send once the claim has committed (its bell row is already written). */
export interface ReminderPush {
  type: "event_reminder" | "task_due_reminder";
  recipientIds: string[];
  actorId: null;
  /** The same shape as the notifications module's NotificationPayload. */
  payload: { title: string; body?: string | null; url?: string | null; data?: Record<string, string> };
}

export interface RemindersRepositoryPort {
  /**
   * In ONE transaction: claim up to `limit` events and `limit` tasks whose
   * moment is in (after, until] and that have no reminder yet (locked with
   * FOR UPDATE SKIP LOCKED, so two API instances never take the same row),
   * mark them reminded, and write their bell rows. Returns the pushes to send
   * after the commit. A claim that fails rolls back whole: nothing is marked.
   */
  claimDue(now: Date, window: { after: Date; until: Date }, limit: number): Promise<ReminderPush[]>;
}

export interface ReminderPusherPort {
  /** Web push only; never throws. */
  push(push: ReminderPush): Promise<void>;
}
