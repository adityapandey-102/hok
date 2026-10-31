import { hasCapability, type Capability, type Role } from "../../lib/domain";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  /** The phone tab bar's short name, when the item is one of its tabs. */
  tab?: string;
  requires?: Capability;
  /** A live count next to the label (see Sidebar). */
  badge?: "comments";
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * The staff app's menu. Only real pages live here -- no greyed-out "soon"
 * placeholders (needleye's rule), so each milestone adds its own items as its
 * pages land: Clients (M3), Calendar (M5), Assets (M6), Tasks (M7), Comments
 * (M8), Users (M2).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/app", icon: "home", tab: "Home" },
      { label: "My clients", href: "/app/my-clients", icon: "user", requires: "dashboard:global" },
      { label: "Clients", href: "/app/clients", icon: "briefcase", requires: "clients:read", tab: "Clients" },
      { label: "Assets", href: "/app/assets", icon: "tag", requires: "assets:read" },
      { label: "Calendar", href: "/app/calendar", icon: "calendar", requires: "events:read", tab: "Calendar" },
      { label: "Tasks", href: "/app/tasks", icon: "clipboard", requires: "staff_tasks:read", tab: "Tasks" },
      { label: "Client comments", href: "/app/comments", icon: "message", requires: "comments:read", badge: "comments" },
      { label: "Notifications", href: "/app/notifications", icon: "bell", tab: "Alerts" },
      { label: "My profile", href: "/app/profile", icon: "user", tab: "Profile" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Team workload", href: "/app/team", icon: "bar-chart", requires: "dashboard:global" },
      { label: "Reports", href: "/app/reports", icon: "trending-up", requires: "dashboard:global" },
      { label: "Users", href: "/app/admin/users", icon: "users", requires: "users:manage" },
      { label: "Stage templates", href: "/app/templates", icon: "layers", requires: "stage_templates:manage" },
    ],
  },
];

export function visibleNavSections(role: Role): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.requires || hasCapability(role, item.requires)),
  })).filter((section) => section.items.length > 0);
}

/**
 * The menu item for this page: the MOST specific match, so /app/clients/new is
 * "Clients", not also "Dashboard" (/app is a prefix of everything; it only
 * matches itself). Pages without their own item belong to a section: an event
 * lives under Clients. Shared by the sidebar and the phone tab bar.
 */
export function activeNavHref(sections: NavSection[], pathname: string): string | undefined {
  const path = pathname.startsWith("/app/events") ? "/app/clients" : pathname;
  return sections
    .flatMap((sec) => sec.items.map((i) => i.href))
    .filter((href) => path === href || (href !== "/app" && path.startsWith(href + "/")))
    .sort((x, y) => y.length - x.length)[0];
}

/** The phone tab bar: the first four tabs the role can open (a fifth, "More", opens the full menu). */
export function tabBarItems(sections: NavSection[]): NavItem[] {
  return sections
    .flatMap((sec) => sec.items)
    .filter((i) => i.tab)
    .slice(0, 4);
}
