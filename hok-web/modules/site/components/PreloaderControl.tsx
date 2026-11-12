"use client";

import { useEffect } from "react";

const MIN_MS = 800; // long enough to see the logo and the line fill
const MAX_MS = 1200; // never hold the page longer than this
const FADE_MS = 300;

/**
 * Lifts the preloader overlay (see Preloader.tsx): once the page has loaded,
 * but no earlier than MIN_MS and no later than MAX_MS after navigation start.
 * Works on the DOM directly (no state), so React never re-renders the overlay.
 */
export function PreloaderControl() {
  useEffect(() => {
    const el = document.getElementById("preloader");
    if (!el || el.style.display === "none") return;

    const timers: number[] = [];
    const hide = () => {
      el.classList.add("is-out");
      timers.push(window.setTimeout(() => (el.style.display = "none"), FADE_MS));
    };
    const untilNext = (target: number) => Math.max(target - performance.now(), 0);
    const onLoad = () => {
      const at = Math.min(Math.max(MIN_MS, performance.now()), MAX_MS);
      timers.push(window.setTimeout(hide, untilNext(at)));
    };

    timers.push(window.setTimeout(hide, untilNext(MAX_MS))); // safety if "load" never fires
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}
