"use client";

import { usePathname } from "next/navigation";

const NAV = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Contact", href: "/contact" },
];

/**
 * The menu: Home, About, Services, Contact, as plain text with a thin
 * underline on hover and on the current page. Pricing, Blog, Team, FAQ and Case
 * studies pages still exist but are no longer linked (content round 1).
 */
export function NavLinks() {
  const path = usePathname() || "/";
  return (
    <ul className="custom-nav d-lg-flex d-grid gap-lg-5 gap-2 pt-lg-0 pt-5">
      {NAV.map((item) => {
        const current = item.href === "/" ? path === "/" : path === item.href || path.startsWith(item.href + "/");
        return (
          <li key={item.label} className="menu-item position-relative">
            <a href={item.href} className={`hok-nav${current ? " is-current" : ""}`} aria-current={current ? "page" : undefined}>
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
