import { APPROVAL_STATUS_LABELS, deciderLabel, formatInZone, type Approval } from "../../../lib/domain";
import { ApprovalLink } from "./ApprovalLink";
import { Panel } from "../../../components/ui/Panel";
import { StatusPill, type PillTone } from "../../../components/ui/StatusPill";

const TONES: Record<Approval["status"], PillTone> = { pending: "amber", approved: "green", changes_requested: "red", cancelled: "gray", superseded: "gray" };

/** Every approval round of an item, newest first: who asked, who answered, when, and the comment. Renders nothing when there are none. */
export function ApprovalHistory({ approvals, zone }: { approvals: Approval[]; zone: string }) {
  if (approvals.length === 0) return null;
  return (
    <Panel icon="shield" title="Approval history" subtitle="Every round, newest first">
      <ol className="flex flex-col gap-4 p-5" aria-label="Approval history">
        {approvals.map((a) => (
          <li key={a.id} className="flex flex-col gap-1 border-l-2 border-border pl-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-text-primary">{a.stageName}</span>
              <StatusPill label={APPROVAL_STATUS_LABELS[a.status]} tone={TONES[a.status]} />
            </div>
            <p className="text-xs text-text-muted">
              Asked{a.requestedByName ? ` by ${a.requestedByName}` : ""} · {formatInZone(a.requestedAt, zone)}
            </p>
            {a.requestNote && <p className="text-sm break-words whitespace-pre-wrap text-text-secondary">{a.requestNote}</p>}
            <ApprovalLink url={a.requestLink} />
            {(a.status === "approved" || a.status === "changes_requested") && (
              <p className="text-xs text-text-muted">
                {a.status === "approved" ? "Approved" : "Changes requested"} by {deciderLabel(a)}
                {a.decidedAt ? ` · ${formatInZone(a.decidedAt, zone)}` : ""}
              </p>
            )}
            {a.decisionComment && <p className="rounded-app bg-accent-bg p-2.5 text-sm break-words whitespace-pre-wrap text-text-primary">{a.decisionComment}</p>}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
