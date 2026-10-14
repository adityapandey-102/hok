import { hasCapability, type Capability, type Role } from "../../lib/domain";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  requires?: Capability;
}

interface NavSection {
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
      { label: "Dashboard", href: "/app", icon: "home" },
      { label: "Clients", href: "/app/clients", icon: "briefcase", requires: "clients:read" },
      { label: "My profile", href: "/app/profile", icon: "user" },
    ],
  },
  {
    label: "Administration",
    items: [{ label: "Users", href: "/app/admin/users", icon: "users", requires: "users:manage" }],
  },
];

export function visibleNavSections(role: Role): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.requires || hasCapability(role, item.requires)),
  })).filter((section) => section.items.length > 0);
}
