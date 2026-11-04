import { redirect } from "next/navigation";
import { clampPartCount, hasCapability } from "../../../../../lib/domain";
import { apiFetchServer } from "../../../../../lib/api/server";
import { NewEventClient } from "../../../../../modules/events/components/NewEventClient";
import type { PartContext } from "../../../../../modules/work-tree/partContext";

type Search = { clientId?: string; date?: string; parentKind?: string; parentId?: string; parentStageId?: string; parentTitle?: string; stageName?: string; count?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Add a part" sends the parent in the query string (round 4). The API re-checks all of it; this only keeps junk out of the form. */
function partFrom(s: Search): PartContext | undefined {
  if ((s.parentKind !== "event" && s.parentKind !== "task") || !s.parentId || !UUID.test(s.parentId) || !s.parentStageId || !UUID.test(s.parentStageId)) return undefined;
  return {
    parent: { kind: s.parentKind, id: s.parentId, stageId: s.parentStageId },
    parentTitle: (s.parentTitle ?? "the item").slice(0, 160),
    stageName: (s.stageName ?? "a stage").slice(0, 160),
    count: clampPartCount(s.count ?? "1"),
    clientId: s.clientId ?? null,
    clientName: null,
    eventId: null,
    eventTitle: null,
  };
}

export default async function NewEventPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const { clientId, date } = search;
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "events:write")) redirect("/app");
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  return <NewEventClient clientId={clientId || undefined} isAdmin={profile.role === "admin"} date={validDate} part={partFrom(search)} />;
}
