"use client";

import { useEffect, useRef, useState } from "react";
import {
  CLIENT_STATUS_LABELS,
  formatDateOnly,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type Client,
} from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { clientsApi, type CreateClientPayload, type UpdateClientPayload } from "../api/clientsApi";
import type { UserAccount } from "../../admin-users/api/usersApi";
import { Button, ButtonLink } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { FieldLabel } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { ClientForm } from "./ClientForm";
import { EventsTab } from "../../events/components/EventsTab";
import { CalendarView } from "../../calendar/components/CalendarView";
import { AssetsPanel } from "../../assets/components/AssetsPanel";
import { PortalTab } from "../../portal/components/PortalTab";
import { STATUS_TONES } from "./ClientsListClient";

/**
 * The client workspace (FR-CLI-06). Only the Overview tab exists in M3; the
 * Events / Calendar / Assets / Comments / Portal tabs are added by the
 * milestones that build them (no placeholder tabs).
 */
export function ClientWorkspaceClient({
  initialClient,
  isAdmin,
  viewerTimeZone = "Asia/Kolkata",
}: {
  initialClient: Client;
  isAdmin: boolean;
  viewerTimeZone?: string;
}) {
  const [tab, setTab] = useState<"overview" | "events" | "calendar" | "assets" | "portal">("overview");
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [client, setClient] = useState<Client>(initialClient);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  const archived = client.status === "archived";

  async function reload() {
    try {
      const { client: fresh } = await clientsApi.get(client.id);
      setClient(fresh);
      setConflict(false);
      setEditing(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reload the client", "error");
    }
  }

  function describe(err: unknown, fallback: string): string {
    if (isApiErrorCode(err, "CLIENT_MODIFIED")) {
      setConflict(true);
      return "Someone else changed this client. Reload to see the latest version.";
    }
    if (isApiErrorCode(err, "CLIENT_ARCHIVED")) return "This client is archived and read-only.";
    if (isApiErrorCode(err, "CLIENT_CONTRACT_DATES_INVALID")) return "The contract end date can't be before the start date.";
    return err instanceof Error ? err.message : fallback;
  }

  async function handleSave(payload: CreateClientPayload | Omit<UpdateClientPayload, "version">): Promise<string | null> {
    try {
      const { client: saved } = await clientsApi.update(client.id, { ...payload, version: client.version } as UpdateClientPayload);
      setClient(saved);
      setEditing(false);
      setConflict(false);
      showToast("Client saved.", "success");
      return null;
    } catch (err) {
      return describe(err, "Failed to save the client");
    }
  }

  async function handleArchive() {
    const ok = await confirm({
      title: `Archive ${client.businessName}?`,
      body: "It disappears from the active list and becomes read-only. Its data is kept and you can unarchive it later.",
      confirmLabel: "Archive",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { client: saved } = await clientsApi.archive(client.id, client.version);
      setClient(saved);
      setEditing(false);
      showToast("Client archived.", "success");
    } catch (err) {
      showToast(describe(err, "Failed to archive the client"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnarchive() {
    setBusy(true);
    try {
      const { client: saved } = await clientsApi.unarchive(client.id, client.version);
      setClient(saved);
      showToast("Client unarchived.", "success");
    } catch (err) {
      showToast(describe(err, "Failed to unarchive the client"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">{client.businessName}</h1>
            <StatusPill label={CLIENT_STATUS_LABELS[client.status]} tone={STATUS_TONES[client.status]} />
          </div>
          <p className="text-sm text-text-muted">
            {[client.industry, `Owner: ${client.ownerName}`, client.timeZone].filter(Boolean).join(" · ")}
          </p>
        </div>
        <ButtonLink href="/app/clients" variant="outline">
          <Icon name="chevron-right" size={15} className="rotate-180" /> All clients
        </ButtonLink>
      </div>

      {conflict && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-app border border-error/30 bg-error-bg p-3 text-sm text-error">
          <span>Someone else changed this client while you were editing.</span>
          <Button variant="outline" onClick={reload}>
            Reload latest
          </Button>
        </div>
      )}

      {archived && (
        <div className="mb-4 rounded-app border border-border bg-gray-pill-bg p-3 text-sm text-text-secondary">
          This client is archived and read-only. Unarchive it to make changes.
        </div>
      )}

      <div role="tablist" aria-label="Client workspace" className="mb-4 flex gap-1 border-b border-border">
        {(["overview", "events", "calendar", "assets", "portal"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text-primary"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "events" && <EventsTab clientId={client.id} viewerTimeZone={viewerTimeZone} readOnly={archived} />}

      {tab === "calendar" && <CalendarView clientId={client.id} viewerTimeZone={viewerTimeZone} isAdmin={isAdmin} readOnly={archived} />}
      {tab === "portal" && <PortalTab clientId={client.id} archived={archived} viewerTimeZone={viewerTimeZone} />}
      {tab === "assets" && <AssetsPanel clientId={client.id} viewerTimeZone={viewerTimeZone} readOnly={archived} />}

      {tab !== "overview" ? null : editing && !archived ? (
        <ClientForm client={client} submitLabel="Save changes" onSubmit={handleSave} onCancel={() => setEditing(false)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader icon="🧑‍💼" iconTone="purple" title="Contact" subtitle="Who to talk to" />
            <CardBody className="flex flex-col gap-2.5">
              <Row label="Contact person" value={client.contactPerson} />
              <Row label="Phone" value={client.phone} />
              <Row label="Email" value={client.email} />
              <Row label="Website" value={client.website} />
              <Row label="Address" value={client.address} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon="📋" iconTone="amber" title="Contract" subtitle="Services and dates" />
            <CardBody className="flex flex-col gap-2.5">
              <Row label="Services" value={client.services.length ? client.services.join(", ") : null} />
              <Row label="Contract start" value={client.contractStart ? formatDateOnly(client.contractStart) : null} />
              <Row label="Contract end" value={client.contractEnd ? formatDateOnly(client.contractEnd) : null} />
              <Row label="Time zone" value={client.timeZone} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon="📱" iconTone="purple" title="Social media" subtitle="Handles" />
            <CardBody className="flex flex-col gap-2.5">
              {SOCIAL_PLATFORMS.filter((p) => client.socialHandles[p]).map((p) => (
                <Row key={p} label={SOCIAL_PLATFORM_LABELS[p]} value={client.socialHandles[p] ?? null} />
              ))}
              {Object.keys(client.socialHandles).length === 0 && <p className="text-sm text-text-muted">None added.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon="📝" iconTone="amber" title="Notes" subtitle="Internal only" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm text-text-primary">{client.notes || "No notes."}</p>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "overview" && !editing && (
        <div className="mt-5 flex flex-wrap gap-2">
          {archived ? (
            <Button disabled={busy} onClick={handleUnarchive}>
              <Icon name="refresh" size={16} /> Unarchive
            </Button>
          ) : (
            <>
              <Button onClick={() => setEditing(true)} disabled={busy}>
                <Icon name="edit" size={16} /> Edit client
              </Button>
              {isAdmin && (
                <Button variant="outline" disabled={busy} onClick={() => setReassignOpen(true)}>
                  <Icon name="users" size={16} /> Reassign owner
                </Button>
              )}
              <Button variant="danger" disabled={busy} onClick={handleArchive}>
                <Icon name="ban" size={16} /> Archive
              </Button>
            </>
          )}
        </div>
      )}

      {reassignOpen && (
        <ReassignModal
          client={client}
          onClose={() => setReassignOpen(false)}
          onDone={(saved) => {
            setClient(saved);
            setReassignOpen(false);
            showToast(`Reassigned to ${saved.ownerName}.`, "success");
          }}
          onError={(err) => showToast(describe(err, "Failed to reassign the client"), "error")}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="break-words text-right text-sm text-text-primary">{value || "—"}</span>
    </div>
  );
}

function ReassignModal({
  client,
  onClose,
  onDone,
  onError,
}: {
  client: Client;
  onClose: () => void;
  onDone: (client: Client) => void;
  onError: (err: unknown) => void;
}) {
  const [owners, setOwners] = useState<UserAccount[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState(client.ownerId);
  const [saving, setSaving] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    let cancelled = false;
    clientsApi
      .listOwnerCandidates()
      .then((o) => {
        if (!cancelled) setOwners(o);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load managers");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    setSaving(true);
    try {
      const { client: saved } = await clientsApi.reassign(client.id, ownerId, client.version);
      onDone(saved);
    } catch (err) {
      onError(err);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="reassign-title" initialFocusRef={selectRef} panelClassName="max-w-sm p-6">
      <h2 id="reassign-title" className="font-serif text-lg font-bold text-text-primary">
        Reassign {client.businessName}
      </h2>
      <p className="mt-1 text-xs text-text-muted">The new owner takes over the client and everything under it.</p>
      <div className="mt-4">
        <FieldLabel htmlFor="reassign-owner">New owner</FieldLabel>
        {loadError ? (
          <p className="text-sm text-error">{loadError}</p>
        ) : owners === null ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <Select id="reassign-owner" ref={selectRef} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.fullName}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="mt-5 flex gap-2">
        <Button onClick={submit} disabled={saving || !owners || ownerId === client.ownerId}>
          {saving ? "Reassigning…" : "Reassign"}
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
