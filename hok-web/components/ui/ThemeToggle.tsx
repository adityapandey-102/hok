"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, readTheme, type Theme } from "../../lib/theme";
import { Icon } from "./Icon";

/** Re-render whenever <html data-theme> changes (another toggle, another tab's script). */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

type StartViewTransition = (update: () => void) => unknown;

/**
 * Light / dark switch. Where the browser supports View Transitions, the new
 * theme spreads out from the button in a circle; elsewhere the colours glide
 * (html.theme-switching). Reduced motion: an instant switch.
 */
export function ThemeToggle({ className = "", tone = "default" }: { className?: string; tone?: "default" | "on-dark" }) {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "light");
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
    if (reduce) return applyTheme(next);
    if (start) {
      const r = e.currentTarget.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      root.style.setProperty("--reveal-x", `${x}px`);
      root.style.setProperty("--reveal-y", `${y}px`);
      root.style.setProperty("--reveal-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
      start.call(document, () => applyTheme(next));
      return;
    }
    root.classList.add("theme-switching");
    applyTheme(next);
    window.setTimeout(() => root.classList.remove("theme-switching"), 350);
  }

  const colours =
    tone === "on-dark"
      ? "text-white/70 hover:bg-white/10 hover:text-white"
      : "text-text-secondary hover:bg-accent-bg hover:text-text-primary";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === "dark" ? "Switch to dark mode" : "Switch to light mode"}
      title={next === "dark" ? "Dark mode" : "Light mode"}
      className={`relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-app outline-none focus-visible:ring-2 focus-visible:ring-ring ${colours} ${className}`}
    >
      {/* Both icons are rendered; the current one is shown, the other turns away. */}
      <span className={`absolute transition-all duration-500 ${theme === "dark" ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`}>
        <Icon name="moon" size={18} />
      </span>
      <span className={`absolute transition-all duration-500 ${theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`}>
        <Icon name="sun" size={18} />
      </span>
    </button>
  );
}
