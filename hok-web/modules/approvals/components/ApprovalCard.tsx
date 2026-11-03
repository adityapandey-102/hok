"use client";

import { useState } from "react";
import { approversLabel, deciderLabel, formatInZone, latestApprovalForStage, type Approval, type ApprovalSubject, type ApproverToken } from "../../../lib/domain";
import { approvalsApi } from "../api/approvalsApi";
import { describeApprovalError } from "../approvalErrors";
import { ApprovalLink } from "./ApprovalLink";
import { DecisionControls } from "./DecisionControls";
import { RequestApprovalModal } from "./RequestApprovalModal";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Panel } from "../../../components/ui/Panel";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";

/**
 * The approval card for the CURRENT stage of an event or a task (round 3). Shows nothing when the
 * stage has no approvers. `canRequest` is "this person may move the item"; the API enforces the rest
 * and tells us per row whether the caller can decide (`canDecide`) or cancel (`canCancel`).
 */
export function ApprovalCard({
  subject,
  subjectId,
  stage,
  approvals,
  canRequest,
  zone,
  onChanged,
}: {
  subject: ApprovalSubject;
  subjectId: string;
  stage: { id: string; name: string; approvers: ApproverToken[] };
  approvals: Approval[];
  canRequest: boolean;
  zone: string;
  /** Refetch the item (approvals and `nextBlockedBy` change). */
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [requesting, setRequesting] = useState(false);
  const [busy, setBusy] = useState(false);
  if (stage.approvers.length === 0) return null;

  const latest = latestApprovalForStage(approvals, stage.id);
  const who = approversLabel(stage.approvers);

  async function cancel(a: Approval) {
    const ok = await confirm({ title: "Cancel this request?", body: "The approvers will no longer be asked. You can request approval again.", confirmLabel: "Cancel request", danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await approvalsApi.cancel(a.id, a.version);
      showToast("Request cancelled.", "success");
    } catch (err) {
      showToast(describeApprovalError(err, "Failed to cancel the request"), "error");
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  const requestButton = canRequest && (
    <Button onClick={() => setRequesting(true)} className="self-start max-sm:w-full">
      <Icon name="shield" size={15} /> {latest?.status === "changes_requested" ? "Request approval again" : "Request approval"}
    </Button>
  );

  return (
    <Panel icon="shield" title="Approval" subtitle={`${stage.name} needs a yes before it can move on`}>
      <div data-testid="approval-card" className="flex flex-col gap-3 p-5">
        {!latest && (
          <>
            <p className="text-sm text-text-primary">
              <span className="font-medium">Needs approval from:</span> {who}
            </p>
            {requestButton}
            {!canRequest && <p className="text-sm text-text-muted">The person working on it can ask for approval.</p>}
          </>
        )}

        {latest?.status === "pending" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label="Waiting for approval" tone="amber" />
              <span className="text-sm text-text-muted">
                since {formatInZone(latest.requestedAt, zone)}
                {latest.requestedByName ? ` · asked by ${latest.requestedByName}` : ""}
              </span>
            </div>
            <p className="text-sm text-text-secondary">From: {who}</p>
            {latest.requestNote && <p className="rounded-app bg-accent-bg p-3 text-sm break-words whitespace-pre-wrap text-text-primary">{latest.requestNote}</p>}
            <ApprovalLink url={latest.requestLink} />
            {latest.canDecide && <DecisionControls approval={latest} onDone={onChanged} idPrefix="card" />}
            {latest.canCancel && (
              <Button variant="ghost" className="self-start" disabled={busy} onClick={() => void cancel(latest)}>
                Cancel request
              </Button>
            )}
            {!latest.canDecide && !latest.canCancel && <p className="text-sm text-text-muted">You are waiting on the people above.</p>}
          </>
        )}

        {latest?.status === "approved" && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label="Approved" tone="green" />
            <span className="text-sm text-text-secondary">
              by {deciderLabel(latest)}
              {latest.decidedAt ? ` · ${formatInZone(latest.decidedAt, zone)}` : ""}
            </span>
            {latest.decisionComment && <p className="w-full rounded-app bg-accent-bg p-3 text-sm break-words whitespace-pre-wrap text-text-primary">{latest.decisionComment}</p>}
          </div>
        )}

        {latest?.status === "changes_requested" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label="Changes requested" tone="red" />
              <span className="text-sm text-text-secondary">
                by {deciderLabel(latest)}
                {latest.decidedAt ? ` · ${formatInZone(latest.decidedAt, zone)}` : ""}
              </span>
            </div>
            {latest.decisionComment && <p className="rounded-app bg-accent-bg p-3 text-sm break-words whitespace-pre-wrap text-text-primary">{latest.decisionComment}</p>}
            <p className="text-sm text-text-muted">Move the work back to fix it, then request approval again.</p>
            {requestButton}
          </>
        )}
      </div>
      {requesting && (
        <RequestApprovalModal
          subject={subject}
          subjectId={subjectId}
          stageName={stage.name}
          approversText={who}
          onClose={() => setRequesting(false)}
          onRequested={() => {
            setRequesting(false);
            onChanged();
          }}
        />
      )}
    </Panel>
  );
}
