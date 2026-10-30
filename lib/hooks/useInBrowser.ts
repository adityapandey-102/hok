"use client";

import { useSyncExternalStore } from "react";

const subscribeNothing = () => () => {};

/**
 * False while the server renders and while the page hydrates, then true.
 * For text that comes from the runtime's own Intl data (zone names, country
 * names), which Node and the browser can word differently: render the
 * locale-free part until this is true, so the two never mismatch.
 */
export function useInBrowser(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}
