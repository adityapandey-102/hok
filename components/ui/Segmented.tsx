"use client";

import { useLayoutEffect, useRef } from "react";
import { Icon, type IconName } from "./Icon";

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
}

/**
 * A segmented control (redesign 2026-10-23), the way Apple switches between
 * views of the same thing: a soft track, and a white thumb that slides to the
 * choice -- the one piece of motion, because it shows what changed. Rendered
 * as tabs (role="tab", arrow keys move between them) so screen readers and
 * the existing tests find them by name. Scrolls sideways on narrow screens
 * instead of squeezing labels.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  idPrefix,
  className = "",
  stretch = false,
  manual = false,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** What the control switches, for screen readers ("Client sections"). */
  label: string;
  /** Gives each tab an id (`${idPrefix}-tab-${id}`) so a panel can point back with aria-labelledby. */
  idPrefix?: string;
  className?: string;
  /** Fill the width, segments sharing it equally. */
  stretch?: boolean;
  /** Arrow keys only move focus; Enter / Space chooses (for choices that load something). */
  manual?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);

  // Move the thumb under the chosen segment. A direct style write (no state),
  // so the slide is one CSS transition and nothing re-renders.
  useLayoutEffect(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    const active = track?.querySelector<HTMLElement>(`[data-seg="${CSS.escape(value)}"]`);
    if (!track || !thumb || !active) return;
    const place = () => {
      thumb.style.width = `${active.offsetWidth}px`;
      thumb.style.transform = `translateX(${active.offsetLeft}px)`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(track);
    return () => ro.disconnect();
  }, [value, options]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = options.findIndex((o) => o.id === value);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const focused = options.findIndex((o) => o.id === (document.activeElement as HTMLElement | null)?.dataset.seg);
    const from = manual && focused >= 0 ? focused : i;
    const step = e.key === "ArrowRight" ? from + 1 : e.key === "ArrowLeft" ? from - 1 : next;
    const target = options[(step + options.length) % options.length]!;
    if (!manual) onChange(target.id);
    trackRef.current?.querySelector<HTMLElement>(`[data-seg="${CSS.escape(target.id)}"]`)?.focus();
  }

  return (
    <div className={`max-w-full overflow-x-auto [scrollbar-width:none] ${className}`}>
      <div
        ref={trackRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={`relative inline-flex rounded-app bg-accent-bg p-1 ${stretch ? "w-full" : ""}`}
      >
        <span
          ref={thumbRef}
          aria-hidden
          className="absolute top-1 bottom-1 left-0 rounded-[8px] bg-card shadow-[0_1px_3px_rgba(31,27,28,0.12),0_0_0_0.5px_rgba(31,27,28,0.06)] transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:bg-accent-light"
        />
        {options.map((o) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="tab"
              id={idPrefix ? `${idPrefix}-tab-${o.id}` : undefined}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              data-seg={o.id}
              onClick={() => onChange(o.id)}
              className={`relative z-10 flex items-center justify-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-[13.5px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/25 ${
                stretch ? "flex-1" : ""
              } ${on ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
            >
              {o.icon && <Icon name={o.icon} size={16} filled={on} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
