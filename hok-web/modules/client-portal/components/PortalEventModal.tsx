"use client";

import { useEffect, useState } from "react";
import { Loader } from "../../../components/ui/Loader";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { publicPortalApi, type PortalEventDetail } from "../api/publicPortalApi";
import { formatEventWhen, formatLongDate, formatShortDate, stageSummary } from "../portalFormat";
import { portalAssetIcon, portalAssetLabel } from "../portalAssets";
import { Icon } from "../../../components/ui/Icon";
import { PortalStageTrack } from "./PortalStageTrack";

/** One event with the updates the manager chose to share (FR-POR-06). Loaded when opened. */
export function PortalEventModal({ token, zone, eventId, onClose }: { token: string; zone: string; eventId: string | null; onClose: () => void }) {
  return (
    <Modal open={eventId !== null} onClose={onClose} labelledBy="portal-event-title" panelClassName="max-h-[92vh] sm:max-w-xl">
      {eventId && <EventBody key={eventId} token={token} zone={zone} eventId={eventId} onClose={onClose} />}
    </Modal>
  );
}

function EventBody({ token, zone, eventId, onClose }: { token: string; zone: string; eventId: string; onClose: () => void }) {
  const [event, setEvent] = useState<PortalEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicPortalApi
      .event(token, eventId)
      .then((r) => !cancelled && setEvent(r.event))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Could not load this event."));
    return () => {
      cancelled = true;
    };
  }, [token, eventId]);

  return (
    <div className="max-h-[88vh] overflow-y-auto p-5 sm:p-6">
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      {!error && !event && <div className="flex justify-center py-8">
          <Loader label="Loading" />
        </div>}
      {event && (
        <>
          <h2 id="portal-event-title" className="font-serif text-[20px] text-text-primary">
            {event.title}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{formatEventWhen(event, zone)}</p>
          {event.location && <p className="text-xs text-text-muted">{event.location}</p>}
          <p className="mt-4 mb-2 text-xs font-semibold text-text-secondary">{stageSummary(event)}</p>
          <PortalStageTrack stages={event.stages} currentPosition={event.currentStagePosition} />

          <h3 className="mt-7 mb-3 font-serif text-[16px] text-text-primary">Updates</h3>
          {event.updates.length === 0 ? (
            <p className="text-sm text-text-muted">No updates shared yet.</p>
          ) : (
            <ul className="ml-1 flex flex-col gap-4">
              {event.updates.map((u, i) => (
                <li key={i} className="relative border-l border-border pl-4">
                  <span aria-hidden className={`absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full ring-4 ring-card ${i === 0 ? "bg-primary" : "bg-ink"}`} />
                  <p className="text-xs text-text-muted">
                    {formatShortDate(u.createdAt, zone)} · {u.stageName}
                  </p>
                  {u.note && <p className="mt-0.5 text-sm whitespace-pre-line text-text-primary">{u.note}</p>}
                </li>
              ))}
            </ul>
          )}

          {event.assets && event.assets.length > 0 && (
            <section aria-label="Shared with you" className="mt-7">
              <h3 className="mb-3 font-serif text-[16px] text-text-primary">Shared with you</h3>
              <ul className="flex flex-col divide-y divide-border-light rounded-app border border-border-light">
                {event.assets.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3.5 py-3">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-app bg-accent-bg text-text-secondary">
                      <Icon name={portalAssetIcon(a.type)} size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm font-medium break-words text-primary hover:underline">
                        {a.title}
                        <Icon name="external-link" size={13} className="shrink-0" />
                      </a>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                        <span>{portalAssetLabel(a.type)}</span>
                        {a.stageName && <span className="rounded-full bg-accent-bg px-2 py-0.5 font-medium text-text-secondary">{a.stageName}</span>}
                        <span>{formatLongDate(a.createdAt, zone)}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <div className="mt-6 flex justify-end max-sm:[&>button]:w-full">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
