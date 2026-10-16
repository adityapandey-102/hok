import type { StageRef } from "../../../lib/domain";

/**
 * An event stage tracker: every stage in order, finished ones filled, the
 * current one highlighted, the rest muted. Wraps on a phone. `onDark` is not
 * needed; the tracker sits on a card.
 */
export function StageTracker({ stages, currentStageId }: { stages: StageRef[]; currentStageId: string }) {
  const current = stages.findIndex((s) => s.id === currentStageId);
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-3" aria-label="Event stages">
      {stages.map((s, i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <li key={s.id} className="flex min-w-[88px] flex-1 flex-col gap-1.5" aria-current={isCurrent ? "step" : undefined}>
            <div
              className={`h-1.5 rounded-full ${done ? "bg-success" : isCurrent ? "bg-primary" : "bg-border-light"}`}
            />
            <span
              className={`text-[12px] leading-tight ${
                isCurrent ? "font-semibold text-text-primary" : done ? "text-text-secondary" : "text-text-muted"
              }`}
            >
              {s.position}. {s.name}
              {isCurrent && <span className="sr-only"> (current stage)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Compact one-line progress for list rows: current stage name over a thin bar. */
export function StageProgressBar({ name, position, count }: { name: string; position: number; count: number }) {
  const share = count > 0 ? position / count : 0;
  return (
    <div title={`Stage ${position} of ${count}`} className="min-w-[110px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12.5px] text-text-primary">{name}</span>
        <span className="shrink-0 text-[10.5px] text-text-muted">
          {position}/{count}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border-light">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(share * 100, 4)}%` }} />
      </div>
    </div>
  );
}
