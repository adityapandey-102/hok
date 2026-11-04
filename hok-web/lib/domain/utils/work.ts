import type { WorkChild } from "../types/work";
import { PARTS_MAX_AT_ONCE } from "../types/work";
import { stageProgressLabel } from "./taskStages";

/** The longest title the API takes (events and tasks). */
const TITLE_MAX = 160;

/** "How many?" input -> a whole number from 1 to 20 (anything else becomes 1). */
export function clampPartCount(raw: string | number): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), PARTS_MAX_AT_ONCE);
}

/**
 * The titles for "create N parts": one part keeps the title as typed; more get " 1" … " N" added
 * ("Reel" -> "Reel 1", "Reel 2"). A long title is cut so the number still fits in 160 characters.
 */
export function bulkTitles(title: string, count: number): string[] {
  const base = title.trim();
  const n = clampPartCount(count);
  if (n === 1) return [base];
  const suffixRoom = String(n).length + 1;
  const cut = base.length + suffixRoom > TITLE_MAX ? base.slice(0, TITLE_MAX - suffixRoom).trimEnd() : base;
  return Array.from({ length: n }, (_, i) => `${cut} ${i + 1}`);
}

/** Where a part is, in the words of its list row: "Done", "Cancelled", "Postponed" or "Rough cut · 2/5". */
export function partProgressLabel(c: Pick<WorkChild, "kind" | "state" | "status" | "finished" | "currentStageName" | "currentPosition" | "stageCount">): string {
  if (c.kind === "event" && c.state === "cancelled") return "Cancelled";
  if (c.finished) return "Done";
  if (c.kind === "event" && c.state === "postponed") return "Postponed";
  return stageProgressLabel({ name: c.currentStageName, position: c.currentPosition }, c.stageCount);
}

/** A part that no longer holds its parent's stage back: finished, or a cancelled event. */
export function isPartSettled(c: Pick<WorkChild, "kind" | "state" | "finished">): boolean {
  return c.finished || (c.kind === "event" && c.state === "cancelled");
}

export interface PartsGroup {
  stageId: string;
  stageName: string;
  position: number;
  parts: WorkChild[];
  /** Parts here that still hold the stage (the API's count when given, else counted from the visible ones). */
  open: number;
}

/**
 * The parts grouped by the parent stage they hang on, in stage order; stages without parts are left out.
 * `stages[].openChildren` (from the API) counts hidden parts too, so it wins over what is visible.
 */
export function groupPartsByStage(parts: readonly WorkChild[], stages: readonly { id: string; name: string; position: number; openChildren?: number }[]): PartsGroup[] {
  const groups: PartsGroup[] = [];
  for (const s of [...stages].sort((a, b) => a.position - b.position)) {
    const mine = parts.filter((p) => p.stageId === s.id);
    if (mine.length === 0) continue;
    groups.push({ stageId: s.id, stageName: s.name, position: s.position, parts: mine, open: s.openChildren ?? mine.filter((p) => !isPartSettled(p)).length });
  }
  return groups;
}

/** "3 of 10 parts finished" (visible parts only; cancelled ones aren't counted). */
export function partsSummary(parts: readonly WorkChild[]): string {
  const counted = parts.filter((p) => !(p.kind === "event" && p.state === "cancelled"));
  const done = counted.filter((p) => p.finished).length;
  return `${done} of ${counted.length} ${counted.length === 1 ? "part" : "parts"} finished`;
}

/** "+2 you can't see", or null when none are hidden. */
export function hiddenPartsLabel(hidden: number): string | null {
  return hidden > 0 ? `+${hidden} you can't see` : null;
}

/** Plain-language text for the parent/child error codes; null for any other code (the caller falls back). */
export function workErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case "STAGE_CHILDREN_OPEN":
      return "This stage still has unfinished parts. Finish them first.";
    case "WORK_TOO_DEEP":
      return "Parts can only go 3 levels deep (a part of a part of a part).";
    case "WORK_PARENT_STAGE_INVALID":
      return "That stage doesn't belong to the item. Reload the page and try again.";
    case "WORK_CHILD_EVENT_NEEDS_CLIENT":
      return "An event part needs a client, and this task has none. Link the task to a client first.";
    case "WORK_CHILD_CLIENT_MISMATCH":
      return "A part must belong to the same client as the item it is part of.";
    default:
      return null;
  }
}

/** The part's page. */
export function partHref(c: Pick<WorkChild, "kind" | "id">): string {
  return c.kind === "event" ? `/app/events/${c.id}` : `/app/tasks/${c.id}`;
}

/** "Creating 3 of 10…" while parts are made one by one. */
export function creatingLabel(done: number, total: number): string {
  return `Creating ${Math.min(done + 1, total)} of ${total}…`;
}

/** The summary after creating parts: all made, or how far it got and why it stopped. */
export function createdSummary(made: number, total: number, failure?: string): string {
  if (!failure) return made === 1 ? "Part created." : `${made} parts created.`;
  return `${made} of ${total} parts created. Stopped at part ${made + 1}: ${failure}`;
}
