"use client";

import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel } from "../../../components/ui/Field";
import { Icon } from "../../../components/ui/Icon";
import { Textarea } from "../../../components/ui/Select";
import { ApprovalLink } from "../../approvals/components/ApprovalLink";
import { PortalApiError, publicPortalApi, type PortalPendingApproval } from "../api/publicPortalApi";
import { formatShortDate } from "../portalFormat";

const MAX = 2000;

/**
 * "Your approval is needed" (round 3): the stage waiting for the client, the staff's note and link,
 * and Approve / Request changes (changes need a comment). Every string comes from the API as plain
 * text and is rendered as text; the link opens in a new tab with `noopener noreferrer`.
 * `onDecided` runs after a successful answer so the page can show a thank-you and refresh.
 */
export function PortalApprovalBox({
  token,
  zone,
  approval,
  onDecided,
  onStale,
}: {
  token: string;
  zone: string;
  approval: PortalPendingApproval;
  onDecided: (decision: "approve" | "changes") => void;
  /** The request is gone (answered elsewhere, withdrawn): the page should fetch the event again. */
  onStale: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "changes") {
    if (decision === "changes" && !comment.trim()) {
      setError("Please tell us what you would like changed.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await publicPortalApi.decideApproval(token, approval.id, { version: approval.version, decision, ...(comment.trim() ? { comment: comment.trim() } : {}) });
      onDecided(decision);
    } catch (err) {
      if (err instanceof PortalApiError && err.status === 404) {
        setError("This request was already answered or withdrawn. Reloading…");
        onStale();
      } else {
        setError(err instanceof Error ? err.message : "We could not save your answer. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="portal-approval-title" data-testid="portal-approval" className="mt-5 rounded-app-lg border-2 border-primary/40 bg-primary-bg p-4 sm:p-5">
      <h3 id="portal-approval-title" className="flex items-center gap-2 font-serif text-[17px] text-text-primary">
        <Icon name="shield" size={18} className="shrink-0 text-primary" />
        Your approval is needed: {approval.stageName}
      </h3>
      <p className="mt-1 text-xs text-text-muted">Asked {formatShortDate(approval.requestedAt, zone)}</p>
      {approval.requestNote && <p className="mt-3 text-sm break-words whitespace-pre-line text-text-primary">{approval.requestNote}</p>}
      {approval.requestLink && (
        <div className="mt-2">
          <ApprovalLink url={approval.requestLink} />
        </div>
      )}

      {asking ? (
        <div className="mt-4 flex flex-col gap-2">
          <div>
            <FieldLabel htmlFor="portal-approval-changes" required>
              What would you like changed?
            </FieldLabel>
            <Textarea id="portal-approval-changes" rows={3} maxLength={MAX} value={comment} onChange={(e) => setComment(e.target.value.slice(0, MAX))} />
          </div>
          <FieldError>{error}</FieldError>
          <div className="flex flex-wrap gap-2 max-sm:[&>button]:w-full">
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
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2 max-sm:[&>button]:w-full">
            <Button disabled={busy} onClick={() => void decide("approve")}>
              <Icon name="check" size={15} strokeWidth={3} /> Approve
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setAsking(true)}>
              Request changes
            </Button>
          </div>
          <FieldError>{error}</FieldError>
        </div>
      )}
    </section>
  );
}
