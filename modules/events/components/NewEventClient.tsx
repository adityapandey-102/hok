"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Client } from "../../../lib/domain";
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

/** New event for one client, from an active stage template. */
function NewEventForClient({ clientId, isAdmin, date }: { clientId: string; isAdmin: boolean; date?: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  // Only the first active template (to preselect) and whether any exist; the picker itself searches the API.
  const [templates, setTemplates] = useState<{ first: SelectOption | null; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      clientsApi.get(clientId),
      templatesApi.list({ active: true, limit: 1 }),
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
    try {
      const { event } = await eventsApi.create({
        clientId,
        templateId: values.templateId!,
        title: values.title,
        type: values.type,
        startsAt: values.startsAt,
        endsAt: values.endsAt,
        timeZone: values.timeZone,
        location: values.location,
        description: values.description,
        assignedTeam: values.assignedTeam,
      });
      showToast("Event created.", "success");
      router.push(`/app/events/${event.id}`);
      return null;
    } catch (err) {
      if (isApiErrorCode(err, "EVENT_TIMES_INVALID")) return "Check the times: the end must not be before the start, and an event lasts at most 31 days.";
      if (isApiErrorCode(err, "CLIENT_ARCHIVED")) return "This client is archived and read-only.";
      if (isApiErrorCode(err, "EVENT_TEMPLATE_INVALID")) return "That template is not available. Pick another.";
      return err instanceof Error ? err.message : "Failed to create the event";
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">New event</h1>
          {client && <p className="text-sm text-text-muted">for {client.businessName}</p>}
        </div>
        <ButtonLink href={`/app/clients/${clientId}`} variant="outline">
          <Icon name="chevron-right" size={15} className="rotate-180" /> Back to client
        </ButtonLink>
      </div>
      {error ? (
        <p className="text-sm text-error">{error}</p>
      ) : !client ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : client.status === "archived" ? (
        <p className="text-sm text-text-muted">This client is archived and read-only.</p>
      ) : !templates ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : templates.total === 0 ? (
        <p className="text-sm text-text-muted">There is no active stage template yet. Ask an Admin to create one.</p>
      ) : (
        <EventForm defaultDate={date} clientTimeZone={client.timeZone} defaultTemplate={templates.first ?? undefined} canPickTeam={isAdmin} submitLabel="Create event" onSubmit={handleCreate} />
      )}
    </div>
  );
}

/**
 * Entry point. With a clientId it goes straight to the form; from the global
 * calendar (an empty slot clicked) it first asks which client the event is for.
 * `date` (YYYY-MM-DD) prefills the start and end day.
 */
export function NewEventClient({ clientId, isAdmin, date }: { clientId?: string; isAdmin: boolean; date?: string }) {
  const [picked, setPicked] = useState(clientId ?? "");

  if (picked) return <NewEventForClient clientId={picked} isAdmin={isAdmin} date={date} />;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="page-title mb-4">New event</h1>
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
