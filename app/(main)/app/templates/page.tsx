import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { TemplatesClient } from "../../../../modules/stage-templates/components/TemplatesClient";

export default async function TemplatesPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "stage_templates:manage")) redirect("/app");
  return <TemplatesClient />;
}
