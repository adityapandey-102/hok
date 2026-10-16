"use client";

import { useEffect, useRef, useState } from "react";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  assetFormSchema,
  type Asset,
  type AssetType,
  type ClientSummary,
  type EventSummary,
} from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { assetsApi } from "../api/assetsApi";
import { clientsApi } from "../../clients/api/clientsApi";
import { eventsApi } from "../../events/api/eventsApi";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { Select, Textarea } from "../../../components/ui/Select";
import { TagInput } from "./TagInput";

/**
 * Add / edit an asset link. With a fixed `clientId` (the client workspace tab)
 * the client is known; on /app/assets the form asks which client (create
 * only; an asset never changes client). The event picker lists that client's
 * events, loaded when the modal opens.
 */
export function AssetFormModal({
  asset,
  clientId,
  onClose,
  onSaved,
}: {
  asset?: Asset;
  clientId?: string;
  onClose: () => void;
  onSaved: (asset: Asset, created: boolean) => void;
}) {
  const [client, setClient] = useState(asset?.clientId ?? clientId ?? "");
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [title, setTitle] = useState(asset?.title ?? "");
  const [url, setUrl] = useState(asset?.url ?? "");
  const [type, setType] = useState<AssetType>(asset?.type ?? "other");
  const [comment, setComment] = useState(asset?.comment ?? "");
  const [tags, setTags] = useState<string[]>(asset?.tags ?? []);
  const [eventId, setEventId] = useState(asset?.eventId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const needsClientPicker = !asset && !clientId;

  useEffect(() => {
    if (!needsClientPicker) return;
    let cancelled = false;
    clientsApi
      .list({ limit: 100 })
      .then((data) => {
        if (cancelled) return;
        setClients(data.clients.filter((c) => c.status !== "archived"));
      })
      .catch(() => {
        if (!cancelled) setFormError("Could not load your clients. Close and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [needsClientPicker]);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    eventsApi
      .list({ clientId: client, limit: 100 })
      .then((data) => {
        if (!cancelled) setEvents(data.events);
      })
      .catch(() => {
        // The event link is optional; the form still saves without the list.
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = assetFormSchema.safeParse({ title, url, type, comment, tags });
    if (!parsed.success || !client) {
      const next: Record<string, string> = {};
      if (!parsed.success) for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      if (!client) next.client = "Pick a client";
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const v = parsed.data;
      if (asset) {
        const { asset: saved } = await assetsApi.update(asset.id, {
          title: v.title,
          url: v.url,
          type: v.type,
          comment: v.comment || null,
          eventId: eventId || null,
          tags: v.tags,
          version: asset.version,
        });
        onSaved(saved, false);
      } else {
        const { asset: saved } = await assetsApi.create({
          clientId: client,
          title: v.title,
          url: v.url,
          type: v.type,
          comment: v.comment || null,
          eventId: eventId || null,
          tags: v.tags,
        });
        onSaved(saved, true);
      }
    } catch (err) {
      setSaving(false);
      if (isApiErrorCode(err, "ASSET_MODIFIED")) setFormError("Someone else changed this asset. Close this and reopen it to see the latest.");
      else if (isApiErrorCode(err, "CLIENT_ARCHIVED")) setFormError("This client is archived and read-only.");
      else if (isApiErrorCode(err, "ASSET_EVENT_INVALID")) setFormError("Pick one of this client's events.");
      else setFormError(err instanceof Error ? err.message : "Failed to save the asset");
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="asset-form-title" initialFocusRef={titleRef} panelClassName="max-w-lg p-6">
      <h2 id="asset-form-title" className="font-serif text-lg font-bold text-text-primary">
        {asset ? "Edit asset link" : "Add asset link"}
      </h2>
      <p className="mt-1 text-xs text-text-muted">Paste a link (Drive, Dropbox, Canva, Figma, YouTube…). Files are never uploaded.</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3.5" noValidate>
        {needsClientPicker && (
          <div>
            <FieldLabel htmlFor="asset-client" required>
              Client
            </FieldLabel>
            <Select id="asset-client" value={client} onChange={(e) => { setClient(e.target.value); setEventId(""); setEvents([]); }}>
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </Select>
            <FieldError>{errors.client}</FieldError>
          </div>
        )}
        <div>
          <FieldLabel htmlFor="asset-title" required>
            Title
          </FieldLabel>
          <Input id="asset-title" ref={titleRef} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          <FieldError>{errors.title}</FieldError>
        </div>
        <div>
          <FieldLabel htmlFor="asset-url" required>
            Link
          </FieldLabel>
          <Input id="asset-url" type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          <FieldError>{errors.url}</FieldError>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="asset-type">Type</FieldLabel>
            <Select id="asset-type" value={type} onChange={(e) => setType(e.target.value as AssetType)}>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ASSET_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="asset-event">Event (optional)</FieldLabel>
            <Select id="asset-event" value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={!client}>
              <option value="">No event</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="asset-comment">Comment</FieldLabel>
          <Textarea id="asset-comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
          <FieldError>{errors.comment}</FieldError>
        </div>
        <div>
          <FieldLabel htmlFor="asset-tags">Tags</FieldLabel>
          <TagInput id="asset-tags" value={tags} onChange={setTags} clientId={client || undefined} />
          <FieldError>{errors.tags}</FieldError>
        </div>
        {formError && (
          <p role="alert" className="text-sm text-error">
            {formError}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : asset ? "Save changes" : "Add asset"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
