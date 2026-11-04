import type { StageRef } from "../../../lib/domain";
import { StageRail } from "../../../components/brand/StageRail";

/**
 * A stage list in order (finished, current, to come), on HOK's stage rail; approval stages carry a lock, or a green seal once approved. Events and staff
 * tasks share it. `done` marks the whole list finished (a completed task has no current stage).
 */
export function StageTracker({
  stages,
  currentStageId,
  label = "Event stages",
  done = false,
  approvedStageIds = [],
}: {
  stages: StageRef[];
  currentStageId: string;
  label?: string;
  done?: boolean;
  /** Approval stages that currently have an approved approval (shown with a green seal). */
  approvedStageIds?: string[];
}) {
  return (
    <StageRail
      label={label}
      stages={stages.map((s) => ({ key: s.id, name: s.name, approval: s.approvers.length === 0 ? undefined : approvedStageIds.includes(s.id) ? ("approved" as const) : ("needed" as const), parts: s.openChildren }))}
      currentIndex={done ? stages.length : stages.findIndex((s) => s.id === currentStageId)}
    />
  );
}
