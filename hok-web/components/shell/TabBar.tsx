"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "../../lib/domain";
import { Icon } from "../ui/Icon";
import { activeNavHref, tabBarItems, visibleNavSections } from "./nav-config";

/**
 * The phone and portrait-tablet tab bar (redesign 2026-10-23): the four places
 * a person goes most, always one thumb away, plus "More" for the full menu --
 * the iOS pattern, instead of hiding everything behind a hamburger. The
 * current tab's icon fills in. Hidden from lg up, where the sidebar shows.
 */
export function TabBar({ role, onMore }: { role: Role; onMore: () => void }) {
  const pathname = usePathname() ?? "";
  const sections = visibleNavSections(role);
  const active = activeNavHref(sections, pathname);
  const tabs = tabBarItems(sections);
  const moreActive = !tabs.some((t) => t.href === active);

  return (
    <nav
      aria-label="Tabs"
      className="material-card fixed inset-x-0 bottom-0 z-40 border-t border-border-light pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {tabs.map((t) => {
          const on = t.href === active;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-medium transition-colors active:opacity-60 ${
                  on ? "text-primary" : "text-text-muted"
                }`}
              >
                <Icon emoji={t.icon} size={25} filled={on} />
                {t.tab}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMore}
            className={`flex w-full flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-medium transition-colors active:opacity-60 ${
              moreActive ? "text-primary" : "text-text-muted"
            }`}
          >
            <Icon name="more" size={25} filled={moreActive} />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
