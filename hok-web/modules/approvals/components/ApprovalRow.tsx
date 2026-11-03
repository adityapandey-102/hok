"use client";

import Link from "next/link";
import { useState } from "react";
import { APPROVAL_STATUS_LABELS, deciderLabel, formatInZone, type Approval } from "../../../lib/domain";
import { approvalsApi } from "../api/approvalsApi";
import { describeApprovalError } from "../approvalErrors";
import { ApprovalLink } from "./ApprovalLink";
import { DecisionControls } from "./DecisionControls";
import { Button } from "../../../components/ui/Button";
import { StatusPill, type PillTone } from "../../../components/ui/StatusPill";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";

const TONES: Record<Approval["status"], PillTone> = { pending: "amber", approved: "green", changes_requested: "red", cancelled: "gray", superseded: "gray" };

/** The page of the item an approval belongs to. */
export function approvalItemHref(a: Pick<Approval, "subject" | "subjectId">): string {
  return a.subject === "event" ? `/app/events/${a.subjectId}` : `/app/tasks/${a.subjectId}`;
}

/** One approval in a list: the item (a link), client, stage, who asked and when, the note and link, and inline Approve / Request changes. */
export function ApprovalRow({ approval: a, zone, onChanged }: { approval: Approval; zone: string; onChanged: () => void }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function cancel() {
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

  return (
    <li data-testid="approval-row" className="flex flex-col gap-2.5 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Link href={approvalItemHref(a)} className="font-serif text-[16px] break-words text-text-primary hover:underline">
          {a.subjectTitle}
        </Link>
        <StatusPill label={a.subject === "event" ? "Event" : "Task"} tone="gray" />
        {a.status !== "pending" && <StatusPill label={APPROVAL_STATUS_LABELS[a.status]} tone={TONES[a.status]} />}
      </div>
      <p className="text-[13px] text-text-muted">
        {[a.clientName, a.stageName].filter(Boolean).join(" · ")} · asked{a.requestedByName ? ` by ${a.requestedByName}` : ""} {formatInZone(a.requestedAt, zone)}
      </p>
      {a.requestNote && <p className="rounded-app bg-accent-bg p-3 text-sm break-words whitespace-pre-wrap text-text-primary">{a.requestNote}</p>}
      <ApprovalLink url={a.requestLink} />
      {(a.status === "approved" || a.status === "changes_requested") && (
        <p className="text-xs text-text-muted">
          By {deciderLabel(a)}
          {a.decidedAt ? ` · ${formatInZone(a.decidedAt, zone)}` : ""}
          {a.decisionComment ? ` · ${a.decisionComment}` : ""}
        </p>
      )}
      {a.status === "pending" && a.canDecide && <DecisionControls approval={a} onDone={onChanged} idPrefix={`row-${a.id}`} />}
      {a.status === "pending" && a.canCancel && (
        <Button variant="ghost" className="self-start" disabled={busy} onClick={() => void cancel()}>
          Cancel request
        </Button>
      )}
    </li>
  );
}
