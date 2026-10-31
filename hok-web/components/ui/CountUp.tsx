"use client";

import { useEffect, useState } from "react";

/**
 * A number that counts up from 0 when it first appears (and to its new value
 * when it changes). Purely presentational: the text it SETTLES on is always
 * exactly `children`/`final` -- the real value, formatted by the caller -- so
 * no figure is ever shown rounded or wrong once the motion ends. Skipped
 * entirely for people who ask for reduced motion.
 */
export function CountUp({
  to,
  format = (n) => Math.round(n).toLocaleString("en-IN"),
  final,
  durationMs = 900,
}: {
  /** The numeric value to count towards. */
  to: number;
  /** Formats the in-between numbers (default: whole numbers, Indian grouping). */
  format?: (n: number) => string;
  /** The exact text to show once finished (e.g. formatCurrency of the API string). */
  final?: string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(to) || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setShown(t < 1 ? to * eased : null);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs]);

  const done = final ?? format(to);
  return <span aria-label={done}>{shown === null ? done : format(shown)}</span>;
}
