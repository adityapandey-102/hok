import { Icon } from "../../../components/ui/Icon";
import { safeHttpUrl } from "../approvalErrors";

/** The link a requester attached: clickable only for http(s), always opened safely; anything else shows as plain text. */
export function ApprovalLink({ url }: { url: string | null }) {
  if (!url) return null;
  const safe = safeHttpUrl(url);
  if (!safe) return <span className="text-sm break-all text-text-secondary">{url}</span>;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm font-medium break-all text-primary hover:underline">
      Open the work
      <Icon name="external-link" size={13} className="shrink-0" />
    </a>
  );
}
