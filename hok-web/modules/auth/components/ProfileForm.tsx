"use client";

import { useState } from "react";
import { updateOwnProfileSchema, type Profile } from "../../../lib/domain";
import { Panel } from "../../../components/ui/Panel";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { PhoneInput } from "../../../components/ui/PhoneInput";
import { useToast } from "../../../components/ui/Toast";
import { TimeZoneInput } from "../../admin-users/components/TimeZoneInput";
import { authApi } from "../api/authApi";

/** Own-profile edit: name, phone and time zone via PATCH /auth/me. */
export function ProfileForm({ profile }: { profile: Profile }) {
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [timeZone, setTimeZone] = useState(profile.timeZone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = updateOwnProfileSchema.safeParse({ fullName, phone, timeZone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setSaving(true);
    try {
      await authApi.updateOwnProfile({ ...parsed.data, phone: parsed.data.phone || null });
      showToast("Profile saved.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      setError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  const initials = profile.fullName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Panel icon="user" title="Your details" subtitle="Shown to your team">
      <form onSubmit={handleSubmit} className="p-5">
        <div className="mb-5 flex items-center gap-3.5 rounded-app-lg bg-accent-bg p-3.5 ring-1 ring-border-light ring-inset">
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink font-serif text-base text-on-ink">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-text-primary">{profile.fullName}</p>
            <p className="truncate text-xs text-text-muted">{profile.email}</p>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel htmlFor="pf-name">Full name</FieldLabel>
            <Input id="pf-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="pf-email">Email</FieldLabel>
            <Input id="pf-email" value={profile.email} disabled readOnly />
          </div>
          <div>
            <FieldLabel htmlFor="pf-phone">Phone</FieldLabel>
            <PhoneInput id="pf-phone" value={phone} onChange={setPhone} />
          </div>
          <div>
            <FieldLabel htmlFor="pf-tz">Time zone</FieldLabel>
            <TimeZoneInput id="pf-tz" value={timeZone} onChange={setTimeZone} />
          </div>
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" disabled={saving} className="mt-5 max-sm:w-full">
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </Panel>
  );
}
