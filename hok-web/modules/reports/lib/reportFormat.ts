/** Pure helpers for the Reports screens (months, labels, small figures). */

export interface ClientCommentStatusCounts {
  received: number;
  in_progress: number;
  solved: number;
}

export const REPORT_MONTH_COUNT = 6;

/** The reports tabs, in order. The open one lives in the URL as `?view=`. */
export const REPORT_VIEWS = ["team", "staff", "client", "activity"] as const;
export type ReportView = (typeof REPORT_VIEWS)[number];

export function parseReportView(value: string | null): ReportView {
  return (REPORT_VIEWS as readonly string[]).includes(value ?? "") ? (value as ReportView) : "team";
}

/** "YYYY-MM" for the current month in `timeZone` (the viewer's own, as the API measures months). */
export function currentMonthKey(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

/** "October 2026" for "2026-10". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The last 6 months, newest first (the API allows exactly these). */
export function lastSixMonths(now: Date, timeZone: string): { value: string; label: string }[] {
  const [y, m] = currentMonthKey(now, timeZone).split("-").map(Number) as [number, number];
  return Array.from({ length: REPORT_MONTH_COUNT }, (_, i) => {
    const idx = y * 12 + (m - 1) - i;
    const value = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
    return { value, label: monthLabel(value) };
  });
}

/** "1-4 Oct" or "5-11 Oct" for a week's first and last day (YYYY-MM-DD). */
export function weekLabel(startDay: string, endDay: string): string {
  const d = (k: string) => new Date(`${k}T00:00:00Z`);
  const month = d(endDay).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const a = Number(startDay.slice(8));
  const b = Number(endDay.slice(8));
  return a === b ? `${a} ${month}` : `${a}–${b} ${month}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0]![0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "")).toUpperCase();
}

/** Whole-number percentage of `part` in `total` (0 when there is no total). */
export function percent(part: number, total: number): number {
  return total <= 0 ? 0 : Math.round((part / total) * 100);
}

/** "3.5 days", "1 day", or an en dash when there is nothing to average. */
export function formatDays(days: number | null): string {
  if (days === null) return "–";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** "3 h", "45 min" or "1.5 h" for an average reply time; an en dash when no comment was answered. */
export function formatHours(hours: number | null): string {
  if (hours === null) return "–";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  return `${hours} h`;
}

/** "last 24 hours" / "last hour" for the working rule's window. */
export function windowPhrase(hours: number): string {
  return hours === 1 ? "last hour" : `last ${hours} hours`;
}
