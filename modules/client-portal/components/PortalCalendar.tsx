"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Panel } from "../../../components/ui/Panel";
import { Icon } from "../../../components/ui/Icon";
import { Loader } from "../../../components/ui/Loader";
import { Button } from "../../../components/ui/Button";
import { dayRange, formatMonthTitle, formatTimeInZone, isSameMonth, itemsOnDay, monthGrid, shiftMonth, todayKey, visibleRange } from "../../../lib/domain/utils/calendar";
import { publicPortalApi, type PortalEvent } from "../api/publicPortalApi";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The client's read-only calendar (FR-POR-05), in the client's time zone.
 * Loads one visible month at a time (load on demand, needleye's rule). On a
 * phone each day lists its event titles; on wider screens they sit in a grid.
 */
export function PortalCalendar({ token, zone, onOpen }: { token: string; zone: string; onOpen: (id: string) => void }) {
  const [cursor, setCursor] = useState(() => todayKey(zone));
  const [reload, setReload] = useState(0);
  const key = `${cursor}|${reload}`;
  const [result, setResult] = useState<{ key: string; events?: PortalEvent[]; error?: string } | null>(null);
  const current = result?.key === key ? result : null;
  const events = current?.events ?? null;
  const error = current?.error ?? null;

  const weeks = useMemo(() => monthGrid(cursor), [cursor]);

  useEffect(() => {
    let cancelled = false;
    const { first, last } = visibleRange("month", cursor);
    const { from, to } = dayRange(first, last, zone);
    const forKey = `${cursor}|${reload}`;
    publicPortalApi
      .events(token, from, to)
      .then((r) => !cancelled && setResult({ key: forKey, events: r.events }))
      .catch((e: unknown) => !cancelled && setResult({ key: forKey, error: e instanceof Error ? e.message : "Could not load the calendar." }));
    return () => {
      cancelled = true;
    };
  }, [token, zone, cursor, reload]);

  const days = weeks.flat().filter((d) => isSameMonth(d, cursor));
  const today = todayKey(zone);

  return (
    <Panel
      icon="calendar"
      title={`Calendar · ${formatMonthTitle(cursor)}`}
      action={
        <div className="flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" className="px-2.5 py-1.5" aria-label="Previous month" onClick={() => setCursor((c) => shiftMonth(c, -1))}>
            <Icon name="chevron-right" size={16} className="rotate-180" />
          </Button>
          <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => setCursor(todayKey(zone))}>
            Today
          </Button>
          <Button variant="ghost" className="px-2.5 py-1.5" aria-label="Next month" onClick={() => setCursor((c) => shiftMonth(c, 1))}>
            <Icon name="chevron-right" size={16} />
          </Button>
        </div>
      }
    >
      <div className="overflow-hidden border-t border-border-light">
        {error ? (
          <div className="p-5 text-sm">
            <p role="alert" className="text-error">
              {error}
            </p>
            <Button variant="outline" className="mt-3" onClick={() => setReload((n) => n + 1)}>
              Try again
            </Button>
          </div>
        ) : events === null ? (
          <div className="flex justify-center p-8">
            <Loader label="Loading" />
          </div>
        ) : (
          <>
            {/* Phones: an agenda of the month's days that have events. */}
            <ul className="divide-y divide-border-light sm:hidden">
              {days.filter((d) => itemsOnDay(events, d, zone).length > 0).length === 0 && <li><EmptyState compact title="No events this month." /></li>}
              {days.map((d) => {
                const items = itemsOnDay(events, d, zone);
                if (items.length === 0) return null;
                return (
                  <li key={d} className="p-3">
                    <p className="text-xs font-semibold text-text-secondary">{new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</p>
                    {items.map((e) => (
                      <EventChip key={e.id} event={e} zone={zone} onOpen={onOpen} />
                    ))}
                  </li>
                );
              })}
            </ul>
            {/* Tablets and up: the month grid. */}
            <div className="hidden sm:block">
              <div className="grid grid-cols-7 border-b border-border-light bg-accent-bg text-center text-[11px] font-medium text-text-muted">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1.5">
                    {w}
                  </div>
                ))}
              </div>
              {weeks.map((week) => (
                <div key={week[0]} className="grid grid-cols-7 border-b border-border-light last:border-b-0">
                  {week.map((d) => (
                    <div key={d} className={`min-h-20 min-w-0 border-r border-border-light p-1 last:border-r-0 ${isSameMonth(d, cursor) ? "" : "bg-accent-bg/60"}`}>
                      <p className={`text-[11px] ${d === today ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 font-bold text-on-ink" : "text-text-muted"}`}>{Number(d.slice(8))}</p>
                      {itemsOnDay(events, d, zone).map((e) => (
                        <EventChip key={e.id} event={e} zone={zone} onOpen={onOpen} compact />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function EventChip({ event, zone, onOpen, compact = false }: { event: PortalEvent; zone: string; onOpen: (id: string) => void; compact?: boolean }) {
  const struck = event.state !== "active" ? "line-through opacity-60" : "";
  return (
    <button
      type="button"
      onClick={() => onOpen(event.id)}
      title={event.title}
      className={`mt-1 block w-full truncate rounded-app-sm bg-primary-bg px-1.5 py-0.5 text-left text-text-primary transition-colors hover:bg-gold-soft ${compact ? "text-[11px]" : "text-sm"} ${struck}`}
    >
      {formatTimeInZone(event.startsAt, zone)} {event.title}
    </button>
  );
}
