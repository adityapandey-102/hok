"use client";

import { useEffect, useState } from "react";
import { clientCommentsApi } from "../api/clientCommentsApi";

/** Open-comments count (received + in progress) for the nav item. Renders nothing at 0 or on error. */
export function CommentsBadge({ className = "" }: { className?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      clientCommentsApi
        .counts()
        .then((c) => {
          if (!cancelled) setCount(c.received + c.inProgress);
        })
        .catch(() => {
          // A badge is decoration; stay silent.
        });
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} open comments`}
      className={`inline-flex min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-[11px] font-semibold leading-5 text-white ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
