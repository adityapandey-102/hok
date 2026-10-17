import { apiFetchServer } from "../../../lib/api/server";
import { DashboardClient } from "../../../modules/dashboard/components/DashboardClient";

/** Staff landing page: the role dashboard (M10). The API shapes the data by role. */
export default async function DashboardPage() {
  const { profile } = await apiFetchServer("/auth/me");
  return <DashboardClient firstName={profile.fullName.split(" ")[0] ?? profile.fullName} />;
}
