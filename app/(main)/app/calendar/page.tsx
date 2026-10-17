import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { CalendarView } from "../../../../modules/calendar/components/CalendarView";
import { ButtonLink } from "../../../../components/ui/Button";
import { Icon } from "../../../../components/ui/Icon";

export default async function CalendarPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "events:read")) redirect("/app");
  const isAdmin = profile.role === "admin";
  const canCreate = hasCapability(profile.role, "events:write");
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{isAdmin ? "Calendar" : "My calendar"}</h1>
          <p className="text-sm text-text-muted">
            {isAdmin ? "Every client event in the agency." : "Your clients events and personal entries."} Times are shown in {profile.timeZone}.
          </p>
        </div>
        {canCreate && (
          <div className="page-actions">
            <ButtonLink href="/app/events/new">
              <Icon name="plus" size={16} /> New event
            </ButtonLink>
          </div>
        )}
      </header>
      <CalendarView viewerTimeZone={profile.timeZone} isAdmin={isAdmin} />
    </div>
  );
}
