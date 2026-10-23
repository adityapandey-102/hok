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
import { ButtonLink } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Field";
import { Select } from "../../../components/ui/Select";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { FilterToggle } from "../../../components/ui/FilterToggle";
import { Pager } from "../../../components/ui/Pager";
import { StatusPill, type PillTone } from "../../../components/ui/StatusPill";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Panel } from "../../../components/ui/Panel";
import { ClientAvatar } from "./ClientAvatar";

const PAGE_SIZE = 20;

export const STATUS_TONES: Record<ClientStatus, PillTone> = { active: "green", paused: "amber", archived: "gray" };

/**
 * Clients list (FR-CLI-03/04): server-paged, debounced search, status filter.
 * Archived clients only show when the status filter says so. Admin also gets a
 * "team member" filter and the lead's name (`isAdmin`); the API scopes everyone
 * else to the clients whose team they're on.
 */
export function ClientsListClient({ isAdmin }: { isAdmin: boolean }) {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState<ClientStatus | "">("");
  const [ownerId, setOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
  // Exact status counts only when the whole result fits on this page (no extra API call).
  const wholeListLoaded = !loading && !error && total > 0 && total <= PAGE_SIZE;
  const counts = wholeListLoaded
    ? CLIENT_STATUSES.map((s) => ({ s, n: clients.filter((c) => c.status === s).length })).filter((x) => x.n > 0)
    : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Clients</h1>
          <p className="text-sm text-text-muted">
            {isAdmin ? "Every client in the agency." : "The clients you own."}
            {!loading && !error && ` ${total.toLocaleString("en-IN")} ${total === 1 ? "client" : "clients"}${filtered ? " match" : ""}.`}
          </p>
        </div>
        <div className="page-actions">
          <ButtonLink href="/app/clients/new">
            <Icon name="plus" size={16} /> New client
          </ButtonLink>
        </div>
      </header>

      <Panel
        icon="briefcase"
        title={status ? `${CLIENT_STATUS_LABELS[status]} clients` : "All clients"}
        subtitle={status ? "Filtered by status" : "Active and paused, newest first"}
        action={
          counts.length > 0 ? (
            <div className="hidden items-center gap-1.5 sm:flex" aria-label="Clients by status">
              {counts.map(({ s, n }) => (
                <StatusPill key={s} label={`${n} ${CLIENT_STATUS_LABELS[s].toLowerCase()}`} tone={STATUS_TONES[s]} />
              ))}
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-2 border-b border-border-light px-4 py-3 sm:flex-row sm:flex-wrap sm:px-5">
          <Input
            className="sm:max-w-xs sm:flex-1"
            placeholder="Search by business, contact or industry"
            aria-label="Search clients"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          <FilterToggle active={[status, ownerId].filter(Boolean).length}>
          <Select
            className="sm:w-auto"
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
            <SearchSelect
              className="sm:w-56"
              aria-label="Filter by team member"
              placeholder="Anyone on the team"
              value={ownerId || null}
              clearable
              load={clientsApi.searchOwnerOptions}
              onChange={(id) => {
                setOwnerId(id ?? "");
                setPage(0);
              }}
            />
          )}
          </FilterToggle>
        </div>

        {loading ? (
          <ul className="divide-y divide-border-light" aria-busy="true" aria-label="Loading clients">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <div className="skeleton h-10 w-10 shrink-0 rounded-app" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-1/3 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
                <div className="skeleton h-5 w-16 rounded-app-sm" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="flex items-center justify-between gap-3 p-6 text-sm text-error">
            <span>{error}</span>
            <button onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline">
              Retry
            </button>
          </div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon="briefcase"
            title={filtered ? "No clients match your filters." : "No clients yet."}
            description={filtered ? "Try a different search or status." : "Create your first one."}
            action={
              filtered ? undefined : (
                <ButtonLink href="/app/clients/new">
                  <Icon name="plus" size={16} /> New client
                </ButtonLink>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border-light">
            {clients.map((c, i) => (
              <li key={c.id}>
                <Link
                  href={`/app/clients/${c.id}`}
                  style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                  className="group animate-fade-in flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent-bg sm:gap-4 sm:px-5"
                >
                  <ClientAvatar name={c.businessName} logoUrl={c.logoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-text-primary">{c.businessName}</div>
                    <div className="truncate text-xs text-text-muted">
                      {[c.industry, c.contactPerson].filter(Boolean).join(" · ") || "No details yet"}
                    </div>
                    {isAdmin && (
                      <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-text-muted">
                        <Icon name="user" size={11} className="shrink-0" />
                        <span className="truncate">Lead: {c.ownerName}</span>
                      </div>
                    )}
                  </div>
                  {c.contractEnd && (
                    <div className="hidden shrink-0 text-right text-xs text-text-muted md:block">
                      <span className="block">Contract ends</span>
                      <span className="font-medium text-text-secondary">{formatDateOnly(c.contractEnd)}</span>
                    </div>
                  )}
                  <StatusPill label={CLIENT_STATUS_LABELS[c.status]} tone={STATUS_TONES[c.status]} />
                  <Icon name="chevron-right" size={14} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
      </Panel>
    </div>
  );
}
