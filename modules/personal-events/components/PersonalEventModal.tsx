"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Select, Textarea } from "../../../components/ui/Select";
import { isApiErrorCode } from "../../../lib/api/client";
import { personalEventsApi, type PersonalEvent } from "../api/personalEventsApi";
import { emptyValues, toPayload, valuesFromEvent, type PersonalEventFormValues } from "../personalEventForm";

/**
 * Create / edit / delete a personal calendar entry. `eventId` set = edit (loads the
 * entry for its description + version; a 409 reloads the latest). Times are typed in
 * the viewer time zone.
 */
export function PersonalEventModal({
  eventId,
  day,
  zone,
  clients,
  onClose,
  onChanged,
}: {
  eventId: string | null;
  day?: string;
  zone: string;
  clients: { id: string; name: string }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [entry, setEntry] = useState<PersonalEvent | null>(null);
  const [values, setValues] = useState<PersonalEventFormValues>(emptyValues(day));
  const [loading, setLoading] = useState(Boolean(eventId));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    personalEventsApi
      .get(eventId)
      .then(({ personalEvent }) => {
        if (cancelled) return;
        setEntry(personalEvent);
        setValues(valuesFromEvent(personalEvent, zone));
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load the entry"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [eventId, zone, reloadKey]);

  const set = (patch: Partial<PersonalEventFormValues>) => setValues((v) => ({ ...v, ...patch }));
  // A linked client that is not in the caller's list (an Admin editing someone else's entry) stays selectable.
  const clientOptions =
    entry?.clientId && !clients.some((c) => c.id === entry.clientId) ? [...clients, { id: entry.clientId, name: entry.clientName ?? "Linked client" }] : clients;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const built = toPayload(values, zone);
    if ("error" in built) return setError(built.error);
    setSaving(true);
    try {
      if (eventId && entry) {
        const { payload } = built;
        await personalEventsApi.update(eventId, {
          ...payload,
          ...(payload.clientId === entry.clientId ? { clientId: undefined } : {}),
          version: entry.version,
        });
      } else {
        await personalEventsApi.create(built.payload);
      }
      onChanged();
      onClose();
    } catch (err) {
      if (isApiErrorCode(err, "PERSONAL_EVENT_MODIFIED")) {
        setError("This entry was changed elsewhere. The latest version is loaded; review it and save again.");
        setLoading(true);
        setReloadKey((k) => k + 1);
      } else setError(err instanceof Error ? err.message : "Could not save the entry");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!eventId) return;
    setSaving(true);
    try {
      await personalEventsApi.remove(eventId);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the entry");
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="pe-title-h" panelClassName="max-w-lg">
      <form onSubmit={submit} className="flex flex-col gap-4 p-5">
        <h2 id="pe-title-h" className="font-serif text-lg font-bold text-text-primary">
          {eventId ? "Edit personal event" : "New personal event"}
        </h2>
        {loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <>
            <div>
              <FieldLabel required htmlFor="pe-title">
                Title
              </FieldLabel>
              <Input id="pe-title" value={values.title} maxLength={160} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel required htmlFor="pe-start">
                  Starts
                </FieldLabel>
                <Input id="pe-start" type="datetime-local" value={values.start} onChange={(e) => set({ start: e.target.value })} />
              </div>
              <div>
                <FieldLabel required htmlFor="pe-end">
                  Ends
                </FieldLabel>
                <Input id="pe-end" type="datetime-local" value={values.end} onChange={(e) => set({ end: e.target.value })} />
              </div>
            </div>
            <p className="-mt-2 text-xs text-text-muted">Times are in {zone}.</p>
            <div>
              <FieldLabel htmlFor="pe-client">Client (optional)</FieldLabel>
              <Select id="pe-client" value={values.clientId} onChange={(e) => set({ clientId: e.target.value })}>
                <option value="">No client</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="pe-description">Description</FieldLabel>
              <Textarea id="pe-description" rows={3} value={values.description} maxLength={5000} onChange={(e) => set({ description: e.target.value })} />
            </div>
          </>
        )}
        <FieldError>{error}</FieldError>
        <div className="flex flex-wrap items-center gap-2">
          {!loading && (
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : eventId ? "Save changes" : "Create personal event"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {eventId && !loading && entry && (
            <span className="ml-auto flex items-center gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-xs text-text-secondary">Delete this entry?</span>
                  <Button type="button" variant="danger" disabled={saving} onClick={() => void remove()}>
                    Yes, delete
                  </Button>
                </>
              ) : (
                <Button type="button" variant="outline" className="text-error" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
            </span>
          )}
        </div>
      </form>
    </Modal>
  );
}
