import { apiFetchServer } from "../../../../lib/api/server";
import { ApprovalsPageClient } from "../../../../modules/approvals/components/ApprovalsPageClient";

/** Approvals (round 3): what waits for the caller's yes, and what they asked for. Every role. */
export default async function ApprovalsPage() {
  const { profile } = await apiFetchServer("/auth/me");
  return <ApprovalsPageClient zone={profile.timeZone} />;
}
