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
import { EmptyState } from "../../../components/ui/EmptyState";
import { Panel } from "../../../components/ui/Panel";

const PAGE_SIZE = 20;
export const EVENT_STATE_TONES: Record<EventState, PillTone> = { active: "gray", cancelled: "red", postponed: "amber" };

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

  const filtered = !!(state || debouncedSearch);
  return (
    <Panel
      icon="layers"
      title="Events"
      subtitle={loading || error ? "Stage by stage, newest first" : `${total.toLocaleString("en-IN")} ${total === 1 ? "event" : "events"}, newest first`}
      action={
        !readOnly ? (
          <ButtonLink href={`/app/events/new?clientId=${clientId}`} className="max-sm:hidden">
            <Icon name="plus" size={16} /> New event
          </ButtonLink>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2 border-y border-border-light bg-accent-bg/40 px-4 py-3 sm:flex-row sm:flex-wrap sm:px-5">
        <Input
          className="sm:max-w-xs sm:flex-1"
          placeholder="Search events by title"
          aria-label="Search events"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <Select
          className="sm:w-auto"
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
        {!readOnly && (
          <ButtonLink href={`/app/events/new?clientId=${clientId}`} className="sm:hidden">
            <Icon name="plus" size={16} /> New event
          </ButtonLink>
        )}
      </div>

      {loading ? (
        <ul className="divide-y divide-border-light" aria-busy="true" aria-label="Loading events">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex items-center gap-4 px-4 py-4 sm:px-5">
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-2/5 rounded" />
                <div className="skeleton h-3 w-3/5 rounded" />
              </div>
              <div className="skeleton hidden h-6 w-28 rounded sm:block" />
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
      ) : events.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={filtered ? "No events match these filters." : readOnly ? "No events." : "No events yet."}
          description={filtered || readOnly ? undefined : "Create the first one."}
        />
      ) : (
        <ul className="divide-y divide-border-light">
          {events.map((ev) => {
            const t = describeEventTime(ev.startsAt, viewerTimeZone, ev.timeZone);
            const past = new Date(ev.endsAt).getTime() < now;
            return (
              <li key={ev.id}>
                <Link
                  href={`/app/events/${ev.id}`}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-accent-bg sm:px-5"
                >
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold break-words text-text-primary">{ev.title}</span>
                      <StatusPill label={EVENT_STATE_LABELS[ev.state]} tone={EVENT_STATE_TONES[ev.state]} />
                      <StatusPill label={past ? "Past" : "Upcoming"} tone={past ? "gray" : "blue"} />
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {EVENT_TYPE_LABELS[ev.type]} · {t.primary}
                    </p>
                    {t.secondary && <p className="text-xs text-text-muted">{t.secondary}</p>}
                  </div>
                  <StageProgressBar name={ev.currentStageName} position={ev.currentStagePosition} count={ev.stageCount} />
                  <Icon name="chevron-right" size={14} className="ml-auto shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && !error && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
    </Panel>
  );
}
