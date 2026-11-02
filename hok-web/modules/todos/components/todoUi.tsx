import { TODO_URGENCY_LABELS, todoDueLabel, type TodoUrgency } from "../../../lib/domain";
import { StatusPill, type PillTone } from "../../../components/ui/StatusPill";
import { Icon } from "../../../components/ui/Icon";

const URGENCY_TONES: Record<Exclude<TodoUrgency, "low">, PillTone> = {
  urgent: "red",
  high: "amber",
  medium: "gray",
};

/** urgent = alert colour, high = warning, medium = neutral, low = muted (an outline, quieter than the rest). */
export function UrgencyPill({ urgency }: { urgency: TodoUrgency }) {
  if (urgency === "low") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-text-muted ring-1 ring-border ring-inset">
        {TODO_URGENCY_LABELS.low}
      </span>
    );
  }
  return <StatusPill label={TODO_URGENCY_LABELS[urgency]} tone={URGENCY_TONES[urgency]} />;
}

/** "Today 5:00 pm" (amber), "Overdue · 2 days" (red), else muted. Nothing for a to-do without a due time. */
export function TodoDue({ dueAt, done, zone }: { dueAt: string | null; done: boolean; zone: string }) {
  if (!dueAt) return null;
  const due = todoDueLabel(dueAt, done, zone);
  const tone = due.overdue ? "font-semibold text-error" : due.today ? "font-medium text-warning-text" : "text-text-muted";
  return (
    <span className={`inline-flex items-center gap-1 text-xs whitespace-nowrap ${tone}`}>
      <Icon name={due.overdue ? "alert" : "clock"} size={12} className="shrink-0" />
      {due.text}
    </span>
  );
}

/** A round tick box (44px tap area, 22px circle), the way the client to-do list draws it. */
export function TickBox({ done, busy, label, onToggle }: { done: boolean; busy?: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="group/tick flex h-11 w-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ring/25 disabled:cursor-default disabled:opacity-60"
    >
      <span
        className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-colors ${
          done ? "border-success bg-success text-white" : "border-text-muted/60 bg-card text-transparent group-hover/tick:border-text-primary"
        }`}
      >
        <Icon name="check" size={13} />
      </span>
    </button>
  );
}

/** The friendly message for a to-do API error code (falls back to the server's message). */
export function describeTodoError(err: unknown, fallback: string): string {
  const code = (err as { code?: string } | null)?.code;
  switch (code) {
    case "TODO_MODIFIED":
      return "This to-do was changed elsewhere. Reload to see the latest.";
    case "TODO_NOT_FOUND":
      return "This to-do no longer exists.";
    default:
      return err instanceof Error ? err.message : fallback;
  }
}
