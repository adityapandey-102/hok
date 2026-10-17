import type { PillTone } from "../../../components/ui/StatusPill";

export type CommentStatus = "received" | "in_progress" | "solved";

export const STATUS_TONES: Record<CommentStatus, PillTone> = {
  received: "amber",
  in_progress: "blue",
  solved: "green",
};

export const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
  received: "Received",
  in_progress: "In progress",
  solved: "Solved",
};

/** Moves the API allows. Never back to Received. */
export function allowedMoves(from: CommentStatus): CommentStatus[] {
  if (from === "received") return ["in_progress", "solved"];
  if (from === "in_progress") return ["solved"];
  return ["in_progress"];
}

/** Button label for a move ("Reopen" for Solved to In progress). */
export function moveLabel(from: CommentStatus, to: CommentStatus): string {
  if (from === "solved" && to === "in_progress") return "Reopen";
  if (to === "in_progress") return "Mark in progress";
  return "Mark solved";
}
