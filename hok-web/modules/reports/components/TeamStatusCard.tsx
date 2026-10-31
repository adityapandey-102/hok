"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader, CARD_GRID_CELL } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Field";
import { Icon } from "../../../components/ui/Icon";
import { LastSeen } from "../../../components/ui/LastSeen";
import { Pager } from "../../../components/ui/Pager";
import { Select } from "../../../components/ui/Select";
import { StatusPill } from "../../../components/ui/StatusPill";
import { ROLES, ROLE_LABELS, type Role } from "../../../lib/domain";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { reportsApi, type TeamStatus, type TeamStatusPage, type TeamStatusRow } from "../api/reportsApi";
import { windowPhrase } from "../lib/reportFormat";
import { Avatar, LoadError, SectionIntro, SkeletonRows, Spinner } from "./ReportParts";

const PAGE_SIZE = 20;
const STAFF_ROLES = ROLES.filter((r) => r !== "admin");

/**
 * Team status (FR-RPT-02): who is working and who is idle right now. The rule
 * is the API's and its window comes back with every answer, so the line that
 * explains it always matches what was used. Nothing is filtered in the
 * browser: search (debounced), role, status and the page all go to the API.
 */
export function TeamStatusCard() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<TeamStatus | "">("");
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const debounced = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const key = `${debounced}|${role}|${status}|${page}|${reloadKey}`;
  const [result, setResult] = useState<{ key: string; data?: TeamStatusPage; error?: string } | null>(null);
  const current = result?.key === key ? result : null;
  // Keep the last page on screen while the next one loads (no flash of empty).
  const data = current?.data ?? result?.data ?? null;
  const error = current?.error ?? null;
  const loading = !current;

  useEffect(() => {
    let cancelled = false;
    const forKey = `${debounced}|${role}|${status}|${page}|${reloadKey}`;
    reportsApi
      .teamStatus({ search: debounced || undefined, role: role || undefined, status: status || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((res) => !cancelled && setResult({ key: forKey, data: res }))
      .catch((e: unknown) => !cancelled && setResult({ key: forKey, error: e instanceof Error ? e.message : "Could not load team status." }));
    return () => {
      cancelled = true;
    };
  }, [debounced, role, status, page, reloadKey]);

  // Every filter change starts again at page 1, in the same handler as the change.
  const changeSearch = (v: string) => {
    setSearch(v);
    setPage(0);
  };
  const changeRole = (v: Role | "") => {
    setRole(v);
    setPage(0);
  };
  const changeStatus = (v: TeamStatus | "") => {
    setStatus(v);
    setPage(0);
  };
  const reload = () => setReloadKey((k) => k + 1);
  const filtered = Boolean(debounced || role || status);

  return (
    <div className="flex flex-col gap-4">
      <SectionIntro
        id="team-status-heading"
        title="Team status"
        description="Who is working and who is idle right now, with their open tasks."
        action={
          <Button variant="outline" onClick={reload} disabled={loading} className="px-3! py-2! text-xs">
            {loading && data ? <Spinner label="Refreshing" /> : <Icon name="refresh" size={14} />}
            Refresh
          </Button>
        }
      />

      {error && !data ? (
        <LoadError title="Couldn't load team status" message={error} onRetry={reload} />
      ) : !data ? (
        <SkeletonRows rows={6} />
      ) : (
        <>
          <p className="flex gap-2.5 rounded-app border border-border-light bg-card/70 px-4 py-3 text-xs leading-relaxed text-text-muted">
            <Icon name="clock" size={15} className="mt-px shrink-0 text-text-secondary" />
            <span>
              <span className="font-semibold text-text-secondary">Working</span> means they have open tasks and were seen or did something in HOK in the{" "}
              {windowPhrase(data.rule.windowHours)} (a task update, a stage move or another action). Everyone else is{" "}
              <span className="font-semibold text-text-secondary">Idle</span>.
            </span>
          </p>

          <Card regionLabel="Team members">
            <CardHeader
              icon={<Icon name="users" size={17} />}
              title="Team members"
              subtitle={`${data.total.toLocaleString("en-IN")} ${data.total === 1 ? "person" : "people"}${filtered ? " match these filters" : ""}`}
            />
            <div className="grid grid-cols-2 gap-2 border-b border-border-light p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:p-4">
              <div className="relative col-span-2 sm:col-span-1">
                <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
                <Input type="search" aria-label="Search staff by name" placeholder="Search by name" value={search} onChange={(e) => changeSearch(e.target.value)} className="pl-9" />
              </div>
              <Select aria-label="Filter by role" value={role} onChange={(e) => changeRole(e.target.value as Role | "")} className="sm:w-52">
                <option value="">All roles</option>
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
              <Select aria-label="Filter by status" value={status} onChange={(e) => changeStatus(e.target.value as TeamStatus | "")} className="sm:w-40">
                <option value="">Everyone</option>
                <option value="working">Working</option>
                <option value="idle">Idle</option>
              </Select>
            </div>

            {error && (
              <p role="alert" className="flex items-center justify-between gap-3 border-b border-error/20 bg-error-bg/40 px-4 py-2 text-sm text-error">
                <span>{error}</span>
                <button type="button" onClick={reload} className="font-semibold underline">
                  Retry
                </button>
              </p>
            )}

            {data.members.length === 0 ? (
              <EmptyState
                icon="users"
                title={filtered ? "No one matches" : "No active staff yet"}
                description={filtered ? "Try another name, or clear the role or status filter." : "Add staff on the Users page."}
              />
            ) : (
              <div className={`transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
                {/* Phones and tablets: one card per person (two across from md). */}
                <ul className="grid grid-cols-1 md:grid-cols-2 lg:hidden">
                  {data.members.map((m) => (
                    <li key={m.userId} className={`px-4 py-3.5 ${CARD_GRID_CELL}`}>
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} working={m.status === "working"} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-text-primary">{m.name}</p>
                          <p className="text-xs text-text-muted">{ROLE_LABELS[m.role]}</p>
                        </div>
                        <StateBadge row={m} />
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <LastSeen at={m.lastSeenAt} />
                        <span className="text-xs text-text-secondary">
                          {m.openTasks} open{m.overdue > 0 && <span className="text-error"> · {m.overdue} overdue</span>}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Desktop: a table. */}
                <table className="hidden w-full text-sm lg:table">
                  <thead className="bg-app-bg/60 text-left text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                    <tr>
                      <th className="px-5 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Open</th>
                      <th className="px-4 py-2.5 text-right">Overdue</th>
                      <th className="px-5 py-2.5">Last seen</th>
                    </tr>
                  </thead>
                  <tbody className="rows-in divide-y divide-border-light">
                    {data.members.map((m) => (
                      <tr key={m.userId} className="transition-colors hover:bg-accent-bg">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={m.name} working={m.status === "working"} />
                            <div className="min-w-0">
                              <p className="font-semibold text-text-primary">{m.name}</p>
                              <p className="text-xs text-text-muted">{ROLE_LABELS[m.role]}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StateBadge row={m} />
                        </td>
                        <td className="figure px-4 py-3 text-right text-base text-text-primary">{m.openTasks}</td>
                        <td className={`figure px-4 py-3 text-right text-base ${m.overdue > 0 ? "text-error" : "text-text-muted"}`}>{m.overdue}</td>
                        <td className="px-5 py-3">
                          <LastSeen at={m.lastSeenAt} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
          </Card>
        </>
      )}
    </div>
  );
}

function StateBadge({ row }: { row: TeamStatusRow }) {
  return <StatusPill label={row.status === "working" ? "Working" : "Idle"} tone={row.status === "working" ? "green" : "gray"} />;
}
