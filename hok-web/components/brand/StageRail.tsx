import { Icon } from "../ui/Icon";

/**
 * A production-stage rail (staff event pages and the client portal): finished
 * stages are ink nodes with a tick, the current one is a crimson node with a
 * soft pulse, the rest are hollow and numbered. It runs across
 * from tablets up and down on phones, so long stage names never squeeze.
 */
export function StageRail({
  stages,
  currentIndex,
  label = "Stages",
}: {
  stages: { key: string; name: string }[];
  /** Index into `stages` of the current one (-1 if none). */
  currentIndex: number;
  label?: string;
}) {
  return (
    <ol aria-label={label} className="flex flex-col sm:flex-row">
      {stages.map((s, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const last = i === stages.length - 1;
        return (
          <li
            key={s.key}
            aria-current={current ? "step" : undefined}
            className="relative flex min-w-0 gap-3 pb-5 last:pb-0 sm:flex-1 sm:flex-col sm:gap-2 sm:pr-2 sm:pb-0"
          >
            {!last && (
              <span
                aria-hidden
                className={`absolute top-7 bottom-1 left-[11px] w-[2px] rounded-full sm:top-[11px] sm:right-1 sm:bottom-auto sm:left-8 sm:h-[2px] sm:w-auto ${
                  done ? "bg-ink" : "bg-border"
                }`}
              />
            )}
            <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center">
              {current ? (
                <span className="current-pulse flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <span className="h-2 w-2 rounded-full bg-white" />
                </span>
              ) : done ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-on-ink">
                  <Icon name="check" size={13} strokeWidth={3} />
                </span>
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-border bg-card text-[10.5px] font-semibold text-text-muted">
                  {i + 1}
                </span>
              )}
            </span>
            <span
              title={s.name}
              className={`min-w-0 pt-0.5 text-[12.5px] leading-snug sm:truncate sm:pt-0 ${
                current ? "font-semibold text-text-primary" : done ? "text-text-secondary" : "text-text-muted"
              }`}
            >
              {s.name}
              {current && <span className="sr-only"> (current stage)</span>}
              {done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
