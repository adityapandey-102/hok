import { lastSeen } from "../../lib/domain";

/** "Last seen 3 hours ago", or "Not seen in the last 45 days" (muted). Hover for the exact time. */
export function LastSeen({ at, className = "" }: { at: string | null; className?: string }) {
  const s = lastSeen(at);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${s.stale ? "text-text-muted" : "text-text-secondary"} ${className}`} title={at ? new Date(at).toLocaleString("en-GB") : undefined}>
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.stale ? "bg-border" : "bg-accent-light"}`} />
      {s.stale ? s.text : `Last seen ${s.text}`}
    </span>
  );
}
