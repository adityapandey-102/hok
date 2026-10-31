import { notFound, redirect } from "next/navigation";
import { hasCapability } from "../../../../../lib/domain";
import { apiFetchServer, ApiError } from "../../../../../lib/api/server";
import { EventDetailClient } from "../../../../../modules/events/components/EventDetailClient";

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "events:read")) redirect("/app");

  // Another manager event and an unknown id are both a 404 from the API.
  const result = await apiFetchServer(`/events/${eventId}`).catch((err: unknown) => {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  });

  return <EventDetailClient initialEvent={result.event} viewerTimeZone={profile.timeZone} isAdmin={profile.role === "admin"} />;
}
