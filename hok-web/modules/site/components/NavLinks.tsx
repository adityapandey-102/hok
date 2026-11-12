"use client";

import { usePathname } from "next/navigation";

export const NAV = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Contact", href: "/contact" },
];

/**
 * The menu: About, Services, Contact, as plain text links with a growing
 * underline on hover and a small red dot under the current page. There is no
 * "Home" link: the logo goes home (design round 7). Pricing, Blog, Team, FAQ and
 * Case studies pages still exist but are no longer linked (content round 1).
 */
export function NavLinks() {
  const path = usePathname() || "/";
  return (
    <ul className="custom-nav d-lg-flex d-grid gap-lg-5 gap-2 pt-lg-0 pt-5">
      {NAV.map((item) => {
        const current = path === item.href || path.startsWith(item.href + "/");
        return (
          <li key={item.label} className="menu-item position-relative">
            <a href={item.href} className={`hok-nav hok-link${current ? " is-current" : ""}`} aria-current={current ? "page" : undefined}>
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
