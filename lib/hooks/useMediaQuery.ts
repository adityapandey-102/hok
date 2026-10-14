"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches, kept live as the viewport
 * changes. `serverValue` is what's assumed before hydration (no window).
 * For layout that CSS alone can't express -- e.g. how many calendar months to
 * page through, not just how many to show.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
