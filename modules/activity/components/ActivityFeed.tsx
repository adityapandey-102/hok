"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Icon } from "../../../components/ui/Icon";
import { Pager } from "../../../components/ui/Pager";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { todayKey } from "../../../lib/domain";
import { usersApi } from "../../admin-users/api/usersApi";
import { ACTIVITY_KINDS, activityApi, type ActivityFilterKind, type ActivityPage } from "../api/activityApi";
import { KIND_ICONS, KIND_LABELS, dayHeading, exactTime, groupByDay, initials, rangeChips, rangeInstants, relativeTime, type RangeKey } from "../format";

const PAGE_SIZE = 50;

const noopSubscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
const serverZone = () => null;

/**
 * The activity log (FR-SYS-02 / FR-RPT-05, Admin): who did what, newest first.
 * Day chips (the viewer's days), kind tabs and a person filter all go to the
 * API, which pages 50 at a time. Used by /app/activity and the Reports page's
 * "Daily activity" tab. `timeZone` is the viewer's zone (defaults to the browser's).
 */
export function ActivityFeed({ defaultRange = "week", timeZone }: { defaultRange?: "today" | "week"; timeZone?: string }) {
  // null on the server and during hydration, the browser zone after (no setState in an effect).
  const clientZone = useSyncExternalStore(noopSubscribe, browserZone, serverZone);
  const zone = timeZone ?? clientZone;
  const today = useMemo(() => (zone ? todayKey(zone) : null), [zone]);

  const [range, setRange] = useState<RangeKey | null>(null);
  const [kind, setKind] = useState<ActivityFilterKind>("all");
  const [actor, setActor] = useState<{ id: string; label: string } | null>(null);
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);

  const activeRange: RangeKey | null = range ?? (today ? (defaultRange === "today" ? today : "week") : null);
  const instants = useMemo(() => (zone && today && activeRange ? rangeInstants(activeRange, today, zone) : null), [zone, today, activeRange]);

  const key = instants ? `${instants.from}|${kind}|${actor?.id ?? ""}|${page}|${reload}` : "";
  const [result, setResult] = useState<{ key: string; data?: ActivityPage; error?: string } | null>(null);
  const current = result?.key === key ? result : null;
  // Keep the last page on screen while the next one loads (no flash of empty).
  const shown = current?.data ?? result?.data ?? null;

  useEffect(() => {
    if (!instants) return;
    let cancelled = false;
    const forKey = key;
    activityApi
      .list({ ...instants, kind, actorId: actor?.id, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((data) => !cancelled && setResult({ key: forKey, data }))
      .catch((e: unknown) => !cancelled && setResult({ key: forKey, error: e instanceof Error ? e.message : "Could not load the activity log." }));
    return () => {
      cancelled = true;
    };
    // `key` is derived from every input below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const chips = today ? rangeChips(today) : [];
  const filtered = kind !== "all" || actor !== null;
  const groups = shown && zone ? groupByDay(shown.items, zone) : [];

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Day" className="flex flex-wrap gap-2">
        {chips.length === 0
          ? [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-8 w-20 rounded-full" />)
          : chips.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={activeRange === c.key}
                onClick={() => {
                  setRange(c.key);
                  setPage(0);
                }}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  activeRange === c.key ? "border-ink bg-ink text-on-ink" : "border-border bg-card text-text-secondary hover:bg-accent-bg hover:text-text-primary"
                }`}
              >
                {c.label}
              </button>
            ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Kind of activity" className="flex flex-wrap gap-0.5 rounded-app border border-border bg-card p-0.5 shadow-app sm:inline-flex">
          {ACTIVITY_KINDS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setPage(0);
              }}
              className={`rounded-app-sm px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors sm:px-4 ${
                kind === k ? "bg-ink text-on-ink" : "text-text-secondary hover:bg-accent-bg hover:text-text-primary"
              }`}
            >
              {k === "all" ? "All" : KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <SearchSelect
          className="lg:ml-auto lg:w-64"
          aria-label="Filter by person"
          placeholder="Everyone"
          value={actor?.id ?? null}
          selectedLabel={actor?.label}
          clearable
          load={(s) => usersApi.searchOptions(s)}
          onChange={(id, item) => {
            setActor(id ? { id, label: item?.label ?? "" } : null);
            setPage(0);
          }}
        />
      </div>

      <Card className="overflow-hidden">
        {current?.error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
            <p role="alert" className="text-error">
              {current.error}
            </p>
            <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
              Try again
            </Button>
          </div>
        ) : !shown || !zone || !today ? (
          <ul className="divide-y divide-border-light" aria-busy="true" aria-label="Loading activity">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="flex gap-3 px-4 py-3.5">
                <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-3/4 rounded-app-sm" />
                  <div className="skeleton h-3 w-1/4 rounded-app-sm" />
                </div>
              </li>
            ))}
          </ul>
        ) : shown.items.length === 0 ? (
          <EmptyState
            icon="history"
            title={filtered ? "Nothing matches" : "Nothing happened in this period"}
            description={filtered ? "Try another kind or person, or a wider range of days." : "Pick another day or Last 7 days."}
          />
        ) : (
          <>
            <div className={current ? "" : "opacity-60"}>
              {groups.map((g) => (
                <section key={g.day} aria-label={dayHeading(g.day, today)}>
                  <h2 className="sticky top-0 z-[1] border-b border-border-light bg-accent-bg px-4 py-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
                    {dayHeading(g.day, today)}
                  </h2>
                  <ul className="rows-in divide-y divide-border-light">
                    {g.items.map((it) => {
                      const text = <span className="text-sm leading-snug break-words text-text-primary">{it.summary}</span>;
                      return (
                        <li key={it.id} data-testid="activity-row">
                          <div className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent-bg">
                            <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-bg text-text-secondary ring-1 ring-border ring-inset">
                              <Icon name={KIND_ICONS[it.kind]} size={16} />
                            </span>
                            <div className="min-w-0 flex-1">
                              {it.url ? (
                                <Link href={it.url} className="block hover:text-primary [&>span]:hover:text-primary">
                                  {text}
                                </Link>
                              ) : (
                                text
                              )}
                              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                                {it.actor && (
                                  <span
                                    title={it.actor.name}
                                    aria-label={it.actor.name}
                                    className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[9px] font-semibold text-on-ink"
                                  >
                                    {initials(it.actor.name)}
                                  </span>
                                )}
                                <span>{KIND_LABELS[it.kind]}</span>
                                <span aria-hidden>·</span>
                                <time dateTime={it.at} title={exactTime(it.at, zone)}>
                                  {relativeTime(it.at, Date.now(), zone)}
                                </time>
                              </p>
                            </div>
                            {it.url && <Icon name="chevron-right" size={16} className="mt-2 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
            <Pager page={page} pageSize={PAGE_SIZE} total={shown.total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
