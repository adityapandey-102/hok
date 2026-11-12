"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ContactForm } from "./ContactForm";

const DESKTOP = "(min-width: 992px)";
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

const stored = (key: string) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * The scroll-triggered contact modal: the same form as /contact, in a centred
 * panel on desktop and a bottom sheet on phones. It opens by itself, with no
 * waiting, as soon as the page is scrolled 3 screens down (2 on a phone or
 * tablet): once per page load (closing it does not bring it back; reloading
 * does), never on /contact, never after an enquiry was sent (sessionStorage
 * `hokEnquirySent`), never while another modal or the mobile menu is open. The
 * check runs on every scroll (passive, once per frame) and once on load, in case
 * the browser restores a scrolled-down page. `?modal=reset` clears the enquiry
 * flag (for testing). Anything can also open it with `window.dispatchEvent(new
 * CustomEvent("hok:contact", { detail: { message } }))`: the closing band and the
 * "Get In Touch", "Start a Project" and "Discuss This Service" buttons do, and
 * `message` pre-fills the message box. No form chips: the form is the same as /contact.
 * Dialog rules: focus moves in and is trapped, Esc and a backdrop click close it,
 * focus returns to the opener, the page behind does not scroll.
 */
export function ContactModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [shown, setShown] = useState(false); // the "in" state, one frame after mounting, for the CSS transition
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  const shownRef = useRef(false); // in memory, so a page load starts afresh

  const show = useCallback((prefill = "") => {
    if (openRef.current) return;
    setMessage(prefill);
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openRef.current = true;
    shownRef.current = true; // once per page load: closing it does not bring it back until the page is loaded again
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setShown(false);
    window.setTimeout(() => {
      openRef.current = false;
      setOpen(false);
      opener.current?.focus?.({ preventScroll: true });
    }, 300);
  }, []);

  // the openers: the scroll trigger and the "hok:contact" event
  useEffect(() => {
    const onEvent = (event: Event) => {
      if (document.querySelector(".mfp-ready")) return;
      const detail = (event as CustomEvent<{ message?: string } | undefined>).detail;
      show(typeof detail?.message === "string" ? detail.message : "");
    };
    window.addEventListener("hok:contact", onEvent);

    // ?modal=reset forgets that an enquiry was sent (for testing)
    if (new URLSearchParams(window.location.search).get("modal") === "reset") {
      try {
        sessionStorage.removeItem("hokEnquirySent");
      } catch {
        /* private mode */
      }
    }

    const eligible = () => window.location.pathname !== "/contact" && !shownRef.current && !stored("hokEnquirySent");
    const check = () => {
      if (openRef.current || !eligible()) return;
      const screens = window.matchMedia(DESKTOP).matches ? 3 : 2;
      if (window.scrollY < screens * window.innerHeight) return;
      if (document.querySelector(".mfp-ready, html.hk-menu-open")) return; // another modal, or the mobile menu, is open
      show();
    };
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        check();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    check(); // the page may restore scrolled down
    window.addEventListener("load", check); // ...or only settle once everything has loaded
    return () => {
      window.removeEventListener("hok:contact", onEvent);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("load", check);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [show]);

  // while open: fade in, lock the page, hide the custom cursor, trap focus, Esc closes
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const gap = window.innerWidth - root.clientWidth;
    const bodyPad = document.body.style.paddingRight;
    root.classList.add("hk-modal-open");
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    const frame = requestAnimationFrame(() => {
      setShown(true);
      // a phone keeps its keyboard down until the visitor taps a field
      const touch = window.matchMedia("(pointer: coarse)").matches;
      (touch ? panel.current : (panel.current?.querySelector<HTMLElement>("input, textarea") ?? panel.current))?.focus({ preventScroll: true });
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      root.classList.remove("hk-modal-open");
      document.body.style.paddingRight = bodyPad;
    };
  }, [open, close]);

  if (!open) return null;
  return (
    <div
      className={`hok-modal${shown ? " is-open" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div ref={panel} className="hok-modal__panel" role="dialog" aria-modal="true" aria-labelledby="hok-modal-title" tabIndex={-1}>
        <div className="hok-modal__bar">
          <p className="hok-modal__lead">Got a minute? Tell us what you’re planning.</p>
          <button type="button" className="hok-modal__close" aria-label="Close" onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <ContactForm variant="modal" headingId="hok-modal-title" initialMessage={message} />
      </div>
    </div>
  );
}
