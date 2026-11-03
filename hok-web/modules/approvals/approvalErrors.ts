/** Plain-language text for the approvals API's stable error codes (falls back to the server's message). */
const MESSAGES: Record<string, string> = {
  STAGE_APPROVAL_NOT_NEEDED: "This stage doesn't need approval.",
  STAGE_APPROVAL_ALREADY_APPROVED: "This stage is already approved.",
  STAGE_APPROVAL_PENDING: "A request for this stage is already waiting for an answer.",
  STAGE_APPROVAL_NOT_PENDING: "That request was already answered or withdrawn.",
  STAGE_APPROVAL_MODIFIED: "Someone else just changed this request. Reloaded.",
  STAGE_APPROVAL_NOT_APPROVER: "You are not one of the people who can approve this stage.",
  STAGE_APPROVAL_SELF: "You can't approve your own request.",
  STAGE_APPROVAL_COMMENT_REQUIRED: "Add a comment to ask for changes.",
  STAGE_APPROVAL_NOT_FOUND: "That approval could not be found.",
  EVENT_NOT_ACTIVE: "A cancelled or postponed event can't be sent for approval.",
  STAFF_TASK_DONE: "This task is done.",
};

/** Codes after which the screen should refetch (the request changed under the user). */
export const APPROVAL_STALE_CODES: readonly string[] = ["STAGE_APPROVAL_NOT_PENDING", "STAGE_APPROVAL_MODIFIED", "STAGE_APPROVAL_PENDING", "STAGE_APPROVAL_ALREADY_APPROVED"];

export function describeApprovalError(err: unknown, fallback: string): string {
  const code = (err as { code?: string } | null)?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  return err instanceof Error && err.message ? err.message : fallback;
}

export function isApprovalStale(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return !!code && APPROVAL_STALE_CODES.includes(code);
}

/** Only http(s) links are ever made clickable; anything else shows as text. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
