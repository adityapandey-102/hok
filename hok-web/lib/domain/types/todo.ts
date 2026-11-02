/** My to-dos (round 1): private personal notes with a due time and an urgency. Mirror hok-api's todos module. */
export const TODO_URGENCIES = ["low", "medium", "high", "urgent"] as const;
export type TodoUrgency = (typeof TODO_URGENCIES)[number];

export const TODO_URGENCY_LABELS: Record<TodoUrgency, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/** Which reminders each urgency gets, in plain words (shown on the To-dos page and in the guide). */
export const TODO_REMINDER_TEXT: Record<TodoUrgency, string> = {
  urgent: "1 day before, 1 hour before and at the due time",
  high: "1 hour before and at the due time",
  medium: "at the due time",
  low: "none",
};

export interface Todo {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  urgency: TodoUrgency;
  done: boolean;
  doneAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** The dashboard's "My to-dos" section (every role). */
export interface TodosSection {
  open: number;
  overdue: number;
  /** Up to five open to-dos, soonest due first, undated last. */
  next: Todo[];
}
