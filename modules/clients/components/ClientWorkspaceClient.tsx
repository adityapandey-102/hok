"use client";

import { useState } from "react";
import {
  CLIENT_STATUS_LABELS,
  formatDateOnly,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type Client,
} from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { clientsApi, type CreateClientPayload, type UpdateClientPayload } from "../api/clientsApi";
import { Button, ButtonLink } from "../../../components/ui/Button";
import { Icon, type IconName } from "../../../components/ui/Icon";
import { Panel } from "../../../components/ui/Panel";
import { FieldLabel } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { ClientForm } from "./ClientForm";
import { EventsTab } from "../../events/components/EventsTab";
import { CalendarView } from "../../calendar/components/CalendarView";
import { AssetsPanel } from "../../assets/components/AssetsPanel";
import { PortalTab } from "../../portal/components/PortalTab";
import { STATUS_TONES } from "./ClientsListClient";
import { ClientAvatar } from "./ClientAvatar";

const TABS = [
  { id: "overview", icon: "home" },
  { id: "events", icon: "layers" },
  { id: "calendar", icon: "calendar" },
  { id: "assets", icon: "image" },
  { id: "portal", icon: "share" },
] as const satisfies readonly { id: string; icon: IconName }[];

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

  const facts = [
    client.industry ? { icon: "briefcase" as IconName, text: client.industry } : null,
    { icon: "user" as IconName, text: `Owner: ${client.ownerName}` },
    { icon: "clock" as IconName, text: client.timeZone },
    client.contractEnd ? { icon: "calendar" as IconName, text: `Contract ends ${formatDateOnly(client.contractEnd)}` } : null,
  ].filter((x): x is { icon: IconName; text: string } => x !== null);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <section aria-label="Client" className="relative overflow-hidden rounded-app-xl border border-border bg-card shadow-app">
        <div aria-hidden className="h-1.5 bg-ink" />
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-6">
          <ClientAvatar name={client.businessName} logoUrl={client.logoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <h1 className="page-title break-words">{client.businessName}</h1>
              <span className="mt-2.5 lg:mt-3.5"><StatusPill label={CLIENT_STATUS_LABELS[client.status]} tone={STATUS_TONES[client.status]} /></span>
            </div>
            <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-text-secondary">
              {facts.map((f) => (
                <li key={f.text} className="flex min-w-0 items-center gap-1.5">
                  <Icon name={f.icon} size={14} className="shrink-0 text-text-muted" />
                  <span className="truncate">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <ButtonLink href="/app/clients" variant="outline" className="self-start max-sm:w-full">
            <Icon name="chevron-right" size={15} className="rotate-180" /> All clients
          </ButtonLink>
        </div>
      </section>

      {conflict && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-app border border-error/30 bg-error-bg p-3 text-sm text-error">
          <span>Someone else changed this client while you were editing.</span>
          <Button variant="outline" onClick={reload}>
            Reload latest
          </Button>
        </div>
      )}

      {archived && (
        <div className="flex items-center gap-2 rounded-app border border-border bg-gray-pill-bg p-3 text-sm text-text-secondary">
          <Icon name="lock" size={15} className="shrink-0" /> This client is archived and read-only. Unarchive it to make changes.
        </div>
      )}

      <div role="tablist" aria-label="Client workspace" className="-mb-1 flex max-w-full gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
        {TABS.map(({ id, icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap capitalize transition-colors sm:px-4 ${tab === id ? "border-primary text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"}`}
          >
            <Icon name={icon} size={15} className={tab === id ? "text-primary" : ""} />
            {id}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-fade-in">
        {tab === "events" && <EventsTab clientId={client.id} viewerTimeZone={viewerTimeZone} readOnly={archived} />}
        {tab === "calendar" && <CalendarView clientId={client.id} viewerTimeZone={viewerTimeZone} isAdmin={isAdmin} readOnly={archived} />}
        {tab === "portal" && <PortalTab clientId={client.id} archived={archived} viewerTimeZone={viewerTimeZone} />}
        {tab === "assets" && <AssetsPanel clientId={client.id} viewerTimeZone={viewerTimeZone} readOnly={archived} />}

        {tab !== "overview" ? null : editing && !archived ? (
          <ClientForm client={client} submitLabel="Save changes" onSubmit={handleSave} onCancel={() => setEditing(false)} />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Panel icon="user" title="Contact" subtitle="Who to talk to">
                <dl className="divide-y divide-border-light border-t border-border-light">
                  <Row label="Contact person" value={client.contactPerson} />
                  <Row label="Phone" value={client.phone} href={client.phone ? `tel:${client.phone}` : undefined} />
                  <Row label="Email" value={client.email} href={client.email ? `mailto:${client.email}` : undefined} />
                  <Row label="Website" value={client.website} />
                  <Row label="Address" value={client.address} />
                </dl>
              </Panel>

              <Panel icon="clipboard" title="Contract" subtitle="Services and dates">
                <dl className="divide-y divide-border-light border-t border-border-light">
                  <Row label="Services" value={client.services.length ? client.services.join(", ") : null} />
                  <Row label="Contract start" value={client.contractStart ? formatDateOnly(client.contractStart) : null} />
                  <Row label="Contract end" value={client.contractEnd ? formatDateOnly(client.contractEnd) : null} />
                  <Row label="Time zone" value={client.timeZone} />
                </dl>
              </Panel>

              <Panel icon="share" title="Social media" subtitle="Handles">
                <dl className="divide-y divide-border-light border-t border-border-light">
                  {SOCIAL_PLATFORMS.filter((p) => client.socialHandles[p]).map((p) => (
                    <Row key={p} label={SOCIAL_PLATFORM_LABELS[p]} value={client.socialHandles[p] ?? null} />
                  ))}
                </dl>
                {Object.keys(client.socialHandles).length === 0 && <p className="border-t border-border-light px-5 py-4 text-sm text-text-muted">None added.</p>}
              </Panel>

              <Panel icon="edit" title="Notes" subtitle="Internal only">
                <p className="border-t border-border-light px-5 py-4 text-sm break-words whitespace-pre-wrap text-text-primary">{client.notes || "No notes."}</p>
              </Panel>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
          </div>
        )}
      </div>

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

function Row({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3 transition-colors hover:bg-accent-bg/60">
      <dt className="shrink-0 text-xs text-text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm break-words text-text-primary">
        {value && href ? (
          <a href={href} className="underline-offset-2 hover:text-primary hover:underline">
            {value}
          </a>
        ) : (
          value || <span className="text-text-muted">—</span>
        )}
      </dd>
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
  const [ownerId, setOwnerId] = useState(client.ownerId);
  const [saving, setSaving] = useState(false);

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
    <Modal open onClose={onClose} labelledBy="reassign-title" panelClassName="max-w-sm p-6">
      <h2 id="reassign-title" className="font-serif text-lg font-bold text-text-primary">
        Reassign {client.businessName}
      </h2>
      <p className="mt-1 text-xs text-text-muted">The new owner takes over the client and everything under it.</p>
      <div className="mt-4">
        <FieldLabel htmlFor="reassign-owner">New owner</FieldLabel>
        <SearchSelect
          id="reassign-owner"
          placeholder="Search managers…"
          value={ownerId}
          selectedLabel={client.ownerName}
          load={clientsApi.searchOwnerOptions}
          onChange={(id) => id && setOwnerId(id)}
        />
      </div>
      <div className="mt-5 flex gap-2">
        <Button onClick={submit} disabled={saving || ownerId === client.ownerId}>
          {saving ? "Reassigning…" : "Reassign"}
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
