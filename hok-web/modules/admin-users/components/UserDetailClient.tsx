"use client";

import { useState } from "react";
import { formatDate, isValidTimeZone, ROLE_LABELS, ROLES, type Role, lastSeen } from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { usersApi, type UserAccount } from "../api/usersApi";
import Link from "next/link";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Icon } from "../../../components/ui/Icon";
import { Panel } from "../../../components/ui/Panel";
import { StatusPill } from "../../../components/ui/StatusPill";
import { FieldLabel, Input } from "../../../components/ui/Field";
import { PhoneInput } from "../../../components/ui/PhoneInput";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { CredentialRevealOverlay, type RevealModal } from "./CredentialRevealOverlay";
import { TimeZoneInput } from "./TimeZoneInput";

function errorMessage(err: unknown, fallback: string): string {
  if (isApiErrorCode(err, "USER_CANNOT_CHANGE_OWN_ROLE")) return "You cannot change your own role.";
  if (isApiErrorCode(err, "USER_CANNOT_DEACTIVATE_SELF")) return "You cannot deactivate your own account.";
  if (isApiErrorCode(err, "USER_PASSWORD_SELF_MANAGED")) return "This account manages its own password.";
  return err instanceof Error ? err.message : fallback;
}

export function UserDetailClient({ initialUser, currentUserId }: { initialUser: UserAccount; currentUserId: string }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [user, setUser] = useState<UserAccount>(initialUser);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<RevealModal | null>(null);
  const [fullName, setFullName] = useState(initialUser.fullName);
  const [phone, setPhone] = useState(initialUser.phone ?? "");
  const [timeZone, setTimeZone] = useState(initialUser.timeZone);

  const isSelf = user.id === currentUserId;

  /** Re-pull the account after a mutation so status and role badges stay accurate. */
  async function refresh() {
    try {
      const { user: fresh } = await usersApi.get(user.id);
      setUser(fresh);
    } catch {
      // Non-fatal: the mutation already succeeded; a manual reload will resync.
    }
  }

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      showToast(errorMessage(err, fallback), "error");
    } finally {
      setBusy(false);
    }
  }

  const handleRoleChange = (role: Role) =>
    run(async () => {
      await usersApi.update(user.id, { role });
      showToast("Role updated.", "success");
      await refresh();
    }, "Failed to update role");

  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return showToast("Please enter a full name.", "error");
    if (!isValidTimeZone(timeZone.trim())) return showToast("Enter a valid time zone, e.g. Asia/Kolkata.", "error");
    return run(async () => {
      await usersApi.update(user.id, { fullName: fullName.trim(), phone: phone.trim() || null, timeZone: timeZone.trim() });
      showToast("Details saved.", "success");
      await refresh();
    }, "Failed to save details");
  };

  async function handleGeneratePassword() {
    const ok = await confirm({
      title: `Generate a new password for ${user.fullName}?`,
      body: "Their current password stops working immediately.",
      confirmLabel: "Generate",
    });
    if (!ok) return;
    await run(async () => {
      const result = await usersApi.generatePassword(user.id);
      setReveal({ name: user.fullName, password: result.password });
    }, "Failed to generate password");
  }

  async function handleDeactivate() {
    const ok = await confirm({
      title: "Deactivate this account?",
      body: "They will immediately lose access.",
      confirmLabel: "Deactivate",
      danger: true,
    });
    if (!ok) return;
    await run(async () => {
      await usersApi.deactivate(user.id);
      showToast("Account deactivated.", "success");
      await refresh();
    }, "Failed to deactivate account");
  }

  const handleReactivate = () =>
    run(async () => {
      await usersApi.reactivate(user.id);
      showToast("Account reactivated.", "success");
      await refresh();
    }, "Failed to reactivate account");

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <Link href="/app/admin/users" className="mb-3 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary">
          <Icon name="chevron-right" size={14} className="rotate-180" /> All users
        </Link>
        <div className="flex items-center gap-4">
          <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink font-serif text-lg text-on-ink">
            {user.fullName
              .split(" ")
              .map((p) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="page-title break-words">{user.fullName}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <StatusPill label={ROLE_LABELS[user.role]} tone="pink" />
              <StatusPill label={user.active ? "Active" : "Deactivated"} tone={user.active ? "green" : "gray"} />
              <span className="break-all">{user.email}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel icon="user" title="Account info" subtitle="Identity and activity">
          <div className="p-5">
            <form onSubmit={handleSaveDetails} className="flex flex-col gap-3.5">
              <div>
                <FieldLabel htmlFor="ud-name">Full name</FieldLabel>
                <Input id="ud-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <InfoRow label="Email" value={user.email} />
              <div>
                <FieldLabel htmlFor="ud-phone">Phone</FieldLabel>
                <PhoneInput id="ud-phone" value={phone} onChange={setPhone} />
              </div>
              <div>
                <FieldLabel htmlFor="ud-tz">Time zone</FieldLabel>
                <TimeZoneInput id="ud-tz" value={timeZone} onChange={setTimeZone} />
              </div>
              <Button type="submit" variant="outline" disabled={busy}>
                Save details
              </Button>
              <div className="mt-1 flex items-center justify-between border-t border-border-light pt-3.5">
                <span className="text-xs text-text-muted">Status</span>
                <StatusPill label={user.active ? "Active" : "Deactivated"} tone={user.active ? "green" : "gray"} />
              </div>
              <InfoRow label="Created" value={formatDate(user.createdAt)} />
              <InfoRow label="Last login" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"} />
              <InfoRow label="Last seen" value={lastSeen(user.lastSeenAt).text} />
            </form>
          </div>
        </Panel>

        <Panel icon="shield" title="Account actions" subtitle="Role, credentials, and access">
          <div className="flex flex-col gap-4 p-5">
            <div>
              <FieldLabel htmlFor="ud-role">Role</FieldLabel>
              <Select id="ud-role" value={user.role} disabled={!user.active || busy || isSelf} onChange={(e) => handleRoleChange(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
              {isSelf && <p className="mt-1 text-[11px] text-text-muted">You cannot change your own role.</p>}
            </div>

            {user.active ? (
              <div className="flex flex-col gap-2">
                <Button variant="outline" disabled={busy || isSelf} onClick={handleGeneratePassword}>
                  <Icon name="key" size={16} /> Generate new password
                </Button>
                <Button
                  variant="danger"
                  disabled={busy || isSelf}
                  onClick={handleDeactivate}
                  title={isSelf ? "You cannot deactivate your own account" : undefined}
                >
                  <Icon name="ban" size={16} /> Deactivate account
                </Button>
                {isSelf && <p className="text-[11px] text-text-muted">Manage your own password and details from your profile.</p>}
              </div>
            ) : (
              <Button disabled={busy} onClick={handleReactivate}>
                <Icon name="check" size={16} /> Reactivate account
              </Button>
            )}
          </div>
        </Panel>
      </div>

      {reveal && <CredentialRevealOverlay reveal={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}
