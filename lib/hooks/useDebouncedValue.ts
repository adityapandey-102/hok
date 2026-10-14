"use client";

import { useEffect, useState } from "react";

/**
 * `value`, but only after it has stopped changing for `delayMs`. Typing
 * "anarkali" re-renders a filtered list once when you pause, not eight times
 * mid-word -- which keeps the list from flickering under the cursor even when
 * the filtering itself is instant (as it is for the in-memory category search).
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * The app-wide pause before a search box asks the server: long enough to skip
 * the intermediate keystrokes of a normal typist, short enough to feel live.
 * (In-memory filters, like the category picker, can use less.)
 */
export const SEARCH_DEBOUNCE_MS = 300;
