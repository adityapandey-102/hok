"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "../registerServiceWorker";

/** Registers the service worker once the staff app has loaded. Renders nothing. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
