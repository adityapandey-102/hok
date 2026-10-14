"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isApiErrorCode } from "../../../lib/api/client";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { DEFAULT_TIME_ZONE, ROLE_LABELS, ROLES, inviteUserSchema, type Role } from "../../../lib/domain";
import { usersApi, type UserAccount } from "../api/usersApi";
import { Button, ButtonLink } from "../../../components/ui/Button";
import { Pager } from "../../../components/ui/Pager";
import { Icon } from "../../../components/ui/Icon";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { useToast } from "../../../components/ui/Toast";
import { TimeZoneInput } from "./TimeZoneInput";
import { CredentialRevealOverlay, type RevealModal } from "./CredentialRevealOverlay";

const PAGE_SIZE = 20;

/**
 * User-management dashboard: server-paginated, searchable staff directory.
 * Each row links to the user's detail page, where all account actions
 * (password, QR, activate/deactivate, ID-card export) now live -- this screen
 * is just create + find + navigate.
 */
export default function UserManagementClient() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  // Only TYPING is debounced; paging and reloads fetch immediately.
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("social_media_manager");
  const [phone, setPhone] = useState("");
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [reveal, setReveal] = useState<RevealModal | null>(null);

  function changeRoleFilter(value: Role | "") {
    setRoleFilter(value);
    setPage(0);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setPage(0);
  }

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      setLoading(true);
      usersApi
        .list({ search: debouncedSearch || undefined, role: roleFilter || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
        .then((data) => {
          if (!cancelled) {
            setUsers(data.users);
            setTotal(data.total);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load users");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, roleFilter, page, reloadKey]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const parsed = inviteUserSchema.safeParse({ fullName, email, role });
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setCreating(true);
    try {
      const result = await usersApi.create({
        ...parsed.data,
        timeZone: timeZone.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setReveal({ name: fullName, password: result.password });
      setFullName("");
      setEmail("");
      setRole("social_media_manager");
      setPhone("");
      setTimeZone(DEFAULT_TIME_ZONE);
      setCreateOpen(false);
      showToast(`Account created for ${fullName}.`, "success");
      setReloadKey((k) => k + 1);
    } catch (err) {
      const message = isApiErrorCode(err, "USER_EMAIL_TAKEN")
        ? "An account with this email already exists."
        : err instanceof Error
          ? err.message
          : "Failed to create account";
      setCreateError(message);
      showToast(message, "error");
    } finally {
      setCreating(false);
    }
  }


  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="text-sm text-text-muted">Create staff accounts and manage roles. Admin only.</p>
        </div>
        <Button className="max-sm:w-full" onClick={() => setCreateOpen((v) => !v)}>
          {createOpen ? (
            "Cancel"
          ) : (
            <>
              <Icon name="user" size={16} /> Create account
            </>
          )}
        </Button>
      </div>

      {createOpen && (
        <form onSubmit={handleCreate} className="mb-6 rounded-app-lg border border-border bg-card p-5 shadow-app">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <FieldLabel required htmlFor="new-user-name">Full name</FieldLabel>
              <Input id="new-user-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <FieldLabel required htmlFor="new-user-email">Email</FieldLabel>
              <Input id="new-user-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <FieldLabel required htmlFor="new-user-role">Role</FieldLabel>
              <select
                id="new-user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-app-sm border border-border bg-card px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <FieldLabel htmlFor="new-user-phone">Phone (optional)</FieldLabel>
              <Input id="new-user-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="new-user-tz">Time zone</FieldLabel>
              <TimeZoneInput id="new-user-tz" value={timeZone} onChange={setTimeZone} />
            </div>
          </div>
          <p className="mt-3 text-xs text-text-muted">
            A password is generated automatically -- you&apos;ll see it once after creating the account, so make sure you&apos;re ready to note it down.
          </p>
          <FieldError>{createError}</FieldError>
          <Button type="submit" disabled={creating} className="mt-3">
            {creating ? "Creating…" : "Create account"}
          </Button>
        </form>
      )}

      <div className="mb-3 flex flex-wrap gap-3">
        <select
          aria-label="Filter by role"
          value={roleFilter}
          onChange={(e) => changeRoleFilter(e.target.value as Role | "")}
          className="rounded-app-sm border border-border bg-card px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <Input
          className="max-w-sm"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-app-lg border border-border bg-card shadow-app">
        {loading ? (
          <div className="p-6 text-sm text-text-muted">Loading…</div>
        ) : error ? (
          <div className="flex items-center justify-between gap-3 p-6 text-sm text-error">
            <span>{error}</span>
            <button onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline">
              Retry
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="p-6 text-sm text-text-muted">
            {search.trim() || roleFilter ? "No staff match your filters." : "No staff accounts yet."}
          </div>
        ) : (
          <>
            {/* Mobile / tablet: stacked cards — the whole card links to the
                user's detail page, so "Manage" is always reachable (a 5-column
                table squeezes the action off-screen on a phone). */}
            <ul className="divide-y divide-border-light lg:hidden">
              {users.map((u, i) => (
                <li key={u.id}>
                  <Link
                    href={`/app/admin/users/${u.id}`}
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                    className="group animate-fade-in flex items-center gap-3 p-4 transition-colors hover:bg-primary-bg/30 active:bg-primary-bg/50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-bg text-xs font-bold text-primary ring-1 ring-inset ring-primary/10">
                      {u.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-text-primary">{u.fullName}</div>
                      <div className="truncate text-xs text-text-muted">{u.email}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-primary-bg px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/10">
                          {ROLE_LABELS[u.role]}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                            u.active ? "bg-success text-white ring-success" : "bg-gray-pill-bg text-text-secondary ring-black/5"
                          }`}
                        >
                          {u.active ? "Active" : "Deactivated"}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-app border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-primary shadow-app">
                      Manage
                      <Icon name="chevron-right" size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Desktop: full table */}
            <div className="relative hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-primary-bg/70 text-left text-xs font-semibold text-primary/85">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="rows-in">
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border-light last:border-0 hover:bg-primary-bg/20">
                      <td className="px-4 py-2.5 font-medium text-text-primary">{u.fullName}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{u.email}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{ROLE_LABELS[u.role]}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            u.active ? "bg-success font-medium text-white" : "bg-gray-pill-bg text-text-secondary"
                          }`}
                        >
                          {u.active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ButtonLink href={`/app/admin/users/${u.id}`} variant="outline" className="px-3 py-1.5 text-xs">
                          Manage
                          <Icon name="chevron-right" size={14} />
                        </ButtonLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && !error && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
      </div>

      {reveal && <CredentialRevealOverlay reveal={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}
