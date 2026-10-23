"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { IconName } from "../../../components/ui/Icon";
import { Segmented } from "../../../components/ui/Segmented";
import { parseReportView, REPORT_VIEWS, type ReportView } from "../lib/reportFormat";
import { SkeletonBoard, SkeletonRows } from "./ReportParts";

/** While a tab's code downloads (the first time it is opened). */
function SectionLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="skeleton h-12 w-64 max-w-full rounded-app" />
      <SkeletonBoard cells={4} columns="grid-cols-2 lg:grid-cols-4" />
      <SkeletonRows rows={5} />
    </div>
  );
}

// Each tab is its own chunk and only mounts while it is open, so a report's code
// AND its data load when it is opened, never for a tab nobody looks at.
const TeamStatusCard = dynamic(() => import("./TeamStatusCard").then((m) => m.TeamStatusCard), { loading: SectionLoading });
const StaffReportClient = dynamic(() => import("./StaffReportClient").then((m) => m.StaffReportClient), { loading: SectionLoading });
const ClientReportClient = dynamic(() => import("./ClientReportClient").then((m) => m.ClientReportClient), { loading: SectionLoading });
const ActivityFeed = dynamic(() => import("../../activity/components/ActivityFeed").then((m) => m.ActivityFeed), { loading: SectionLoading });

const TABS: Record<ReportView, { label: string; icon: IconName; description: string }> = {
  team: { label: "Team status", icon: "users", description: "Who is working and who is idle" },
  staff: { label: "Staff report", icon: "bar-chart", description: "One person's month, week by week" },
  client: { label: "Client report", icon: "briefcase", description: "One client's month" },
  activity: { label: "Daily activity", icon: "history", description: "Who did what, day by day" },
};

/**
 * The Reports page's tabs. The open tab lives in the URL (`?view=`) so a link
 * or the Back button lands on the same report. A segmented control: one Tab
 * stop; arrow keys, Home and End move between tabs, Enter or Space opens one
 * (opening is deliberate, because opening a report loads it).
 */
export function ReportsView({ timeZone }: { timeZone: string }) {
  const params = useSearchParams();
  const view = parseReportView(params.get("view"));
  function open(next: ReportView) {
    if (next === view) return;
    window.history.pushState(null, "", `/app/reports?view=${next}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Segmented
          label="Reports"
          idPrefix="reports"
          options={REPORT_VIEWS.map((v) => ({ id: v, label: TABS[v].label, icon: TABS[v].icon }))}
          value={view}
          onChange={open}
          manual
        />
        <p className="px-1 text-[13px] text-text-muted">{TABS[view].description}</p>
      </div>

      <div role="tabpanel" id={`reports-panel-${view}`} aria-labelledby={`reports-tab-${view}`}>
        {view === "team" ? (
          <TeamStatusCard />
        ) : view === "staff" ? (
          <StaffReportClient timeZone={timeZone} />
        ) : view === "client" ? (
          <ClientReportClient timeZone={timeZone} />
        ) : (
          <ActivityFeed defaultRange="today" timeZone={timeZone} />
        )}
      </div>
    </div>
  );
}
