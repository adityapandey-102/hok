import { addDays, dayKeyInZone, hasCapability, zonedMidnight, type Role } from "../../../domain";
import { DASHBOARD_LIST_LIMIT, DASHBOARD_WEEK_DAYS, type DashboardEvent, type DashboardView, type DashboardWindow } from "./dashboard.entity";

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

/**
 * Which sections a dashboard has (FR-DSH-01..03). The Admin's overview is the
 * firm alone; their own clients and tasks live on "My clients" (`mine`).
 * Every other role gets the same own-work dashboard for either view.
 */
export function dashboardSections(role: Role, view: DashboardView = "overview"): { tasks: boolean; clients: boolean; firm: boolean } {
  const global = hasCapability(role, "dashboard:global");
  if (global && view === "overview") return { tasks: false, clients: false, firm: true };
  return { tasks: true, clients: hasCapability(role, "clients:read"), firm: false };
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
