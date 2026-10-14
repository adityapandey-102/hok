/** Date helpers, copied from needleye-web. Time-zone-aware formatting arrives with events (M4). */

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function diffDays(laterDate: Date, earlierDate: Date): number {
  return Math.round((startOfDay(laterDate).getTime() - startOfDay(earlierDate).getTime()) / 86_400_000);
}

export function toDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function pluralize(unit: string, value: number): string {
  return Math.abs(value) === 1 ? unit : `${unit}s`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "N/A";
  const date = parseDateOnly(value) ?? new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/**
 * "just now" / "5 min ago" / "3 h ago" / "yesterday" / "12 days ago" -- how
 * long since an ISO timestamp, for "last seen" style columns. Calendar days
 * (not 24h blocks) from "yesterday" on, so 23:50 seen at 00:10 is "yesterday".
 */
export function timeAgoLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "Never";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Never";
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  const days = diffDays(now, then);
  if (days <= 0) {
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.floor(minutes / 60)} h ago`;
  }
  if (days === 1) return "yesterday";
  return `${days} ${pluralize("day", days)} ago`;
}
