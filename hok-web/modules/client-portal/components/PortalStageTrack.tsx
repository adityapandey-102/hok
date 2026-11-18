import type { PortalStage } from "../api/publicPortalApi";
import { StageRail } from "../../../components/brand/StageRail";

/**
 * The client's progress tracker (FR-POR-04): every step in order, done ones ticked, the current one
 * highlighted. The client says "step"; a step waiting for their approval gets an amber ring and a
 * step with shared files a crimson count (round 5). `onStepClick` makes every step a button.
 */
export function PortalStageTrack({
  stages,
  currentPosition,
  approvalStagePosition = null,
  fileStages = [],
  onStepClick,
  summaryChips,
}: {
  stages: PortalStage[];
  currentPosition: number;
  /** The step an approval is waiting on (null: none). */
  approvalStagePosition?: number | null;
  /** Shared files per step. */
  fileStages?: { position: number; count: number }[];
  onStepClick?: (position: number) => void;
  /** Off on the project card, which already shows the approval and files tags above the steps. */
  summaryChips?: boolean;
}) {
  return (
    <StageRail
      label="Progress"
      unit="Step"
      stages={stages.map((s) => {
        const files = fileStages.find((f) => f.position === s.position)?.count ?? 0;
        const approval = approvalStagePosition === s.position;
        return { key: String(s.position), name: s.name, files, highlight: approval ? ("approval" as const) : files > 0 ? ("files" as const) : undefined };
      })}
      currentIndex={stages.findIndex((s) => s.position === currentPosition)}
      onStageClick={onStepClick ? (key) => onStepClick(Number(key)) : undefined}
      summaryChips={summaryChips}
    />
  );
}
