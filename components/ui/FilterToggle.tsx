"use client";

import { useState } from "react";
import { Icon } from "./Icon";

/**
 * Filters that fold away on phones (redesign 2026-10-23). From `sm` up the
 * fields sit in the page's filter row as usual; on a phone only a "Filters"
 * button shows (with how many are set), and tapping it opens them -- so the
 * list starts near the top of the screen instead of under a stack of boxes.
 *
 * Put it inside the filter grid; on `sm`+ its wrapper disappears
 * (`display: contents`), so its children are grid items like the rest.
 */
export function FilterToggle({ active, children }: { active: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-10 items-center justify-between rounded-app bg-accent-bg/70 px-3.5 text-[15px] font-medium text-text-primary active:opacity-70 sm:hidden"
      >
        <span className="flex items-center gap-2">
          <Icon name="list" size={17} className="text-text-muted" />
          Filters
          {active > 0 && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-on-ink">{active}</span>}
        </span>
        <Icon name="chevron-down" size={16} className={`text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`${open ? "grid" : "hidden"} grid-cols-1 gap-3 sm:contents`}>{children}</div>
    </>
  );
}
