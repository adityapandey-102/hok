"use client";

import { useState } from "react";
import {
  clientFormSchema,
  DEFAULT_TIME_ZONE,
  parseServices,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type Client,
  type SocialHandles,
} from "../../../lib/domain";
import type { CreateClientPayload, UpdateClientPayload } from "../api/clientsApi";
import type { UserAccount } from "../../admin-users/api/usersApi";
import { TimeZoneInput } from "../../admin-users/components/TimeZoneInput";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Select, Textarea } from "../../../components/ui/Select";

type TextKey =
  | "businessName"
  | "logoUrl"
  | "industry"
  | "contactPerson"
  | "phone"
  | "email"
  | "address"
  | "website"
  | "services"
  | "contractStart"
  | "contractEnd"
  | "timeZone"
  | "notes";

interface Values extends Record<TextKey, string> {
  status: "active" | "paused";
  ownerId: string;
  handles: Record<string, string>;
}

function initialValues(c?: Client): Values {
  return {
    businessName: c?.businessName ?? "",
    logoUrl: c?.logoUrl ?? "",
    industry: c?.industry ?? "",
    contactPerson: c?.contactPerson ?? "",
    phone: c?.phone ?? "",
    email: c?.email ?? "",
    address: c?.address ?? "",
    website: c?.website ?? "",
    services: c?.services.join(", ") ?? "",
    contractStart: c?.contractStart ?? "",
    contractEnd: c?.contractEnd ?? "",
    timeZone: c?.timeZone ?? DEFAULT_TIME_ZONE,
    notes: c?.notes ?? "",
    status: c?.status === "paused" ? "paused" : "active",
    ownerId: "",
    handles: { ...(c?.socialHandles ?? {}) },
  };
}

/**
 * Shared create/edit form. On create, blank optional fields are omitted; on edit
 * they are sent as null so they clear. `owners` (Admin only, create) adds an owner picker.
 * The caller does the HTTP call and returns an error message (or null on success).
 */
export function ClientForm({
  client,
  owners,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  client?: Client;
  owners?: UserAccount[];
  submitLabel: string;
  onSubmit: (payload: CreateClientPayload | Omit<UpdateClientPayload, "version">) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const editing = !!client;
  const [v, setV] = useState<Values>(() => initialValues(client));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setV((s) => ({ ...s, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = clientFormSchema.safeParse(v);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    const text = (s: string) => s.trim() || (editing ? null : undefined);
    const socialHandles: SocialHandles = {};
    for (const p of SOCIAL_PLATFORMS) if (v.handles[p]?.trim()) socialHandles[p] = v.handles[p].trim();

    const payload = {
      businessName: v.businessName.trim(),
      logoUrl: text(v.logoUrl),
      industry: text(v.industry),
      contactPerson: text(v.contactPerson),
      phone: text(v.phone),
      email: text(v.email),
      address: text(v.address),
      website: text(v.website),
      notes: text(v.notes),
      contractStart: text(v.contractStart),
      contractEnd: text(v.contractEnd),
      timeZone: v.timeZone.trim(),
      services: parseServices(v.services),
      socialHandles,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-app-lg border border-border bg-card p-5 shadow-app">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel required htmlFor="cf-name">
            Business name
          </FieldLabel>
          <Input id="cf-name" value={v.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </div>
        {field("cf-industry", "Industry", "industry")}
        {field("cf-contact", "Contact person", "contactPerson")}
        {field("cf-phone", "Phone", "phone")}
        {field("cf-email", "Email", "email", { type: "email" })}
        {field("cf-website", "Website", "website", { placeholder: "https://" })}
        {field("cf-logo", "Logo URL", "logoUrl", { placeholder: "https://" })}
        <div className="sm:col-span-2">{field("cf-address", "Address", "address")}</div>
      </section>

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
        {!editing && owners && owners.length > 0 && (
          <div>
            <FieldLabel htmlFor="cf-owner">Owner</FieldLabel>
            <Select id="cf-owner" value={v.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
              <option value="">Me</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName}
                </option>
              ))}
            </Select>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold text-text-secondary">Social media handles</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SOCIAL_PLATFORMS.map((p) => (
            <div key={p}>
              <FieldLabel htmlFor={`cf-social-${p}`}>{SOCIAL_PLATFORM_LABELS[p]}</FieldLabel>
              <Input
                id={`cf-social-${p}`}
                value={v.handles[p] ?? ""}
                onChange={(e) => set("handles", { ...v.handles, [p]: e.target.value })}
                placeholder="@handle"
              />
            </div>
          ))}
        </div>
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
