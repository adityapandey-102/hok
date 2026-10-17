import type { PortalStage } from "../api/publicPortalApi";

/**
 * The client's progress tracker (FR-POR-04): every stage in order, done ones
 * ticked, the current one highlighted. Wraps onto several lines on a phone.
 */
export function PortalStageTrack({ stages, currentPosition }: { stages: PortalStage[]; currentPosition: number }) {
  return (
    <ol className="flex flex-wrap gap-x-1.5 gap-y-2" aria-label="Progress">
      {stages.map((s) => {
        const done = s.position < currentPosition;
        const current = s.position === currentPosition;
        return (
          <li
            key={s.position}
            aria-current={current ? "step" : undefined}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
              current
                ? "current-pulse border-success bg-success text-white"
                : done
                  ? "border-success/40 bg-success-bg text-text-secondary"
                  : "border-border bg-card text-text-muted"
            }`}
          >
            <span aria-hidden>{done ? "✓" : s.position}</span>
            <span>{s.name}</span>
            {current && <span className="sr-only">(current stage)</span>}
          </li>
        );
      })}
    </ol>
  );
}
