"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Field";
import { Pager } from "../../../components/ui/Pager";
import { Select } from "../../../components/ui/Select";
import { ROLES, ROLE_LABELS, type Role } from "../../../lib/domain";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { dashboardApi, type TeamWorkloadPage } from "../api/dashboardApi";
import { WorkloadBar } from "./widgets";

const PAGE_SIZE = 20;
const STAFF_ROLES = ROLES.filter((r) => r !== "admin");

/**
 * /app/team (Admin): everyone's workload, busiest first. Name search
 * (debounced), role filter and paging all happen in the API; nothing is
 * loaded in full or filtered in the browser.
 */
export function TeamWorkloadClient() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const debounced = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const key = `${debounced}|${role}|${page}|${reload}`;
  const [result, setResult] = useState<{ key: string; data?: TeamWorkloadPage; error?: string } | null>(null);
  const current = result?.key === key ? result : null;
  // Keep the last page on screen while the next one loads (no flash of empty).
  const shown = current?.data ?? result?.data ?? null;

  useEffect(() => {
    let cancelled = false;
    const forKey = `${debounced}|${role}|${page}|${reload}`;
    dashboardApi
      .team({ search: debounced || undefined, role: role || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((data) => !cancelled && setResult({ key: forKey, data }))
      .catch((e: unknown) => !cancelled && setResult({ key: forKey, error: e instanceof Error ? e.message : "Could not load the team." }));
    return () => {
      cancelled = true;
    };
  }, [debounced, role, page, reload]);

  const max = Math.max(1, ...(shown?.members.map((m) => m.open) ?? [1]));
  const filtered = debounced !== "" || role !== "";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="page-title">Team workload</h1>
        <p className="text-sm text-text-muted">Open, overdue and recently finished tasks for everyone on the team, busiest first.</p>
      </header>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border-light p-4 sm:flex-row sm:items-center">
          <Input
            type="search"
            aria-label="Search people"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="sm:max-w-xs"
          />
          <Select
            aria-label="Filter by role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role | "");
              setPage(0);
            }}
            className="sm:w-52"
          >
            <option value="">Every role</option>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          {shown && <p className="text-xs text-text-muted sm:ml-auto">{shown.total.toLocaleString("en-IN")} people</p>}
        </div>

        {current?.error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
            <p role="alert" className="text-error">
              {current.error}
            </p>
            <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
              Try again
            </Button>
          </div>
        ) : !shown ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-12 rounded-app" />
            ))}
          </div>
        ) : shown.members.length === 0 ? (
          <EmptyState icon="users" title={filtered ? "No one matches" : "No active staff yet"} description={filtered ? "Try another name or role." : undefined} />
        ) : (
          <>
            {/* Tablets and up: a table. */}
            <table className="hidden w-full text-sm sm:table">
              <thead>
                <tr className="border-b border-border-light text-left text-xs text-text-muted">
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Load</th>
                  <th className="px-3 py-2.5 text-right font-medium">Open</th>
                  <th className="px-3 py-2.5 text-right font-medium">Overdue</th>
                  <th className="px-5 py-2.5 text-right font-medium">Done this week</th>
                </tr>
              </thead>
              <tbody className={`rows-in divide-y divide-border-light ${current ? "" : "opacity-60"}`}>
                {shown.members.map((m) => (
                  <tr key={m.userId} className="transition-colors hover:bg-accent-bg">
                    <td className="px-5 py-3">
                      <Link href={`/app/tasks?assigneeId=${m.userId}&assignee=${encodeURIComponent(m.name)}`} className="font-medium text-text-primary hover:text-primary">
                        {m.name}
                      </Link>
                      <span className="block text-xs text-text-muted">{ROLE_LABELS[m.role]}</span>
                    </td>
                    <td className="w-[30%] px-3 py-3">
                      <WorkloadBar row={m} max={max} />
                    </td>
                    <td className="figure px-3 py-3 text-right text-text-primary">{m.open}</td>
                    <td className={`figure px-3 py-3 text-right ${m.overdue > 0 ? "text-error" : "text-text-muted"}`}>{m.overdue}</td>
                    <td className="figure px-5 py-3 text-right text-text-secondary">{m.doneThisWeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Phones: one card per person. */}
            <ul className={`divide-y divide-border-light sm:hidden ${current ? "" : "opacity-60"}`}>
              {shown.members.map((m) => (
                <li key={m.userId}>
                  <Link href={`/app/tasks?assigneeId=${m.userId}&assignee=${encodeURIComponent(m.name)}`} className="block px-4 py-3">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium text-text-primary">{m.name}</span>
                      <span className="shrink-0 text-xs text-text-muted">{ROLE_LABELS[m.role]}</span>
                    </span>
                    <span className="mt-2 flex items-center gap-3">
                      <WorkloadBar row={m} max={max} />
                      <span className="shrink-0 text-xs text-text-secondary">
                        {m.open} open{m.overdue > 0 && <span className="text-error"> · {m.overdue} overdue</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-border-light px-4 py-3">
              <Pager page={page} pageSize={PAGE_SIZE} total={shown.total} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
