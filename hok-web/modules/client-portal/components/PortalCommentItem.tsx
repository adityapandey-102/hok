import { Icon } from "../../../components/ui/Icon";
import { StatusPill } from "../../../components/ui/StatusPill";
import type { PortalComment } from "../api/publicPortalApi";
import { COMMENT_STATUS_LABEL, COMMENT_STATUS_TONE, formatShortDate } from "../portalFormat";

/** One of the client's comments with its status and the manager's reply (Messages tab and the event sheet). */
export function PortalCommentItem({ comment: c, zone, showEvent = true }: { comment: PortalComment; zone: string; showEvent?: boolean }) {
  return (
    <li className="border-l-2 border-border pl-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span>{formatShortDate(c.createdAt, zone)}</span>
        {showEvent && c.eventTitle && <span>· {c.eventTitle}</span>}
        <StatusPill label={COMMENT_STATUS_LABEL[c.status]} tone={COMMENT_STATUS_TONE[c.status]} />
      </div>
      <p className="mt-1.5 text-sm break-words whitespace-pre-line text-text-primary">{c.body}</p>
      {c.reply && (
        <div className="mt-2.5 rounded-app-lg rounded-tl-sm border border-border-light bg-accent-bg px-3.5 py-2.5">
          <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-secondary">
            <Icon name="message" size={12} /> Reply{c.repliedAt ? ` · ${formatShortDate(c.repliedAt, zone)}` : ""}
          </p>
          <p className="mt-0.5 text-sm break-words whitespace-pre-line text-text-primary">{c.reply}</p>
        </div>
      )}
    </li>
  );
}
