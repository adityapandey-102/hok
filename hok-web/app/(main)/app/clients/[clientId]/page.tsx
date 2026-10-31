import { notFound, redirect } from "next/navigation";
import { hasCapability } from "../../../../../lib/domain";
import { apiFetchServer, ApiError } from "../../../../../lib/api/server";
import { ClientWorkspaceClient, isWorkspaceTab } from "../../../../../modules/clients/components/ClientWorkspaceClient";

/** A client's workspace. `?tab=events|calendar|todos|assets|portal` opens that tab (links from search and the dashboard). */
export default async function ClientWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { clientId } = await params;
  const { tab } = await searchParams;
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "clients:read")) redirect("/app");

  // Another manager's client and an unknown id are both a 404 from the API.
  const result = await apiFetchServer(`/clients/${clientId}`).catch((err: unknown) => {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  });

  return (
    <ClientWorkspaceClient
      initialClient={result.client}
      isAdmin={profile.role === "admin"}
      viewerId={profile.id}
      viewerTimeZone={profile.timeZone}
      initialTab={typeof tab === "string" && isWorkspaceTab(tab) ? tab : undefined}
    />
  );
}
