"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  formatDateOnly,
  type ClientStatus,
  type ClientSummary,
} from "../../../lib/domain";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { clientsApi } from "../api/clientsApi";
import type { UserAccount } from "../../admin-users/api/usersApi";
import { ButtonLink } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Field";
import { Select } from "../../../components/ui/Select";
import { Pager } from "../../../components/ui/Pager";
import { StatusPill, type PillTone } from "../../../components/ui/StatusPill";

const PAGE_SIZE = 20;

export const STATUS_TONES: Record<ClientStatus, PillTone> = { active: "green", paused: "amber", archived: "gray" };

/**
 * Clients list (FR-CLI-03/04): server-paged, debounced search, status filter.
 * Archived clients only show when the status filter says so. Admin also gets an
 * owner filter and column (`isAdmin`); the API scopes everyone else to their own.
 */
export function ClientsListClient({ isAdmin }: { isAdmin: boolean }) {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState<ClientStatus | "">("");
  const [ownerId, setOwnerId] = useState("");
  const [owners, setOwners] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    clientsApi
      .listOwnerCandidates()
      .then((o) => {
        if (!cancelled) setOwners(o);
      })
      .catch(() => {
        // The owner filter is a convenience; the list still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      setLoading(true);
      clientsApi
      .list({
        search: debouncedSearch || undefined,
        status: status || undefined,
        ownerId: ownerId || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      .then((data) => {
        if (cancelled) return;
        setClients(data.clients);
        setTotal(data.total);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load clients");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, status, ownerId, page, reloadKey]);

  const filtered = !!(search.trim() || status || ownerId);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="text-sm text-text-muted">
            {isAdmin ? "Every client in the agency." : "The clients you own."}
          </p>
        </div>
        <ButtonLink href="/app/clients/new" className="max-sm:w-full">
          <Icon name="plus" size={16} /> New client
        </ButtonLink>
      </div>

      <div className="mb-3 flex flex-wrap gap-3">
        <Input
          className="max-w-sm"
          placeholder="Search by business, contact or industry"
          aria-label="Search clients"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <Select
          className="w-auto"
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ClientStatus | "");
            setPage(0);
          }}
        >
          <option value="">Active and paused</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CLIENT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        {isAdmin && (
          <Select
            className="w-auto"
            aria-label="Filter by owner"
            value={ownerId}
            onChange={(e) => {
              setOwnerId(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All owners</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.fullName}
              </option>
            ))}
          </Select>
        )}
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
        ) : clients.length === 0 ? (
          <div className="p-6 text-sm text-text-muted">
            {filtered ? "No clients match your filters." : "No clients yet. Create your first one."}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border-light">
              {clients.map((c, i) => (
                <li key={c.id}>
                  <Link
                    href={`/app/clients/${c.id}`}
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                    className="group animate-fade-in flex items-center gap-3 p-4 transition-colors hover:bg-primary-bg/30"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-bg text-xs font-bold text-primary ring-1 ring-inset ring-primary/10">
                      {c.businessName
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-text-primary">{c.businessName}</div>
                      <div className="truncate text-xs text-text-muted">
                        {[c.industry, c.contactPerson].filter(Boolean).join(" · ") || "No details yet"}
                        {isAdmin && ` · Owner: ${c.ownerName}`}
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right text-xs text-text-muted sm:block">
                      {c.contractEnd ? `Contract ends ${formatDateOnly(c.contractEnd)}` : null}
                    </div>
                    <StatusPill label={CLIENT_STATUS_LABELS[c.status]} tone={STATUS_TONES[c.status]} />
                    <Icon name="chevron-right" size={14} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        {!loading && !error && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
      </div>
    </div>
  );
}
