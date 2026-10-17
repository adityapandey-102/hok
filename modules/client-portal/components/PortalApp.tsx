"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { StatusPill } from "../../../components/ui/StatusPill";
import { LINK_INVALID, PortalApiError, publicPortalApi, type PortalDashboard, type PortalEvent } from "../api/publicPortalApi";
import { eventTypeLabel, formatEventWhen, stageSummary } from "../portalFormat";
import { PortalStageTrack } from "./PortalStageTrack";
import { PortalEventModal } from "./PortalEventModal";
import { PortalCalendar } from "./PortalCalendar";
import { PortalComments } from "./PortalComments";

/**
 * The client portal (FR-POR-03..09): a plain, read-mostly page for the client,
 * opened by the link their manager shared. Everything is in the client's
 * time zone. No staff app chrome, no firm branding beyond the client's own
 * name and logo (decision D13: plain).
 */
export function PortalApp({ token }: { token: string }) {
  const [data, setData] = useState<PortalDashboard | null>(null);
  const [error, setError] = useState<PortalApiError | null>(null);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    publicPortalApi
      .dashboard(token)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof PortalApiError ? e : new PortalApiError("Something went wrong.", 0, null)));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => load(), [load]);

  if (error?.code === LINK_INVALID) {
    return (
      <Centered>
        <Icon name="lock" size={28} className="text-text-muted" />
        <h1 className="mt-3 font-serif text-[24px] text-text-primary">This link isn&apos;t active</h1>
        <p className="mt-2 max-w-sm text-sm text-text-secondary">It may have been replaced or switched off. Please ask your account manager for a new link.</p>
      </Centered>
    );
  }
  if (error) {
    return (
      <Centered>
        <p className="text-sm text-text-secondary" role="alert">
          {error.message}
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            setError(null);
            load();
          }}
        >
          Try again
        </Button>
      </Centered>
    );
  }
  if (!data) {
    return (
      <Centered>
        <p className="text-sm text-text-muted" aria-live="polite">
          Loading your dashboard…
        </p>
      </Centered>
    );
  }

  const zone = data.client.timeZone;
  const choices = [...(data.current ? [data.current] : []), ...data.upcoming, ...data.recent].filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i);

  return (
    <div className="min-h-screen bg-app-bg">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 sm:px-6">
          {data.client.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the client's own logo URL (any host); a plain img avoids allow-listing every domain
            <img src={data.client.logoUrl} alt="" className="h-10 w-10 rounded-app object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-app bg-primary-bg font-serif text-lg text-primary">{data.client.businessName.charAt(0)}</div>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-serif text-[20px] leading-tight text-text-primary">{data.client.businessName}</h1>
            <p className="text-xs text-text-muted">
              Your account manager: {data.manager.firstName} · Times shown in {zone.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section aria-labelledby="now-title">
          <h2 id="now-title" className="mb-2 text-sm font-semibold text-text-secondary">
            Happening now / next
          </h2>
          {data.current ? (
            <Card accent className="p-5">
              <EventHeading event={data.current} zone={zone} />
              <div className="mt-4">
                <PortalStageTrack stages={data.current.stages} currentPosition={data.current.currentStagePosition} />
              </div>
              <Button variant="outline" className="mt-4" onClick={() => setOpenEventId(data.current!.id)}>
                See updates
              </Button>
            </Card>
          ) : (
            <Card className="p-5 text-sm text-text-muted">Nothing scheduled right now. New events will appear here.</Card>
          )}
        </section>

        <EventList title="Coming up" events={data.upcoming.filter((e) => e.id !== data.current?.id)} zone={zone} onOpen={setOpenEventId} empty="No other upcoming events." />

        <PortalCalendar token={token} zone={zone} onOpen={setOpenEventId} />

        <EventList title="Recently finished" events={data.recent} zone={zone} onOpen={setOpenEventId} empty="Nothing finished yet." />

        <PortalComments token={token} zone={zone} events={choices} />

        <p className="pb-6 text-center text-[11px] text-text-muted">This page is private to {data.client.businessName}. Please don&apos;t share the link.</p>
      </main>

      <PortalEventModal token={token} zone={zone} eventId={openEventId} onClose={() => setOpenEventId(null)} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-app-bg px-6 text-center">{children}</div>;
}

function EventHeading({ event, zone }: { event: PortalEvent; zone: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="font-serif text-[18px] leading-snug text-text-primary">{event.title}</h3>
        <p className="mt-1 text-sm text-text-secondary">{formatEventWhen(event, zone)}</p>
        {event.location && <p className="text-xs text-text-muted">{event.location}</p>}
      </div>
      <div className="flex gap-1.5">
        <StatusPill label={eventTypeLabel(event.type)} tone="gray" />
        {event.state !== "active" && <StatusPill label={event.state === "cancelled" ? "Cancelled" : "Postponed"} tone="red" />}
      </div>
    </div>
  );
}

function EventList({ title, events, zone, onOpen, empty }: { title: string; events: PortalEvent[]; zone: string; onOpen: (id: string) => void; empty: string }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-sm font-semibold text-text-secondary">{title}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onOpen(e.id)}
                className="lift w-full rounded-app-lg border border-border bg-card p-4 text-left hover:border-primary/25"
              >
                <EventHeading event={e} zone={zone} />
                <p className="mt-2 text-xs text-text-muted">{stageSummary(e)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
