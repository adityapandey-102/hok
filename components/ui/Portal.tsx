"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};

/**
 * Renders children into document.body. For modals opened from inside a card:
 * the cards sit in animated (transformed) columns, and a transformed ancestor
 * traps a `position: fixed` overlay inside its own box and stacking order -- a
 * later sibling card then paints over the dialog's buttons. Renders nothing on
 * the server and before hydration (no document yet).
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return mounted ? createPortal(children, document.body) : null;
}
