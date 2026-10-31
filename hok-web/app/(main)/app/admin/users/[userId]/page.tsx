import { notFound, redirect } from "next/navigation";
import { hasCapability } from "../../../../../../lib/domain";
import { apiFetchServer, ApiError } from "../../../../../../lib/api/server";
import { UserDetailClient } from "../../../../../../modules/admin-users/components/UserDetailClient";

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "users:manage")) redirect("/app");

  const result = await apiFetchServer(`/users/${userId}`).catch((err: unknown) => {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  });

  return <UserDetailClient initialUser={result.user} currentUserId={profile.id} />;
}
