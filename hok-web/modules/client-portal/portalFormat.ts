import type { PortalCommentStatus, PortalEvent } from "./api/publicPortalApi";

/** Client-facing wording (plain, no internal jargon). */
export const COMMENT_STATUS_LABEL: Record<PortalCommentStatus, string> = {
  received: "Received",
  in_progress: "In progress",
  solved: "Solved",
};

export const COMMENT_STATUS_TONE: Record<PortalCommentStatus, "gray" | "blue" | "green"> = {
  received: "gray",
  in_progress: "blue",
  solved: "green",
};

const TYPE_LABEL: Record<string, string> = {
  shoot: "Shoot",
  campaign: "Campaign",
  meeting: "Meeting",
  content_posting: "Content posting",
  other: "Event",
};

export function eventTypeLabel(type: string): string {
  return TYPE_LABEL[type] ?? "Event";
}

/** "Thu 20 Nov, 10:00 – 12:00" in the client's zone; spans days when needed. */
export function formatEventWhen(e: Pick<PortalEvent, "startsAt" | "endsAt">, zone: string): string {
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", day: "numeric", month: "short" });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit" });
  const start = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  const sameDay = day.format(start) === day.format(end);
  return sameDay
    ? `${day.format(start)}, ${time.format(start)} – ${time.format(end)}`
    : `${day.format(start)}, ${time.format(start)} – ${day.format(end)}, ${time.format(end)}`;
}

/** Progress as the client sees it: "Stage 3 of 6 · Editing". */
export function stageSummary(e: Pick<PortalEvent, "stages" | "currentStagePosition" | "stageCount">): string {
  const current = e.stages.find((s) => s.position === e.currentStagePosition);
  return `Stage ${e.currentStagePosition} of ${e.stageCount}${current ? ` · ${current.name}` : ""}`;
}

/** Short relative date for comment threads, in the client's zone. */
export function formatShortDate(iso: string, zone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
