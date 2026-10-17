import { addDays, dayKeyInZone, type DayKey, type StaffTaskStatus } from "../../lib/domain";
import type { DashboardEvent } from "./api/dashboardApi";

/** Whole days from day key `a` to day key `b` (positive when `b` is later). */
export function dayDiff(a: DayKey, b: DayKey): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** "Overdue 2d", "Due today", "Due tomorrow", "Due in 3d", "Done" or "No due date", by calendar day in the viewer's zone. */
export function dueText(dueAt: string | null, status: StaffTaskStatus, zone: string, now: number = Date.now()): string {
  if (status === "done") return "Done";
  if (!dueAt) return "No due date";
  const diff = dayDiff(dayKeyInZone(now, zone), dayKeyInZone(dueAt, zone));
  if (diff < 0) return `Overdue ${-diff}d`;
  if (diff === 0) return Date.parse(dueAt) < now ? "Overdue today" : "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff}d`;
}

export function isOverdueText(text: string): boolean {
  return text.startsWith("Overdue");
}

/** "Editing (2/4)": the event's current stage and how far along it is. */
export function stageProgress(e: Pick<DashboardEvent, "currentStageName" | "currentStagePosition" | "stageCount">): string {
  return `${e.currentStageName} (${e.currentStagePosition}/${e.stageCount})`;
}

/** Percent of stages reached, 0..100. */
export function stagePercent(e: Pick<DashboardEvent, "currentStagePosition" | "stageCount">): number {
  if (e.stageCount <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((e.currentStagePosition / e.stageCount) * 100)));
}

/** Seven consecutive day keys from `today`, each with the events that overlap it (in the viewer's zone). */
export function weekStrip(today: DayKey, events: DashboardEvent[], zone: string): { day: DayKey; count: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i);
    const count = events.filter((e) => dayKeyInZone(e.startsAt, zone) <= day && day <= dayKeyInZone(new Date(Math.max(Date.parse(e.endsAt) - 1, Date.parse(e.startsAt))), zone)).length;
    return { day, count };
  });
}

/** Bar width percentages (0..100) relative to the biggest count; at least a sliver for non-zero counts. */
export function barPercents(counts: number[]): number[] {
  const max = Math.max(0, ...counts);
  return counts.map((c) => (max === 0 || c === 0 ? 0 : Math.max(4, Math.round((c / max) * 100))));
}

/** Total of the four task status counts. */
export function totalTasks(c: { todo: number; in_progress: number; blocked: number; done: number }): number {
  return c.todo + c.in_progress + c.blocked + c.done;
}
