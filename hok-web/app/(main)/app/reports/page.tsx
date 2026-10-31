import { Suspense } from "react";
import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { ReportsView } from "../../../../modules/reports/components/ReportsView";

/**
 * Reports (Admin, `dashboard:global`): one page, tabs for Team status, Staff
 * report and Client report, the open one in the URL (`?view=`, Team status by
 * default). Only the open tab is mounted, so each report loads (code and data)
 * when it is opened.
 */
export default async function ReportsPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "dashboard:global")) redirect("/app");
  return (
    <div>
      <div className="mb-5">
        <h1 className="page-title">Reports</h1>
        <p className="text-sm text-text-muted">Your team and clients at a glance. Each report loads when you open it.</p>
      </div>
      {/* useSearchParams needs a Suspense boundary for the build. */}
      <Suspense fallback={<div className="skeleton h-20 rounded-app-lg" aria-hidden />}>
        <ReportsView timeZone={profile.timeZone} />
      </Suspense>
    </div>
  );
}
