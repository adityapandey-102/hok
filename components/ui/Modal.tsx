"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The app's accessible modal dialog -- a centred panel on desktop, a bottom
 * sheet on phones. Rendered into <body> through a portal so it can't be clipped
 * or stacked under a card's overflow/z-index.
 *
 * Owns the behaviour every dialog needs and ConfirmDialog only half-has:
 *   - Escape closes from ANYWHERE (a document listener, not a keydown on the
 *     overlay, which only fires while focus happens to be inside it);
 *   - Tab / Shift+Tab are trapped inside the panel;
 *   - page scroll is locked while open;
 *   - focus moves in on open (`initialFocusRef`, else the first focusable) and
 *     returns to whatever opened it on close;
 *   - a press that starts AND ends on the backdrop closes it (mousedown on the
 *     backdrop itself -- so selecting text inside and releasing outside doesn't).
 *
 * Label it: pass the id of the visible title as `labelledBy`.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  initialFocusRef,
  panelClassName = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  panelClassName?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Latest onClose without re-running the open/close effect when a parent
  // passes a fresh arrow function each render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    (initialFocusRef?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open, initialFocusRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-900 flex items-end justify-center bg-black/40 sm:items-center sm:p-6 print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`sheet-in flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-app-xl bg-card pb-[env(safe-area-inset-bottom)] shadow-app-lg outline-none sm:max-h-[88vh] sm:rounded-app-xl dark:ring-1 dark:ring-white/8 ${panelClassName}`}
      >
        {/* The grabber: on phones the dialog is a sheet from the bottom, as on iOS. */}
        <div aria-hidden className="mx-auto mt-2 mb-1 h-1.5 w-9 shrink-0 rounded-full bg-accent-light sm:hidden" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
