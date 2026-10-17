"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  describeEventTime,
  EVENT_STATES,
  EVENT_STATE_LABELS,
  EVENT_TYPE_LABELS,
  type EventState,
  type EventSummary,
} from "../../../lib/domain";
import { eventsApi } from "../api/eventsApi";
import { ButtonLink } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Select } from "../../../components/ui/Select";
import { Input } from "../../../components/ui/Field";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { Pager } from "../../../components/ui/Pager";
import { StatusPill, type PillTone } from "../../../components/ui/StatusPill";
import { StageProgressBar } from "./StageTracker";

const PAGE_SIZE = 20;
export const EVENT_STATE_TONES: Record<EventState, PillTone> = { active: "green", cancelled: "red", postponed: "amber" };

/** The Events tab of the client workspace: this client events, newest first, with upcoming/past marked. */
export function EventsTab({
  clientId,
  viewerTimeZone,
  readOnly,
}: {
  clientId: string;
  viewerTimeZone: string;
  readOnly: boolean;
}) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [state, setState] = useState<EventState | "">("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      setLoading(true);
      eventsApi
        .list({ clientId, state: state || undefined, search: debouncedSearch || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
        .then((data) => {
          if (cancelled) return;
          setEvents(data.events);
          setTotal(data.total);
          setNow(Date.now());
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load events");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [clientId, state, debouncedSearch, page, reloadKey]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <Input
          className="min-w-0 flex-1 sm:max-w-xs"
          placeholder="Search events by title"
          aria-label="Search events"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <Select
          className="w-auto"
          aria-label="Filter events by state"
          value={state}
          onChange={(e) => {
            setState(e.target.value as EventState | "");
            setPage(0);
          }}
        >
          <option value="">All states</option>
          {EVENT_STATES.map((s) => (
            <option key={s} value={s}>
              {EVENT_STATE_LABELS[s]}
            </option>
          ))}
        </Select>
        </div>
        {!readOnly && (
          <ButtonLink href={`/app/events/new?clientId=${clientId}`} className="max-sm:w-full">
            <Icon name="plus" size={16} /> New event
          </ButtonLink>
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
        ) : events.length === 0 ? (
          <div className="p-6 text-sm text-text-muted">
            {state || debouncedSearch ? "No events match these filters." : readOnly ? "No events." : "No events yet. Create the first one."}
          </div>
        ) : (
          <ul className="divide-y divide-border-light">
            {events.map((ev) => {
              const t = describeEventTime(ev.startsAt, viewerTimeZone, ev.timeZone);
              const past = new Date(ev.endsAt).getTime() < now;
              return (
                <li key={ev.id}>
                  <Link
                    href={`/app/events/${ev.id}`}
                    className="group flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-primary-bg/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-text-primary">{ev.title}</span>
                        <StatusPill label={EVENT_STATE_LABELS[ev.state]} tone={EVENT_STATE_TONES[ev.state]} />
                        <StatusPill label={past ? "Past" : "Upcoming"} tone={past ? "gray" : "blue"} />
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {EVENT_TYPE_LABELS[ev.type]} · {t.primary}
                      </p>
                      {t.secondary && <p className="text-xs text-text-muted">{t.secondary}</p>}
                    </div>
                    <StageProgressBar name={ev.currentStageName} position={ev.currentStagePosition} count={ev.stageCount} />
                    <Icon name="chevron-right" size={14} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && !error && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
      </div>
    </div>
  );
}
