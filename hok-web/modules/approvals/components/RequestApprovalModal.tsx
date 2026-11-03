"use client";

import { useId, useState } from "react";
import { approvalsApi } from "../api/approvalsApi";
import { describeApprovalError, isApprovalStale } from "../approvalErrors";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Textarea } from "../../../components/ui/Select";
import { useToast } from "../../../components/ui/Toast";
import type { ApprovalSubject } from "../../../lib/domain";

/** Ask for approval of the item's current stage: an optional note and an optional link to the work. */
export function RequestApprovalModal({
  subject,
  subjectId,
  stageName,
  approversText,
  onClose,
  onRequested,
}: {
  subject: ApprovalSubject;
  subjectId: string;
  stageName: string;
  approversText: string;
  onClose: () => void;
  onRequested: () => void;
}) {
  const { showToast } = useToast();
  const titleId = useId();
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const url = link.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      setError("The link must start with http:// or https://");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await approvalsApi.request({ subject, subjectId, ...(note.trim() ? { note: note.trim() } : {}), ...(url ? { link: url } : {}) });
      showToast("Approval requested.", "success");
      onRequested();
    } catch (err) {
      const message = describeApprovalError(err, "Failed to request approval");
      if (isApprovalStale(err)) {
        showToast(message, "error");
        onRequested();
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy={titleId} panelClassName="max-w-md p-6">
      <h2 id={titleId} className="font-serif text-lg text-text-primary">
        Request approval
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        {stageName} needs approval from {approversText}.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3.5">
        <div>
          <FieldLabel htmlFor="approval-note">Note (optional)</FieldLabel>
          <Textarea id="approval-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should they look at?" />
        </div>
        <div>
          <FieldLabel htmlFor="approval-link">Link to the work (optional)</FieldLabel>
          <Input id="approval-link" type="url" inputMode="url" maxLength={2000} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
        </div>
        <FieldError>{error}</FieldError>
        <div className="flex justify-end gap-2 max-sm:[&>button]:flex-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Request approval"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
