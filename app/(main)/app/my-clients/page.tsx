import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { DashboardClient } from "../../../../modules/dashboard/components/DashboardClient";

/**
 * My clients (Admin only): the Admin's own clients and assigned tasks -- what
 * a manager's dashboard shows -- kept off the firm overview at /app.
 */
export default async function MyClientsPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "dashboard:global")) redirect("/app");
  return <DashboardClient firstName={profile.fullName.split(" ")[0] ?? profile.fullName} view="mine" />;
}
