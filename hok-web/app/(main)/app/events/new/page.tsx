import { redirect } from "next/navigation";
import { hasCapability } from "../../../../../lib/domain";
import { apiFetchServer } from "../../../../../lib/api/server";
import { NewEventClient } from "../../../../../modules/events/components/NewEventClient";

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ clientId?: string; date?: string }> }) {
  const { clientId, date } = await searchParams;
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "events:write")) redirect("/app");
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  return <NewEventClient clientId={clientId} isAdmin={profile.role === "admin"} date={validDate} />;
}
