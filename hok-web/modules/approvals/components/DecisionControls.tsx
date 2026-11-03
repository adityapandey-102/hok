"use client";

import { useState } from "react";
import type { Approval } from "../../../lib/domain";
import { approvalsApi } from "../api/approvalsApi";
import { describeApprovalError, isApprovalStale } from "../approvalErrors";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { FieldError, FieldLabel } from "../../../components/ui/Field";
import { Textarea } from "../../../components/ui/Select";
import { useToast } from "../../../components/ui/Toast";

/**
 * Approve / Request changes for one pending approval. "Request changes" opens a
 * comment box (the comment is required). Calls `onDone` after any outcome that
 * changed the request, so the screen can refetch.
 */
export function DecisionControls({ approval, onDone, idPrefix }: { approval: Approval; onDone: () => void; idPrefix: string }) {
  const { showToast } = useToast();
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "changes") {
    if (decision === "changes" && !comment.trim()) {
      setError("Add a comment so they know what to change.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await approvalsApi.decide(approval.id, { version: approval.version, decision, ...(comment.trim() ? { comment: comment.trim() } : {}) });
      showToast(decision === "approve" ? "Approved." : "Changes requested.", "success");
      onDone();
    } catch (err) {
      const message = describeApprovalError(err, "Failed to save your answer");
      if (isApprovalStale(err)) {
        showToast(message, "error");
        onDone();
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (asking) {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <FieldLabel htmlFor={`${idPrefix}-changes`} required>
            What should change?
          </FieldLabel>
          <Textarea id={`${idPrefix}-changes`} rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <FieldError>{error}</FieldError>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void decide("changes")}>
            Send changes
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setAsking(false);
              setError(null);
            }}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 max-sm:[&>button]:flex-1">
        <Button disabled={busy} onClick={() => void decide("approve")}>
          <Icon name="check" size={15} strokeWidth={3} /> Approve
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => setAsking(true)}>
          Request changes
        </Button>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}
