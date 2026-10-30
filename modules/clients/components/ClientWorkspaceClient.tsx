"use client";

import { useState } from "react";
import {
  CLIENT_STATUS_LABELS,
  CLIENT_TEAM_MAX,
  formatDateOnly,
  isClientManager,
  ROLE_LABELS,
  SOCIAL_PLATFORM_LABELS,
  timeZoneLabel,
  type Client,
  type ClientTeamMember,
} from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { clientsApi, type CreateClientPayload, type UpdateClientPayload } from "../api/clientsApi";
import Link from "next/link";
import { Button } from "../../../components/ui/Button";
import { Icon, type IconName } from "../../../components/ui/Icon";
import { Panel } from "../../../components/ui/Panel";
import { FieldLabel } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { StatusPill } from "../../../components/ui/StatusPill";
import { Segmented, type SegmentOption } from "../../../components/ui/Segmented";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { ClientForm } from "./ClientForm";
import { EventsTab } from "../../events/components/EventsTab";
import { CalendarView } from "../../calendar/components/CalendarView";
import { AssetsPanel } from "../../assets/components/AssetsPanel";
import { ClientTodosPanel } from "../../client-todos/components/ClientTodosPanel";
import { PortalTab } from "../../portal/components/PortalTab";
import { STATUS_TONES } from "./ClientsListClient";
import { ClientAvatar } from "./ClientAvatar";
import { useInBrowser } from "../../../lib/hooks/useInBrowser";

/** A tab's text is its id (capitalised by CSS) unless it has a `label` (shown as written). */
const TABS = [
  { id: "overview", icon: "home", label: "Overview" },
  { id: "events", icon: "layers", label: "Events" },
  { id: "calendar", icon: "calendar", label: "Calendar" },
  { id: "todos", icon: "check-circle", label: "To-dos" },
  { id: "assets", icon: "image", label: "Assets" },
  { id: "portal", icon: "share", label: "Portal" },
] as const satisfies readonly SegmentOption<string>[];
type TabId = (typeof TABS)[number]["id"];

/** True for a tab id this page has (the `?tab=` link parameter). */
export function isWorkspaceTab(value: string): value is TabId {
  return TABS.some((t) => t.id === value);
}

/**
 * The client workspace (FR-CLI-06): Overview, Events, Calendar, To-dos
 * (Phase 2, FR-CTSK), Assets and Portal -- each tab added by the milestone
 * that built it (no placeholder tabs).
 */
export function ClientWorkspaceClient({
  initialClient,
  isAdmin,
  viewerTimeZone = "Asia/Kolkata",
  initialTab = "overview",
  viewerId,
}: {
  initialClient: Client;
  isAdmin: boolean;
  /** The signed-in person: the client's lead (or the Admin) manages its portal link. */
  viewerId: string;
  viewerTimeZone?: string;
  /** From the `?tab=` link parameter. */
  initialTab?: TabId;
}) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [client, setClient] = useState<Client>(initialClient);
  const tzLabel = timeZoneLabel(client.timeZone, undefined, useInBrowser());
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  const archived = client.status === "archived";
  const hasContact = client.contacts.length + client.phones.length + client.websites.length > 0 || !!client.email || !!client.address;

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
    { icon: "user" as IconName, text: `Lead: ${client.ownerName}` },
    client.team.length > 1 ? { icon: "users" as IconName, text: `Team of ${client.team.length}` } : null,
    { icon: "clock" as IconName, text: tzLabel },
    client.contractEnd ? { icon: "calendar" as IconName, text: `Contract ends ${formatDateOnly(client.contractEnd)}` } : null,
  ].filter((x): x is { icon: IconName; text: string } => x !== null);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header aria-label="Client" className="flex flex-col gap-4">
        <Link
          href="/app/clients"
          className="-ml-1 inline-flex w-fit items-center gap-0.5 rounded-app-sm px-1 text-[15px] font-medium text-primary hover:opacity-75 focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none"
        >
          <Icon name="chevron-left" size={17} /> Clients
        </Link>
        <div className="flex items-start gap-4 sm:gap-5">
          <ClientAvatar name={client.businessName} logoUrl={client.logoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="page-title break-words">{client.businessName}</h1>
            <ul className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px] text-text-secondary">
              <li>
                <StatusPill label={CLIENT_STATUS_LABELS[client.status]} tone={STATUS_TONES[client.status]} />
              </li>
              {facts.map((f) => (
                <li key={f.text} className="flex min-w-0 items-center gap-1.5">
                  <Icon name={f.icon} size={15} className="shrink-0 text-text-muted" />
                  <span className="truncate">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
          {!archived && !editing && (
            <Button variant="outline" className="shrink-0 max-sm:hidden" onClick={() => setEditing(true)}>
              <Icon name="edit" size={17} /> Edit client
            </Button>
          )}
        </div>
        {!archived && !editing && (
          <Button variant="outline" className="sm:hidden" onClick={() => setEditing(true)}>
            <Icon name="edit" size={17} /> Edit client
          </Button>
        )}
      </header>

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

      <Segmented options={TABS} value={tab} onChange={setTab} label="Client workspace" />

      <div key={tab} className="animate-fade-in">
        {tab === "events" && <EventsTab clientId={client.id} viewerTimeZone={viewerTimeZone} readOnly={archived} />}
        {tab === "calendar" && <CalendarView clientId={client.id} viewerTimeZone={viewerTimeZone} isAdmin={isAdmin} readOnly={archived} />}
        {tab === "portal" && (
          <PortalTab
            clientId={client.id}
            archived={archived}
            viewerTimeZone={viewerTimeZone}
            canManage={isAdmin || client.ownerId === viewerId}
            leadName={client.ownerName}
          />
        )}
        {tab === "assets" && <AssetsPanel clientId={client.id} viewerTimeZone={viewerTimeZone} readOnly={archived} />}
        {tab === "todos" && <ClientTodosPanel clientId={client.id} viewerTimeZone={viewerTimeZone} readOnly={archived} />}

        {tab !== "overview" ? null : editing && !archived ? (
          <ClientForm client={client} submitLabel="Save changes" onSubmit={handleSave} onCancel={() => setEditing(false)} />
        ) : (
          <div className="flex flex-col gap-7">
            {archived && isAdmin && (
              <Button className="w-fit" disabled={busy} onClick={handleUnarchive}>
                <Icon name="refresh" size={17} /> Unarchive client
              </Button>
            )}

            <div className="grid grid-cols-1 items-start gap-x-6 gap-y-7 lg:grid-cols-2">
              <Panel title="Contact">
                {hasContact ? (
                  <dl className="inset-rows">
                    {client.contacts.map((c, i) => (
                      <div key={`c${i}`} className="flex items-baseline justify-between gap-4 px-5 py-3">
                        <dt className="min-w-0 truncate text-[15px] text-text-primary">{c.name}</dt>
                        <dd className="flex min-w-0 flex-col items-end text-right text-[15px] break-words text-text-secondary">
                          {c.phone && <TapLink href={`tel:${c.phone}`}>{c.phone}</TapLink>}
                          {c.email && <TapLink href={`mailto:${c.email}`}>{c.email}</TapLink>}
                        </dd>
                      </div>
                    ))}
                    {client.phones.map((p, i) => (
                      <Row key={`p${i}`} label={i === 0 ? "Phone" : ""} value={p} href={`tel:${p}`} />
                    ))}
                    {client.email && <Row label="Email" value={client.email} href={`mailto:${client.email}`} />}
                    {client.websites.map((w, i) => (
                      <Row key={`w${i}`} label={i === 0 ? "Website" : ""} value={w.replace(/^https?:\/\//, "")} href={w} external />
                    ))}
                    {client.address && <Row label="Address" value={client.address} />}
                  </dl>
                ) : (
                  <EmptyRow text="No contact details yet." />
                )}
              </Panel>

              <Panel title="Contract">
                <dl className="inset-rows">
                  {client.services.length > 0 && <Row label="Services" value={client.services.join(", ")} />}
                  {client.contractStart && <Row label="Starts" value={formatDateOnly(client.contractStart)} />}
                  {client.contractEnd && <Row label="Ends" value={formatDateOnly(client.contractEnd)} />}
                  <Row label="Time zone" value={tzLabel} />
                </dl>
              </Panel>

              <Panel title="Social media">
                {client.socialAccounts.length > 0 ? (
                  <dl className="inset-rows">
                    {client.socialAccounts.map((a, i) => (
                      <Row
                        key={i}
                        label={SOCIAL_PLATFORM_LABELS[a.platform]}
                        value={a.handle}
                        href={/^https?:\/\//.test(a.handle) ? a.handle : undefined}
                        external
                      />
                    ))}
                  </dl>
                ) : (
                  <EmptyRow text="No accounts added." />
                )}
              </Panel>

              <Panel title="Team" action={isAdmin && <EditLink label="Edit team" onClick={() => setTeamOpen(true)} />}>
                <ul className="inset-rows">
                  {client.team.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="min-w-0 truncate text-[15px] text-text-primary">{m.fullName}</span>
                      <span className="flex shrink-0 items-center gap-2 text-[13px] text-text-muted">
                        {ROLE_LABELS[m.role]}
                        {!canWorkOnClients(m) && <StatusPill label="Inactive" tone="red" />}
                        {m.isLead && <StatusPill label="Lead" tone="gold" />}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Notes" subtitle="Only HOK staff see these">
                {client.notes ? (
                  <p className="px-5 py-3.5 text-[15px] break-words whitespace-pre-wrap text-text-primary">{client.notes}</p>
                ) : (
                  <EmptyRow text="No notes." />
                )}
              </Panel>
            </div>

            {archived && !isAdmin && <p className="text-sm text-text-muted">This client is archived. Ask the Admin to unarchive it.</p>}
            {!archived && isAdmin && (
              <div className="overflow-hidden rounded-app-lg bg-card shadow-app">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleArchive}
                  className="w-full px-5 py-3 text-left text-[15px] font-medium text-error transition-colors hover:bg-error-bg/60 disabled:opacity-50"
                >
                  Archive client
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {teamOpen && (
        <TeamModal
          client={client}
          onClose={() => setTeamOpen(false)}
          onDone={(saved) => {
            setClient(saved);
            setTeamOpen(false);
            showToast("Team saved.", "success");
          }}
          onError={(err) => showToast(describe(err, "Failed to save the team"), "error")}
        />
      )}
    </div>
  );
}

/** A list row: the label on the left, its value on the right (a tap target when it's a link). Only rows with a value are drawn. */
function Row({ label, value, href, external = false }: { label: string; value: string; href?: string; external?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className="shrink-0 text-[15px] text-text-primary">{label}</dt>
      <dd className="min-w-0 text-right text-[15px] break-words text-text-secondary">
        {href ? (
          <TapLink href={href} external={external}>
            {value}
          </TapLink>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

/** A phone number, email or site: tinted, so it reads as tappable. */
function TapLink({ href, external = false, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="text-primary hover:underline">
      {children}
    </a>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-5 py-3.5 text-[15px] text-text-muted">{text}</p>;
}

/** The "Edit" link at the right of a section heading, as in iOS. */
function EditLink({ label = "Edit", onClick }: { label?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-app-sm text-[14px] font-medium text-primary hover:opacity-75 focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none">
      {label}
    </button>
  );
}

type TeamRow = Pick<ClientTeamMember, "id" | "fullName" | "role" | "active">;

/** Deactivated, or moved to a task-only role: can stay listed, but can't lead or be added. */
const canWorkOnClients = (m: TeamRow) => m.active && isClientManager(m.role);

/** Admin: who works on the client, and which of them leads it (FR-CLI-05, client teams). */
function TeamModal({
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
  const [members, setMembers] = useState<TeamRow[]>(client.team.map(({ id, fullName, role, active }) => ({ id, fullName, role, active })));
  const [leadId, setLeadId] = useState(client.ownerId);
  const [saving, setSaving] = useState(false);
  const unchanged =
    leadId === client.ownerId && members.length === client.team.length && members.every((m) => client.team.some((t) => t.id === m.id));

  async function submit() {
    setSaving(true);
    try {
      const { client: saved } = await clientsApi.setTeam(client.id, { leadId, memberIds: members.map((m) => m.id), version: client.version });
      onDone(saved);
    } catch (err) {
      onError(err);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="team-title" panelClassName="sm:max-w-md p-6">
      <h2 id="team-title" className="font-serif text-lg font-bold text-text-primary">
        Team for {client.businessName}
      </h2>
      <p className="mt-1 text-xs text-text-muted">Everyone here sees and works on this client. The lead also manages its portal link.</p>

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs font-medium text-text-secondary">Members (pick the lead)</legend>
        <ul className="flex flex-col gap-1.5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-app border border-border-light px-3 py-2 text-sm">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input type="radio" name="team-lead" checked={leadId === m.id} disabled={!canWorkOnClients(m)} onChange={() => setLeadId(m.id)} aria-label={`Make ${m.fullName} the lead`} />
                <span className="min-w-0 truncate text-text-primary">{m.fullName}</span>
                <span className="shrink-0 text-xs text-text-muted">{ROLE_LABELS[m.role]}</span>
                {!canWorkOnClients(m) && <StatusPill label="Inactive" tone="red" />}
              </label>
              <button
                type="button"
                onClick={() => setMembers(members.filter((x) => x.id !== m.id))}
                disabled={m.id === leadId}
                title={m.id === leadId ? "Pick another lead first" : undefined}
                aria-label={`Remove ${m.fullName}`}
                className="rounded-app p-1 text-text-muted hover:bg-accent-bg hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="x" size={15} />
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      {members.length < CLIENT_TEAM_MAX && (
        <div className="mt-3">
          <FieldLabel htmlFor="team-add">Add someone</FieldLabel>
          <SearchSelect
            id="team-add"
            placeholder="Search managers…"
            value={null}
            clearOnSelect
            excludeIds={members.map((m) => m.id)}
            load={clientsApi.searchOwnerOptions}
            onChange={(id, item) => {
              if (id && item?.data) setMembers([...members, { id, fullName: item.data.fullName, role: item.data.role, active: true }]);
            }}
          />
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <Button onClick={submit} disabled={saving || unchanged}>
          {saving ? "Saving…" : "Save team"}
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
