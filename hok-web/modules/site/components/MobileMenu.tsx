"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { SOCIALS } from "../content";
import { Btn } from "./Btn";
import { NAV } from "./NavLinks";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
const step = (i: number) => ({ "--i": i }) as React.CSSProperties;

/**
 * The phone and tablet menu (below 992 px): a round 44 px button in the header (two
 * lines that morph into a red X while the menu is open) that opens a full-screen
 * dark overlay with About, Services and Contact at 28 px, the "Get In Touch" button
 * and the Instagram and LinkedIn links, staggering in. While it is open the page
 * behind does not scroll (`html.hk-menu-open`), the header (logo and the same
 * button) is raised above the overlay, focus is trapped between the button and the
 * overlay, Esc, the button and a tap on any link close it, and focus goes back to
 * the button. The overlay is portalled to <body>: the header's backdrop filter
 * would otherwise become the containing block of a fixed child.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const path = usePathname() || "/";
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    button.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("hk-menu-open");
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>(".hok-menu__link")?.focus({ preventScroll: true }));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panel.current || !button.current) return;
      // the toggle button sits above the overlay, so it is the first stop of the loop
      const items = [button.current, ...Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE))];
      // the button is in the header and the overlay is at the end of <body>, so the browser's own order would
      // leave the loop: step through the list ourselves
      event.preventDefault();
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next = at === -1 ? (event.shiftKey ? items.length - 1 : 0) : (at + (event.shiftKey ? -1 : 1) + items.length) % items.length;
      items[next].focus();
    };
    // the menu is a phone and tablet thing: it closes if the window grows to desktop width
    const wide = window.matchMedia("(min-width: 992px)");
    const onWide = () => wide.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      root.classList.remove("hk-menu-open");
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="hok-menu-btn d-lg-none"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="hok-menu"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            id="hok-menu"
            ref={panel}
            className="hok-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onClick={(event) => {
              if ((event.target as Element).closest("a")) setOpen(false); // a tap on a link closes the menu (the page then changes or the modal opens)
            }}
          >
            <nav className="hok-menu__body" aria-label="Main">
              <ul className="hok-menu__list">
                {NAV.map((item, i) => {
                  const current = path === item.href || path.startsWith(item.href + "/");
                  return (
                    <li key={item.label} style={step(i)}>
                      <a href={item.href} className={`hok-menu__link${current ? " is-current" : ""}`} aria-current={current ? "page" : undefined}>
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
              <div className="hok-menu__cta-wrap" style={step(NAV.length)}>
                <Btn href="/contact" contact className="hok-menu__cta">
                  Get In Touch
                </Btn>
              </div>
              <ul className="hok-menu__social" style={step(NAV.length + 1)}>
                <li>
                  <a href={SOCIALS.instagram} target="_blank" rel="noopener noreferrer">
                    Instagram
                  </a>
                </li>
                <li>
                  <a href={SOCIALS.linkedin} target="_blank" rel="noopener noreferrer">
                    LinkedIn
                  </a>
                </li>
              </ul>
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
}
