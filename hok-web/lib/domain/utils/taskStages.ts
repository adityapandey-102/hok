import { ROLE_LABELS, type Role } from "../constants/roles";
import type { TaskLink, TaskStage } from "../types/staffTask";

/** "Rough cut · 2/5": the current stage and how far along the task is. */
export function stageProgressLabel(stage: { name: string; position: number }, stageCount: number): string {
  return `${stage.name} · ${stage.position}/${stageCount}`;
}

/** The stage after `currentId`, or null on the last one (or when the id is unknown). Stages need not arrive sorted. */
export function nextStageOf(stages: readonly TaskStage[], currentId: string): TaskStage | null {
  const sorted = [...stages].sort((a, b) => a.position - b.position);
  const i = sorted.findIndex((s) => s.id === currentId);
  return i >= 0 && i < sorted.length - 1 ? sorted[i + 1]! : null;
}

/** True on the final stage, where "Mark complete" replaces "Move to …". */
export function isLastStage(stages: readonly TaskStage[], currentId: string): boolean {
  return stages.length > 0 && nextStageOf(stages, currentId) === null && stages.some((s) => s.id === currentId);
}

/** The stages a task can jump to: every one except where it is now, in order. */
export function otherStages(stages: readonly TaskStage[], currentId: string): TaskStage[] {
  return [...stages].filter((s) => s.id !== currentId).sort((a, b) => a.position - b.position);
}

/** A link's visible name: its label, else the address's host ("drive.google.com"), else the raw text. */
export function linkDisplayName(link: Pick<TaskLink, "label" | "url">): string {
  if (link.label?.trim()) return link.label.trim();
  try {
    return new URL(link.url).host || link.url;
  } catch {
    return link.url;
  }
}

/** Which roles a task template is for: "Any role", or the role names joined with commas. */
export function templateRolesLabel(roles: readonly Role[]): string {
  return roles.length === 0 ? "Any role" : roles.map((r) => ROLE_LABELS[r]).join(", ");
}
