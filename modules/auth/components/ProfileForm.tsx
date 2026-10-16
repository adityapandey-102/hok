"use client";

import { useState } from "react";
import { updateOwnProfileSchema, type Profile } from "../../../lib/domain";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
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

  return (
    <form onSubmit={handleSubmit} className="max-w-md rounded-app-lg border border-border bg-card p-5 shadow-app">
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
          <Input id="pf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="pf-tz">Time zone</FieldLabel>
          <TimeZoneInput id="pf-tz" value={timeZone} onChange={setTimeZone} />
        </div>
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" disabled={saving} className="mt-4">
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
