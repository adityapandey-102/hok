"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkTitles, createdSummary, creatingLabel, partHref, workErrorMessage, type Client } from "../../../lib/domain";
import type { PartContext } from "../../work-tree/partContext";
import type { SelectOption } from "../../../lib/api/options";
import { isApiErrorCode } from "../../../lib/api/client";
import { clientsApi } from "../../clients/api/clientsApi";
import { templatesApi } from "../../stage-templates/api/templatesApi";
import { eventsApi } from "../api/eventsApi";
import { ButtonLink } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/Toast";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { FieldLabel } from "../../../components/ui/Field";
import { EventForm, type EventFormValues } from "./EventForm";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";

/** The same friendly text for every create error (also used per part). */
function describeCreateError(err: unknown): string {
  if (isApiErrorCode(err, "EVENT_TIMES_INVALID")) return "Check the times: the end must not be before the start, and an event lasts at most 31 days.";
  if (isApiErrorCode(err, "CLIENT_ARCHIVED")) return "This client is archived and read-only.";
  if (isApiErrorCode(err, "EVENT_TEMPLATE_INVALID")) return "That template is not available. Pick another.";
  if (isApiErrorCode(err, "EVENT_NOT_ACTIVE")) return "The item you are adding to is cancelled or postponed. Reactivate it first.";
  if (isApiErrorCode(err, "STAFF_TASK_DONE")) return "The task you are adding to is done. Reopen it first.";
  const code = (err as { code?: string } | null)?.code;
  return workErrorMessage(code) ?? (err instanceof Error ? err.message : "Failed to create the event");
}

/**
 * New event for one client, from an active stage template. With `part` (round 4) it makes child events under a
 * stage of the parent: the client is the parent's (so it is fixed), `part.count` events are created one request
 * at a time with progress shown, and it returns to the parent afterwards. If a run stops halfway it says how many exist.
 */
function NewEventForClient({ clientId, isAdmin, date, part }: { clientId: string; isAdmin: boolean; date?: string; part?: PartContext }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [progress, setProgress] = useState<string | null>(null);
  const [stopped, setStopped] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  // Only the first active template (to preselect) and whether any exist; the picker itself searches the API.
  const [templates, setTemplates] = useState<{ first: SelectOption | null; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      clientsApi.get(clientId),
      templatesApi.list({ kind: "event", active: true, limit: 1 }),
    ])
      .then(([c, t]) => {
        if (cancelled) return;
        setClient(c.client);
        const first = t.templates.find((x) => x.active);
        setTemplates({ first: first ? { id: first.id, label: first.name, hint: `${first.stages.length} stages` } : null, total: t.total });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the form");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function handleCreate(values: EventFormValues): Promise<string | null> {
    const body = {
      clientId,
      templateId: values.templateId!,
      type: values.type,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      timeZone: values.timeZone,
      location: values.location,
      description: values.description,
      assignedTeam: values.assignedTeam,
    };
    if (part) {
      const titles = bulkTitles(values.title, part.count);
      let made = 0;
      try {
        for (const title of titles) {
          setProgress(creatingLabel(made, titles.length));
          await eventsApi.create({ ...body, title, parent: part.parent });
          made += 1;
        }
      } catch (err) {
        const reason = describeCreateError(err);
        if (made === 0) return reason;
        setStopped(createdSummary(made, titles.length, reason));
        return null;
      }
      showToast(createdSummary(made, titles.length), "success");
      router.push(partHref(part.parent));
      return null;
    }
    try {
      const { event } = await eventsApi.create({ ...body, title: values.title });
      showToast("Event created.", "success");
      router.push(`/app/events/${event.id}`);
      return null;
    } catch (err) {
      return describeCreateError(err);
    }
  }

  const backHref = part ? partHref(part.parent) : `/app/clients/${clientId}`;
  const backLabel = part ? `Back to ${part.parentTitle}` : "Back to client";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">{part ? (part.count > 1 ? `New parts (${part.count} events)` : "New part (event)") : "New event"}</h1>
          <p className="text-sm break-words text-text-muted">
            {part
              ? `Part of ${part.parentTitle} › ${part.stageName}. ${client ? `For ${client.businessName}, the same client as the item it belongs to.` : ""}`
              : client
                ? `For ${client.businessName}. Pick a stage template and a time.`
                : "Pick a stage template and a time."}
          </p>
        </div>
        <div className="page-actions">
          <ButtonLink href={backHref} variant="outline">
            <Icon name="chevron-right" size={15} className="rotate-180" /> {backLabel}
          </ButtonLink>
        </div>
      </header>
      {stopped ? (
        <Card>
          <div role="alert" className="p-5 text-sm text-error">
            {stopped}
          </div>
          <div className="border-t border-border-light p-5">
            <ButtonLink href={backHref}>{backLabel}</ButtonLink>
          </div>
        </Card>
      ) : error ? (
        <p className="text-sm text-error">{error}</p>
      ) : !client ? (
        <div className="skeleton h-80 rounded-app-lg" aria-busy="true" aria-label="Loading" />
      ) : client.status === "archived" ? (
        <Card><EmptyState icon="lock" compact title="This client is archived and read-only." /></Card>
      ) : !templates ? (
        <div className="skeleton h-80 rounded-app-lg" aria-busy="true" aria-label="Loading" />
      ) : templates.total === 0 ? (
        <Card><EmptyState icon="layers" title="There is no active stage template yet." description="Ask an Admin to create one." /></Card>
      ) : (
        <EventForm
          defaultDate={date}
          clientTimeZone={client.timeZone}
          defaultTemplate={templates.first ?? undefined}
          canPickTeam={isAdmin}
          submitLabel={part ? (part.count > 1 ? `Create ${part.count} events` : "Create event") : "Create event"}
          progress={progress}
          titleHint={part && part.count > 1 ? (t) => `Each title gets a number added, e.g. “${bulkTitles(t || "Title", part.count)[0]}”.` : undefined}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}

/**
 * Entry point. With a clientId it goes straight to the form; from the global
 * calendar (an empty slot clicked) it first asks which client the event is for.
 * `date` (YYYY-MM-DD) prefills the start and end day.
 */
export function NewEventClient({ clientId, isAdmin, date, part }: { clientId?: string; isAdmin: boolean; date?: string; part?: PartContext }) {
  const [picked, setPicked] = useState(clientId ?? "");

  if (part && !clientId) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="page-title">New part (event)</h1>
        <p className="text-sm text-text-muted">An event part needs a client, and the item it belongs to has none.</p>
      </div>
    );
  }
  if (picked) return <NewEventForClient clientId={picked} isAdmin={isAdmin} date={date} part={part} />;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <div>
        <h1 className="page-title">New event</h1>
        <p className="text-sm text-text-muted">Start by choosing the client.</p>
      </div>
      <div className="rounded-app-lg border border-border bg-card p-5 shadow-app">
        <FieldLabel htmlFor="ne-client">Which client is it for?</FieldLabel>
        <SearchSelect
          id="ne-client"
          placeholder="Search clients…"
          emptyText="No clients match. Create the client first."
          value={null}
          load={clientsApi.searchOptions}
          onChange={(id) => id && setPicked(id)}
        />
      </div>
    </div>
  );
}
