import { Suspense } from "react";
import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { CommentsPageClient } from "../../../../modules/client-comments/components/CommentsPageClient";

export default async function CommentsPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "comments:read")) redirect("/app");
  return (
    <Suspense>
      <CommentsPageClient viewerTimeZone={profile.timeZone} />
    </Suspense>
  );
}
