"use client";

import { useEffect, useState } from "react";
import type { Approval } from "../../../lib/domain";
import { approvalsApi, type ApprovalView } from "../api/approvalsApi";
import { ApprovalRow } from "./ApprovalRow";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pager } from "../../../components/ui/Pager";
import { Segmented } from "../../../components/ui/Segmented";

const PAGE_SIZE = 20;
type Tab = Extract<ApprovalView, "to_decide" | "requested">;
const TABS: { id: Tab; label: string }[] = [
  { id: "to_decide", label: "To decide" },
  { id: "requested", label: "I requested" },
];

/** /app/approvals: pending requests the caller can decide, and the ones they asked for. Server-paged; Approve / Request changes inline. */
export function ApprovalsPageClient({ zone }: { zone: string }) {
  const [tab, setTab] = useState<Tab>("to_decide");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Approval[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      setLoading(true);
      approvalsApi
        .list({ view: tab, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
        .then((data) => {
          if (cancelled) return;
          setRows(data.approvals);
          setTotal(data.total);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load approvals");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [tab, page, reloadKey]);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="page-title">Approvals</h1>
        <p className="text-sm text-text-muted">Work that waits for a yes, and the approvals you asked for.</p>
      </header>

      <Segmented
        label="Approvals"
        options={TABS}
        value={tab}
        onChange={(next) => {
          setTab(next);
          setPage(0);
        }}
        className="mb-4 self-start max-sm:w-full"
        stretch
      />

      <div className="overflow-hidden rounded-app-lg bg-card shadow-app">
        {loading ? (
          <ul className="divide-y divide-border-light" aria-busy="true" aria-label="Loading approvals">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="space-y-2.5 px-5 py-4">
                <div className="skeleton h-5 w-48 rounded-app-sm" />
                <div className="skeleton h-4 w-3/4 rounded-app-sm" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="flex items-center justify-between gap-3 p-6 text-sm text-error">
            <span>{error}</span>
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="shield"
            title={tab === "to_decide" ? "Nothing waits for your approval." : "You haven't asked for any approvals."}
            description={tab === "to_decide" ? "When someone asks you to approve a stage, it shows up here." : "Request approval from a task or an event that is on an approval stage."}
          />
        ) : (
          <ul className="divide-y divide-border-light" aria-label={tab === "to_decide" ? "Approvals to decide" : "Approvals I requested"}>
            {rows.map((a) => (
              <ApprovalRow key={a.id} approval={a} zone={zone} onChanged={() => setReloadKey((k) => k + 1)} />
            ))}
          </ul>
        )}
        {!loading && !error && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
      </div>
    </div>
  );
}
