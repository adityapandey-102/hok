import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { TeamWorkloadClient } from "../../../../modules/dashboard/components/TeamWorkloadClient";

/** Team workload (Admin, `dashboard:global`): the dashboard's "View the whole team". */
export default async function TeamPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "dashboard:global")) redirect("/app");
  return <TeamWorkloadClient />;
}
