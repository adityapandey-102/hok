import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { ClientsListClient } from "../../../../modules/clients/components/ClientsListClient";

export default async function ClientsPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "clients:read")) redirect("/app");
  return <ClientsListClient isAdmin={profile.role === "admin"} />;
}
