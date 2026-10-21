import { addDays, dayKeyInZone, formatInZone, zonedWallTimeToIso, type DayKey } from "../../lib/domain";
import type { ActivityItem, ActivityKind } from "./api/activityApi";

/** "week" = the last 7 days; otherwise one day (a day key in the viewer's zone). */
export type RangeKey = "week" | DayKey;

export interface RangeChip {
  key: RangeKey;
  label: string;
}

const weekdayName = (day: DayKey) => new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

/** Today, Yesterday, then the weekday names for the four days before, then "Last 7 days". Days are the viewer's. */
export function rangeChips(today: DayKey): RangeChip[] {
  const chips: RangeChip[] = [
    { key: today, label: "Today" },
    { key: addDays(today, -1), label: "Yesterday" },
  ];
  for (let i = 2; i <= 6; i++) chips.push({ key: addDays(today, -i), label: weekdayName(addDays(today, -i)) });
  chips.push({ key: "week", label: "Last 7 days" });
  return chips;
}

/** The instants a chip stands for: local midnight to local midnight in the viewer's zone (DST-safe). */
export function rangeInstants(key: RangeKey, today: DayKey, zone: string): { from: string; to: string } {
  const first = key === "week" ? addDays(today, -6) : key;
  const last = key === "week" ? today : key;
  const from = zonedWallTimeToIso(`${first}T00:00`, zone);
  const to = zonedWallTimeToIso(`${addDays(last, 1)}T00:00`, zone);
  if (!from || !to) throw new Error("Invalid time zone");
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}

/** "just now", "5 min ago", "3 hours ago", "2 days ago", else the date. */
export function relativeTime(iso: string, now: number = Date.now(), zone?: string): string {
  const mins = Math.floor((now - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(zone ? { timeZone: zone } : {}) }).format(new Date(iso));
}

/** "Today", "Yesterday", or "Tue, 20 Oct" for a day key, relative to `today`. */
export function dayHeading(day: DayKey, today: DayKey): string {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** Items (already newest first) grouped under their day in the viewer's zone, keeping order. */
export function groupByDay(items: ActivityItem[], zone: string): { day: DayKey; items: ActivityItem[] }[] {
  const groups: { day: DayKey; items: ActivityItem[] }[] = [];
  for (const item of items) {
    const day = dayKeyInZone(item.at, zone);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

export const exactTime = (iso: string, zone: string) => formatInZone(iso, zone, true);

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const KIND_LABELS: Record<ActivityKind, string> = {
  clients: "Clients",
  events: "Events",
  tasks: "Tasks",
  comments: "Comments",
  assets: "Assets",
  accounts: "Accounts",
};

export const KIND_ICONS: Record<ActivityKind, "briefcase" | "calendar" | "clipboard" | "message" | "tag" | "user"> = {
  clients: "briefcase",
  events: "calendar",
  tasks: "clipboard",
  comments: "message",
  assets: "tag",
  accounts: "user",
};
