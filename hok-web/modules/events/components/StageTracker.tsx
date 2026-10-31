import type { StageRef } from "../../../lib/domain";
import { StageRail } from "../../../components/brand/StageRail";

/** An event's stages in order (finished, current, to come), on HOK's stage rail. */
export function StageTracker({ stages, currentStageId }: { stages: StageRef[]; currentStageId: string }) {
  return (
    <StageRail
      label="Event stages"
      stages={stages.map((s) => ({ key: s.id, name: s.name }))}
      currentIndex={stages.findIndex((s) => s.id === currentStageId)}
    />
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
        <div className="grow-x h-full rounded-full bg-ink" style={{ width: `${Math.max(share * 100, 4)}%` }} />
      </div>
    </div>
  );
}
