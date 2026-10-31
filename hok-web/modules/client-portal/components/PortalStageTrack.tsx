import type { PortalStage } from "../api/publicPortalApi";
import { StageRail } from "../../../components/brand/StageRail";

/** The client's progress tracker (FR-POR-04): every stage in order, done ones ticked, the current one highlighted. */
export function PortalStageTrack({ stages, currentPosition }: { stages: PortalStage[]; currentPosition: number }) {
  return (
    <StageRail
      label="Progress"
      stages={stages.map((s) => ({ key: String(s.position), name: s.name }))}
      currentIndex={stages.findIndex((s) => s.position === currentPosition)}
    />
  );
}
