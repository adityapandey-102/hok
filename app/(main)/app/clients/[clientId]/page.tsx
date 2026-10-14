import { notFound, redirect } from "next/navigation";
import { hasCapability } from "../../../../../lib/domain";
import { apiFetchServer, ApiError } from "../../../../../lib/api/server";
import { ClientWorkspaceClient } from "../../../../../modules/clients/components/ClientWorkspaceClient";

export default async function ClientWorkspacePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "clients:read")) redirect("/app");

  // Another manager's client and an unknown id are both a 404 from the API.
  const result = await apiFetchServer(`/clients/${clientId}`).catch((err: unknown) => {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  });

  return <ClientWorkspaceClient initialClient={result.client} isAdmin={profile.role === "admin"} />;
}
