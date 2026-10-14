"use client";

import { useState } from "react";
import { formatDate, isValidTimeZone, ROLE_LABELS, ROLES, type Role } from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { usersApi, type UserAccount } from "../api/usersApi";
import { Button, ButtonLink } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { FieldLabel, Input } from "../../../components/ui/Field";
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{user.fullName}</h1>
          <p className="text-sm text-text-muted">
            {ROLE_LABELS[user.role]} · {user.email}
          </p>
        </div>
        <ButtonLink href="/app/admin/users" variant="outline">
          <Icon name="chevron-right" size={15} className="rotate-180" /> All Users
        </ButtonLink>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon="👤" iconTone="purple" title="Account Info" subtitle="Identity and activity" />
          <CardBody>
            <form onSubmit={handleSaveDetails} className="flex flex-col gap-3">
              <div>
                <FieldLabel htmlFor="ud-name">Full name</FieldLabel>
                <Input id="ud-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <InfoRow label="Email" value={user.email} />
              <div>
                <FieldLabel htmlFor="ud-phone">Phone</FieldLabel>
                <Input id="ud-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <FieldLabel htmlFor="ud-tz">Time zone</FieldLabel>
                <TimeZoneInput id="ud-tz" value={timeZone} onChange={setTimeZone} />
              </div>
              <Button type="submit" variant="outline" disabled={busy}>
                Save details
              </Button>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-text-muted">Status</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    user.active ? "bg-success font-medium text-white" : "bg-gray-pill-bg text-text-secondary"
                  }`}
                >
                  {user.active ? "Active" : "Deactivated"}
                </span>
              </div>
              <InfoRow label="Created" value={formatDate(user.createdAt)} />
              <InfoRow label="Last login" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"} />
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon="🛠️" iconTone="amber" title="Account Actions" subtitle="Role, credentials, and access" />
          <CardBody className="flex flex-col gap-4">
            <div>
              <label htmlFor="ud-role" className="mb-1 block text-xs text-text-muted">
                Role
              </label>
              <select
                id="ud-role"
                value={user.role}
                disabled={!user.active || busy || isSelf}
                onChange={(e) => handleRoleChange(e.target.value as Role)}
                className="w-full rounded-app-sm border border-border bg-card px-3 py-2 text-sm disabled:opacity-50"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
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
          </CardBody>
        </Card>
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
