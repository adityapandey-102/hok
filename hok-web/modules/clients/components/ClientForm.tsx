"use client";

import { useState } from "react";
import {
  CLIENT_LIST_MAX,
  clientFormSchema,
  DEFAULT_TIME_ZONE,
  parseServices,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type Client,
  type SocialPlatform,
} from "../../../lib/domain";
import type { CreateClientPayload, UpdateClientPayload } from "../api/clientsApi";
import { clientsApi } from "../api/clientsApi";
import { TimeZoneInput } from "../../admin-users/components/TimeZoneInput";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Icon } from "../../../components/ui/Icon";
import { PhoneInput } from "../../../components/ui/PhoneInput";
import { Select, Textarea } from "../../../components/ui/Select";
import { SearchSelect } from "../../../components/ui/SearchSelect";

type TextKey = "businessName" | "logoUrl" | "industry" | "email" | "address" | "services" | "contractStart" | "contractEnd" | "timeZone" | "notes";

/** Rows carry a key so React keeps each input's focus when another row is removed. */
type Keyed<T> = T & { key: number };
interface ContactRow {
  name: string;
  phone: string;
  email: string;
}
interface SocialRow {
  platform: SocialPlatform;
  handle: string;
}

interface Values extends Record<TextKey, string> {
  status: "active" | "paused";
  ownerId: string;
  websites: Keyed<{ value: string }>[];
  phones: Keyed<{ value: string }>[];
  contacts: Keyed<ContactRow>[];
  socials: Keyed<SocialRow>[];
}

let nextKey = 1;
const keyed = <T,>(row: T): Keyed<T> => ({ ...row, key: nextKey++ });

function initialValues(c?: Client): Values {
  return {
    businessName: c?.businessName ?? "",
    logoUrl: c?.logoUrl ?? "",
    industry: c?.industry ?? "",
    email: c?.email ?? "",
    address: c?.address ?? "",
    services: c?.services.join(", ") ?? "",
    contractStart: c?.contractStart ?? "",
    contractEnd: c?.contractEnd ?? "",
    timeZone: c?.timeZone ?? DEFAULT_TIME_ZONE,
    notes: c?.notes ?? "",
    status: c?.status === "paused" ? "paused" : "active",
    ownerId: "",
    // A new client starts with one empty row of each, so the form reads like a form.
    websites: (c?.websites.length ? c.websites : [""]).map((value) => keyed({ value })),
    phones: (c?.phones.length ? c.phones : [""]).map((value) => keyed({ value })),
    contacts: (c?.contacts.length ? c.contacts : [{ name: "", phone: null, email: null }]).map((p) =>
      keyed({ name: p.name, phone: p.phone ?? "", email: p.email ?? "" }),
    ),
    socials: (c?.socialAccounts ?? []).map((a) => keyed({ platform: a.platform, handle: a.handle })),
  };
}

/**
 * Shared create/edit form. On create, blank optional fields are omitted; on edit
 * they are sent as null so they clear. Websites, phones, contact people and social
 * accounts are lists: add as many as needed (up to the API's caps), blank rows are
 * ignored. `canPickOwner` (Admin only, create) adds an owner picker that searches the API.
 * The caller does the HTTP call and returns an error message (or null on success).
 */
export function ClientForm({
  client,
  canPickOwner = false,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  client?: Client;
  canPickOwner?: boolean;
  submitLabel: string;
  onSubmit: (payload: CreateClientPayload | Omit<UpdateClientPayload, "version">) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const editing = !!client;
  const [v, setV] = useState<Values>(() => initialValues(client));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setV((s) => ({ ...s, [key]: value }));

  /** Edit one row of a list in place. */
  function patchRow<K extends "websites" | "phones" | "contacts" | "socials">(list: K, key: number, change: Partial<Values[K][number]>) {
    setV((s) => ({ ...s, [list]: (s[list] as Keyed<object>[]).map((r) => (r.key === key ? { ...r, ...change } : r)) }));
  }
  function removeRow(list: "websites" | "phones" | "contacts" | "socials", key: number) {
    setV((s) => ({ ...s, [list]: (s[list] as Keyed<object>[]).filter((r) => r.key !== key) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = clientFormSchema.safeParse(v);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    const contacts = v.contacts
      .map((c) => ({ name: c.name.trim(), phone: c.phone.trim() || null, email: c.email.trim() || null }))
      .filter((c) => c.name || c.phone || c.email);
    if (contacts.some((c) => !c.name)) {
      setError("Each contact person needs a name.");
      return;
    }
    const text = (s: string) => s.trim() || (editing ? null : undefined);

    const payload = {
      businessName: v.businessName.trim(),
      logoUrl: text(v.logoUrl),
      industry: text(v.industry),
      email: text(v.email),
      address: text(v.address),
      notes: text(v.notes),
      contractStart: text(v.contractStart),
      contractEnd: text(v.contractEnd),
      timeZone: v.timeZone.trim(),
      services: parseServices(v.services),
      websites: v.websites.map((w) => w.value.trim()).filter(Boolean),
      phones: v.phones.map((p) => p.value.trim()).filter(Boolean),
      contacts,
      socialAccounts: v.socials.map((a) => ({ platform: a.platform, handle: a.handle.trim() })).filter((a) => a.handle),
      ...(editing ? { status: v.status } : {}),
      ...(!editing && v.ownerId ? { ownerId: v.ownerId } : {}),
    };
    setSaving(true);
    const message = await onSubmit(payload);
    setSaving(false);
    if (message) setError(message);
  }

  const field = (id: string, label: string, key: TextKey, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} value={v[key]} onChange={(e) => set(key, e.target.value)} {...props} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-app-lg border border-border bg-card p-4 shadow-app sm:p-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel required htmlFor="cf-name">
            Business name
          </FieldLabel>
          <Input id="cf-name" value={v.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </div>
        {field("cf-industry", "Industry", "industry")}
        {field("cf-email", "Business email", "email", { type: "email" })}
        {field("cf-logo", "Logo URL", "logoUrl", { placeholder: "https://" })}
        {field("cf-address", "Address", "address")}
      </section>

      <ListSection
        title="Contact people"
        hint="Name required; phone and email optional."
        addLabel="Add contact person"
        canAdd={v.contacts.length < CLIENT_LIST_MAX.contacts}
        onAdd={() => set("contacts", [...v.contacts, keyed({ name: "", phone: "", email: "" })])}
      >
        {v.contacts.map((c, i) => (
          <Row key={c.key} label={`Contact person ${i + 1}`} onRemove={() => removeRow("contacts", c.key)}>
            <Input aria-label={`Contact ${i + 1} name`} placeholder="Name" value={c.name} onChange={(e) => patchRow("contacts", c.key, { name: e.target.value })} />
            <PhoneInput
              aria-label={`Contact ${i + 1} phone`}
              placeholder="Mobile (optional)"
              value={c.phone}
              onChange={(phone) => patchRow("contacts", c.key, { phone })}
            />
            <Input
              aria-label={`Contact ${i + 1} email`}
              placeholder="Email (optional)"
              type="email"
              value={c.email}
              onChange={(e) => patchRow("contacts", c.key, { email: e.target.value })}
            />
          </Row>
        ))}
      </ListSection>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ListSection
          title="Phone numbers"
          hint="The business's own numbers."
          addLabel="Add phone number"
          canAdd={v.phones.length < CLIENT_LIST_MAX.phones}
          onAdd={() => set("phones", [...v.phones, keyed({ value: "" })])}
        >
          {v.phones.map((p, i) => (
            <Row key={p.key} label={`Phone ${i + 1}`} onRemove={() => removeRow("phones", p.key)}>
              <PhoneInput aria-label={`Phone ${i + 1}`} placeholder="98200 11111" value={p.value} onChange={(value) => patchRow("phones", p.key, { value })} />
            </Row>
          ))}
        </ListSection>

        <ListSection
          title="Websites"
          addLabel="Add website"
          canAdd={v.websites.length < CLIENT_LIST_MAX.websites}
          onAdd={() => set("websites", [...v.websites, keyed({ value: "" })])}
        >
          {v.websites.map((w, i) => (
            <Row key={w.key} label={`Website ${i + 1}`} onRemove={() => removeRow("websites", w.key)}>
              <Input aria-label={`Website ${i + 1}`} placeholder="acme.com" value={w.value} onChange={(e) => patchRow("websites", w.key, { value: e.target.value })} />
            </Row>
          ))}
        </ListSection>
      </div>

      <ListSection
        title="Social media accounts"
        hint="Pick the platform, then the handle or profile link. Add several for the same platform if needed."
        addLabel="Add account"
        canAdd={v.socials.length < CLIENT_LIST_MAX.socialAccounts}
        onAdd={() => set("socials", [...v.socials, keyed({ platform: "instagram", handle: "" })])}
      >
        {v.socials.map((a, i) => (
          <Row key={a.key} label={`Social account ${i + 1}`} onRemove={() => removeRow("socials", a.key)}>
            <Select
              aria-label={`Account ${i + 1} platform`}
              value={a.platform}
              onChange={(e) => patchRow("socials", a.key, { platform: e.target.value as SocialPlatform })}
            >
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {SOCIAL_PLATFORM_LABELS[p]}
                </option>
              ))}
            </Select>
            <Input
              aria-label={`Account ${i + 1} handle`}
              placeholder="@handle or https:// link"
              value={a.handle}
              onChange={(e) => patchRow("socials", a.key, { handle: e.target.value })}
              className="sm:col-span-2"
            />
          </Row>
        ))}
      </ListSection>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <FieldLabel htmlFor="cf-tz">Time zone</FieldLabel>
          <TimeZoneInput id="cf-tz" value={v.timeZone} onChange={(z) => set("timeZone", z)} />
        </div>
        {field("cf-start", "Contract start", "contractStart", { type: "date" })}
        {field("cf-end", "Contract end", "contractEnd", { type: "date" })}
        <div className="sm:col-span-3">
          {field("cf-services", "Services subscribed (comma separated)", "services", {
            placeholder: "Social media management, Monthly shoot",
          })}
        </div>
        {editing && (
          <div>
            <FieldLabel htmlFor="cf-status">Status</FieldLabel>
            <Select id="cf-status" value={v.status} onChange={(e) => set("status", e.target.value as "active" | "paused")}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </Select>
          </div>
        )}
        {!editing && canPickOwner && (
          <div>
            <FieldLabel htmlFor="cf-owner">Lead</FieldLabel>
            <SearchSelect
              id="cf-owner"
              placeholder="Me"
              value={v.ownerId || null}
              clearable
              load={clientsApi.searchOwnerOptions}
              onChange={(id) => set("ownerId", id ?? "")}
            />
          </div>
        )}
      </section>

      <div>
        <FieldLabel htmlFor="cf-notes">Notes</FieldLabel>
        <Textarea id="cf-notes" rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      <div>
        <FieldError>{error}</FieldError>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : submitLabel}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

/** A titled list of rows with an "Add …" button; the button disappears at the list's cap. */
function ListSection({
  title,
  hint,
  addLabel,
  canAdd,
  onAdd,
  children,
}: {
  title: string;
  hint?: string;
  addLabel: string;
  canAdd: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2 className="text-xs font-semibold text-text-secondary">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}
      <div className="mt-2 flex flex-col gap-2">{children}</div>
      {canAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 inline-flex items-center gap-1.5 rounded-app px-2 py-1.5 text-sm font-medium text-text-secondary hover:bg-accent-bg hover:text-text-primary"
        >
          <Icon name="plus" size={15} /> {addLabel}
        </button>
      )}
    </section>
  );
}

/** One row: its inputs side by side (stacked on phones) and a remove button. */
function Row({ label, onRemove, children }: { label: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-flow-col sm:auto-cols-fr">{children}</div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label.toLowerCase()}`}
        className="mt-1.5 rounded-app p-1.5 text-text-muted hover:bg-accent-bg hover:text-error"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
