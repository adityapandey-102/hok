import { redirect } from "next/navigation";
import { hasCapability } from "../../../../../lib/domain";
import { apiFetchServer } from "../../../../../lib/api/server";
import { NewClientClient } from "../../../../../modules/clients/components/NewClientClient";

export default async function NewClientPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "clients:write")) redirect("/app");
  return <NewClientClient isAdmin={profile.role === "admin"} />;
}
