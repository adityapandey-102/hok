import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { CalendarView } from "../../../../modules/calendar/components/CalendarView";
import { CalendarSubscribe } from "../../../../modules/calendar/components/CalendarSubscribe";
import { ButtonLink } from "../../../../components/ui/Button";
import { Icon } from "../../../../components/ui/Icon";

/** The calendar is for every role (round 1): events for the client managers, tasks and the person's own to-dos for everyone. */
export default async function CalendarPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "staff_tasks:read")) redirect("/app");
  const isAdmin = profile.role === "admin";
  const seesEvents = hasCapability(profile.role, "events:read");
  const canCreate = hasCapability(profile.role, "events:write");
  const subtitle = isAdmin
    ? "Every client event and task in the agency, plus your to-dos."
    : seesEvents
      ? "Your clients’ events, your tasks and to-dos, and personal entries."
      : "Your tasks and to-dos.";
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{isAdmin ? "Calendar" : "My calendar"}</h1>
          <p className="text-sm text-text-muted">
            {subtitle} Times are shown in {profile.timeZone}.
          </p>
        </div>
        <div className="page-actions">
          {seesEvents && <CalendarSubscribe timeZone={profile.timeZone} />}
          {canCreate && (
            <ButtonLink href="/app/events/new">
              <Icon name="plus" size={16} /> New event
            </ButtonLink>
          )}
        </div>
      </header>
      <CalendarView viewerTimeZone={profile.timeZone} isAdmin={isAdmin} role={profile.role} />
    </div>
  );
}
