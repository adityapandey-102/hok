"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { publicPortalApi, type PortalEventDetail } from "../api/publicPortalApi";
import { formatEventWhen, formatShortDate, stageSummary } from "../portalFormat";
import { PortalStageTrack } from "./PortalStageTrack";

/** One event with the updates the manager chose to share (FR-POR-06). Loaded when opened. */
export function PortalEventModal({ token, zone, eventId, onClose }: { token: string; zone: string; eventId: string | null; onClose: () => void }) {
  return (
    <Modal open={eventId !== null} onClose={onClose} labelledBy="portal-event-title">
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
    <div className="p-6">
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      {!error && !event && <p className="text-sm text-text-muted">Loading…</p>}
      {event && (
        <>
          <h2 id="portal-event-title" className="font-serif text-[20px] text-text-primary">
            {event.title}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{formatEventWhen(event, zone)}</p>
          {event.location && <p className="text-xs text-text-muted">{event.location}</p>}
          <p className="mt-4 mb-2 text-xs font-semibold text-text-secondary">{stageSummary(event)}</p>
          <PortalStageTrack stages={event.stages} currentPosition={event.currentStagePosition} />

          <h3 className="mt-6 mb-2 text-sm font-semibold text-text-secondary">Updates</h3>
          {event.updates.length === 0 ? (
            <p className="text-sm text-text-muted">No updates shared yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {event.updates.map((u, i) => (
                <li key={i} className="border-l-2 border-gold pl-3">
                  <p className="text-xs text-text-muted">
                    {formatShortDate(u.createdAt, zone)} · {u.stageName}
                  </p>
                  {u.note && <p className="mt-0.5 text-sm whitespace-pre-line text-text-primary">{u.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="mt-6 flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
