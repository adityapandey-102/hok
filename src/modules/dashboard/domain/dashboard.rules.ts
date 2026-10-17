import { addDays, dayKeyInZone, hasCapability, zonedMidnight, type Role } from "../../../domain";
import { DASHBOARD_LIST_LIMIT, DASHBOARD_WEEK_DAYS, type DashboardEvent, type DashboardWindow } from "./dashboard.entity";

/** The viewer's "today" and "this week" (today + 6 days) as UTC instants. */
export function dashboardWindow(now: Date, timeZone: string): DashboardWindow {
  const today = dayKeyInZone(now, timeZone);
  return {
    timeZone,
    today,
    todayStart: zonedMidnight(today, timeZone).toISOString(),
    tomorrowStart: zonedMidnight(addDays(today, 1), timeZone).toISOString(),
    weekEnd: zonedMidnight(addDays(today, DASHBOARD_WEEK_DAYS), timeZone).toISOString(),
  };
}

/** Which sections a role's dashboard has (FR-DSH-01..03). */
export function dashboardSections(role: Role): { clients: boolean; firm: boolean } {
  return { clients: hasCapability(role, "clients:read"), firm: hasCapability(role, "dashboard:global") };
}

/**
 * Splits the week's events (earliest first) into those overlapping today and
 * those starting later in the week, each capped for display.
 */
export function splitWeek(events: DashboardEvent[], window: DashboardWindow, limit = DASHBOARD_LIST_LIMIT): { today: DashboardEvent[]; upcoming: DashboardEvent[] } {
  const tomorrow = Date.parse(window.tomorrowStart);
  const today = events.filter((e) => Date.parse(e.startsAt) < tomorrow);
  const upcoming = events.filter((e) => Date.parse(e.startsAt) >= tomorrow);
  return { today: today.slice(0, limit), upcoming: upcoming.slice(0, limit) };
}
