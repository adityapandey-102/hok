import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { CalendarView } from "../../../../modules/calendar/components/CalendarView";

export default async function CalendarPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "events:read")) redirect("/app");
  const isAdmin = profile.role === "admin";
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="page-title">{isAdmin ? "Calendar" : "My calendar"}</h1>
      <p className="mb-5 text-sm text-text-muted">
        {isAdmin ? "Every client event in the agency." : "Your clients events and personal entries."} Times are shown in {profile.timeZone}.
      </p>
      <CalendarView viewerTimeZone={profile.timeZone} isAdmin={isAdmin} />
    </div>
  );
}
