"use client";

import { useEffect, useState } from "react";
import { approvalsApi } from "../api/approvalsApi";

const POLL_MS = 60_000;

/**
 * How many pending approvals the caller can decide, for the nav item. Polled every 60 s and paused while the
 * tab is hidden (same rhythm as the bell). Renders nothing at 0 or on error.
 */
export function ApprovalsBadge({ className = "" }: { className?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = () =>
      approvalsApi
        .count()
        .then((c) => {
          if (!cancelled) setCount(c.toDecide);
        })
        .catch(() => {
          // A badge is decoration; stay silent.
        });
    const start = () => {
      if (timer) return;
      void load();
      timer = setInterval(load, POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} approvals waiting for you`}
      className={`inline-flex min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-[11px] font-semibold leading-5 text-on-ink ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
