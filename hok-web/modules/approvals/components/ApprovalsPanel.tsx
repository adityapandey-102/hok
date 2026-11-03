import Link from "next/link";
import { timeAgoLabel, type Approval } from "../../../lib/domain";
import { Icon } from "../../../components/ui/Icon";
import { Panel } from "../../../components/ui/Panel";

/**
 * Dashboard: "Waiting for your approval" -- the count and the three oldest requests, all linking to
 * /app/approvals. The caller hides it when the count is 0.
 */
export function ApprovalsPanel({ toDecide, oldest }: { toDecide: number; oldest: Approval[] }) {
  return (
    <Panel
      icon="shield"
      title="Waiting for your approval"
      subtitle={`${toDecide.toLocaleString("en-IN")} ${toDecide === 1 ? "request" : "requests"}, oldest first`}
      footer={{ href: "/app/approvals", label: toDecide > oldest.length ? `See all ${toDecide}` : "Approvals" }}
    >
      <ul className="divide-y divide-border-light" data-testid="dashboard-approvals">
        {oldest.map((a) => (
          <li key={a.id}>
            <Link href="/app/approvals" className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent-bg">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-text-primary">{a.subjectTitle}</span>
                <span className="block truncate text-xs text-text-muted">
                  {[a.clientName, a.stageName, a.requestedByName ? `asked by ${a.requestedByName}` : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-xs text-text-muted">{timeAgoLabel(a.requestedAt)}</span>
              <Icon name="chevron-right" size={14} className="shrink-0 text-text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
