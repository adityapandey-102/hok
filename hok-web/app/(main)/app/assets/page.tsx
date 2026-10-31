import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { AssetsPageClient } from "../../../../modules/assets/components/AssetsPageClient";

export default async function AssetsPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "assets:read")) redirect("/app");
  return <AssetsPageClient isAdmin={profile.role === "admin"} viewerTimeZone={profile.timeZone} />;
}
