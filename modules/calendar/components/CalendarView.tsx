"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDays,
  dayRange,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  formatDayLabel,
  formatInZone,
  formatMonthTitle,
  formatTimeInZone,
  isSameMonth,
  itemsOnDay,
  monthGrid,
  shiftMonth,
  todayKey,
  visibleRange,
  weekDays,
  type DayKey,
  type EventType,
} from "../../../lib/domain";
import { useMediaQuery } from "../../../lib/hooks/useMediaQuery";
import { calendarApi } from "../calendarApi";
import { PersonalEventModal } from "../../personal-events/components/PersonalEventModal";
import { Modal } from "../../../components/ui/Modal";
import { ButtonLink } from "../../../components/ui/Button";
import { clientsApi } from "../../clients/api/clientsApi";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Select } from "../../../components/ui/Select";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { fromFeedItem, TYPE_CHIP_CLASSES, type CalendarItem } from "../calendarItems";
import { EmptyState } from "../../../components/ui/EmptyState";

type View = "month" | "week" | "list";
const VIEWS: { id: View; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "list", label: "List" },
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Staff calendar, built from plain CSS grids (no calendar library). Loads only the
 * visible range from the merged GET /calendar feed (client events + the caller's
 * personal events), in the viewer time zone. Personal events are managed in a modal and
 * never shown on a client tab (`clientId` set). Month, week and
 * list views; list is the default on phones. `clientId` scopes it to one client
 * (the client workspace tab); otherwise it is the manager own calendar, or the
 * Admin global one (owner filter).
 */
export function CalendarView({
  viewerTimeZone,
  isAdmin,
  clientId,
  readOnly = false,
}: {
  viewerTimeZone: string;
  isAdmin: boolean;
  clientId?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const isPhone = useMediaQuery("(max-width: 767px)");
  const [chosenView, setChosenView] = useState<View | null>(null);
  const view: View = chosenView ?? (isPhone ? "list" : "month");
  const [cursor, setCursor] = useState<DayKey>(() => todayKey(viewerTimeZone));
  const [type, setType] = useState<EventType | "">("");
  const [clientFilter, setClientFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const canPersonal = !clientId && !readOnly;
  const [slotDay, setSlotDay] = useState<DayKey | null>(null);
  const [personal, setPersonal] = useState<{ id: string | null; day?: string } | null>(null);

  const range = useMemo(() => visibleRange(view, cursor), [view, cursor]);
  const today = todayKey(viewerTimeZone);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { from, to } = dayRange(range.first, range.last, viewerTimeZone);
        const res = await calendarApi.feed({
          from,
          to,
          include: clientId ? "events" : "all",
          clientId: clientId || clientFilter || undefined,
          eventType: type || undefined,
          ...(isAdmin && ownerFilter ? { ownerId: ownerFilter } : {}),
        });
        const all: CalendarItem[] = res.items.map(fromFeedItem);
        const more = res.truncated;
        if (cancelled) return;
        setItems(all);
        setTruncated(more);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the calendar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [range, viewerTimeZone, clientId, clientFilter, type, ownerFilter, isAdmin, reloadKey]);

  const stageOptions = useMemo(() => [...new Set(items.map((i) => i.stageName).filter(Boolean) as string[])].sort(), [items]);
  const visible = useMemo(() => (stageFilter ? items.filter((i) => i.stageName === stageFilter) : items), [items, stageFilter]);

  function step(delta: number) {
    setCursor((c) => (view === "week" ? addDays(c, delta * 7) : shiftMonth(c, delta)));
  }

  function pickDay(day: DayKey) {
    if (canPersonal) setSlotDay(day);
    else router.push(newEventHref(day));
  }

  function newEventHref(day: DayKey): string {
    const q = new URLSearchParams({ date: day });
    if (clientId) q.set("clientId", clientId);
    else if (clientFilter) q.set("clientId", clientFilter);
    return `/app/events/new?${q.toString()}`;
  }

  const title = view === "week" ? `${formatDayLabel(range.first)} – ${formatDayLabel(range.last)}` : formatMonthTitle(cursor);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button variant="outline" className="px-2.5 py-2" aria-label="Previous" onClick={() => step(-1)}>
            <Icon name="chevron-right" size={15} className="rotate-180" />
          </Button>
          <Button variant="outline" className="px-2.5 py-2" aria-label="Next" onClick={() => step(1)}>
            <Icon name="chevron-right" size={15} />
          </Button>
          <Button variant="outline" onClick={() => setCursor(today)}>
            Today
          </Button>
          <h2 className="ml-1 font-serif text-xl text-text-primary sm:text-2xl" aria-live="polite" data-testid="calendar-title">
            {title}
          </h2>
        </div>
        <div role="group" aria-label="Calendar view" className="inline-flex rounded-app border border-border bg-card p-0.5 shadow-app max-sm:w-full">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setChosenView(v.id)}
              className={`min-h-9 rounded-[calc(var(--radius-app)-2px)] px-3.5 py-1.5 text-sm font-medium transition-colors max-sm:flex-1 ${view === v.id ? "bg-ink text-on-ink" : "text-text-secondary hover:bg-accent-bg"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {!clientId && (
          <SearchSelect
            className="sm:w-56"
            aria-label="Filter by client"
            placeholder="All clients"
            value={clientFilter || null}
            clearable
            load={clientsApi.searchOptions}
            onChange={(id) => setClientFilter(id ?? "")}
          />
        )}
        <Select className="sm:w-auto" aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value as EventType | "")}>
          <option value="">All types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select className="sm:w-auto" aria-label="Filter by stage" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">All stages</option>
          {stageOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        {isAdmin && !clientId && (
          <SearchSelect
            className="sm:w-56"
            aria-label="Filter by owner"
            placeholder="All owners"
            value={ownerFilter || null}
            clearable
            load={clientsApi.searchOwnerOptions}
            onChange={(id) => setOwnerFilter(id ?? "")}
          />
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-3 w-4 rounded-sm border ${TYPE_CHIP_CLASSES.shoot}`} />
          Client event
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-3 w-4 rounded-sm border ${TYPE_CHIP_CLASSES.personal}`} />
          Personal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-text-muted line-through">Cancelled</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          Today
        </span>
      </div>

      {error && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-app border border-error/30 bg-error-bg p-3 text-sm text-error">
          <span>{error}</span>
          <button className="font-medium underline" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </button>
        </div>
      )}
      {truncated && <p className="mb-3 text-xs text-text-muted">Showing the first events in this range. Narrow the filters to see the rest.</p>}

      <div className={`transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
        {view === "month" && (
          <MonthGrid cursor={cursor} items={visible} zone={viewerTimeZone} today={today} readOnly={readOnly} newEventHref={newEventHref} onPick={pickDay} canPersonal={canPersonal} onOpenPersonal={(id) => setPersonal({ id })} />
        )}
        {view === "week" && <WeekGrid cursor={cursor} items={visible} zone={viewerTimeZone} today={today} readOnly={readOnly} newEventHref={newEventHref} onPick={pickDay} canPersonal={canPersonal} onOpenPersonal={(id) => setPersonal({ id })} />}
        {view === "list" && <ListView range={range} items={visible} zone={viewerTimeZone} loading={loading} onOpenPersonal={(id) => setPersonal({ id })} />}
      </div>

      {slotDay && (
        <Modal open onClose={() => setSlotDay(null)} labelledBy="slot-h" panelClassName="max-w-sm">
          <div className="flex flex-col gap-3 p-5">
            <h2 id="slot-h" className="font-serif text-lg font-bold text-text-primary">
              Add to {formatDayLabel(slotDay)}
            </h2>
            <ButtonLink href={newEventHref(slotDay)}>Client event</ButtonLink>
            <Button
              variant="outline"
              onClick={() => {
                setPersonal({ id: null, day: slotDay });
                setSlotDay(null);
              }}
            >
              Personal event
            </Button>
            <Button variant="ghost" onClick={() => setSlotDay(null)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
      {personal && (
        <PersonalEventModal
          eventId={personal.id}
          day={personal.day}
          zone={viewerTimeZone}
          onClose={() => setPersonal(null)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function Chip({ item, zone, compact, dot, onOpenPersonal }: { item: CalendarItem; zone: string; compact?: boolean; dot?: boolean; onOpenPersonal?: (id: string) => void }) {
  const inactive = item.state !== "active";
  const same = formatTimeInZone(item.startsAt, zone) === formatTimeInZone(item.startsAt, item.timeZone);
  const tip = `${item.title}${item.clientName ? ` · ${item.clientName}` : ""}\n${formatInZone(item.startsAt, zone, true)}${same ? "" : `\n${formatInZone(item.startsAt, item.timeZone, true)} (event time)`}${inactive ? `\n${item.state}` : ""}`;
  if (item.kind === "personal") {
    return (
      <button
        type="button"
        title={tip}
        onClick={(e) => {
          e.stopPropagation();
          onOpenPersonal?.(item.id);
        }}
        data-testid="calendar-item"
        className={`block w-full truncate rounded-app-sm border px-1.5 py-[3px] text-left text-[11.5px] leading-tight transition-colors hover:border-text-secondary ${dot ? "max-sm:min-h-2 max-sm:px-0 max-sm:py-0" : ""} ${TYPE_CHIP_CLASSES.personal} ${inactive ? "line-through opacity-60" : ""}`}
      >
        {!compact && <span className="mr-1 font-semibold">{formatTimeInZone(item.startsAt, zone)}</span>}
        <span className={dot ? "max-sm:sr-only" : ""}>{item.title}</span>
      </button>
    );
  }
  return (
    <Link
      href={item.href}
      title={tip}
      onClick={(e) => e.stopPropagation()}
      data-testid="calendar-item"
      className={`block truncate rounded-app-sm border px-1.5 py-[3px] text-[11.5px] leading-tight transition-colors hover:border-text-secondary hover:bg-accent-light/40 ${dot ? "max-sm:min-h-2 max-sm:px-0 max-sm:py-0" : ""} ${TYPE_CHIP_CLASSES[item.type]} ${inactive ? "line-through opacity-60" : ""}`}
    >
      {!compact && <span className="mr-1 font-semibold">{formatTimeInZone(item.startsAt, zone)}</span>}
      <span className={dot ? "max-sm:sr-only" : ""}>{item.title}</span>
    </Link>
  );
}

function MonthGrid({
  cursor,
  items,
  zone,
  today,
  readOnly,
  newEventHref,
  onPick,
  canPersonal,
  onOpenPersonal,
}: {
  cursor: DayKey;
  items: CalendarItem[];
  zone: string;
  today: DayKey;
  readOnly: boolean;
  newEventHref: (d: DayKey) => string;
  onPick: (d: DayKey) => void;
  canPersonal: boolean;
  onOpenPersonal: (id: string) => void;
}) {
  const weeks = monthGrid(cursor);
  return (
    <div className="overflow-hidden rounded-app-lg border border-border bg-card shadow-app" role="grid" aria-label="Month">
      <div className="grid grid-cols-7 border-b border-border bg-accent-bg text-center text-xs font-medium text-text-muted" role="row">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`py-2.5 ${i >= 5 ? "text-text-muted/80" : "text-text-secondary"}`} role="columnheader">
            <span className="sm:hidden">{d[0]}</span>
            <span className="max-sm:hidden">{d}</span>
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-7 border-b border-border-light last:border-0" role="row">
          {week.map((day) => {
            const dayItems = itemsOnDay(items, day, zone);
            const inMonth = isSameMonth(day, cursor);
            return (
              <div
                key={day}
                role="gridcell"
                data-day={day}
                onClick={readOnly ? undefined : (e) => e.target === e.currentTarget && onPick(day)}
                className={`min-h-14 border-r border-border-light p-1 transition-colors last:border-r-0 sm:min-h-[104px] sm:p-1.5 ${day === today ? "bg-primary-bg/60" : inMonth ? "" : "bg-app-bg/60"} ${readOnly ? "" : "cursor-pointer hover:bg-accent-bg/70"}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${day === today ? "bg-primary font-bold text-white shadow-app" : inMonth ? "font-medium text-text-primary" : "text-text-muted/70"}`}>
                    {Number(day.slice(8))}
                  </span>
                  {!readOnly &&
                    (canPersonal ? (
                      <button
                        type="button"
                        aria-label={`Add an event on ${formatDayLabel(day)}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPick(day);
                        }}
                        className="rounded p-0.5 text-text-muted opacity-60 transition-opacity hover:text-primary hover:opacity-100 max-sm:hidden"
                      >
                        <Icon name="plus" size={13} />
                      </button>
                    ) : (
                      <Link href={newEventHref(day)} aria-label={`Add an event on ${formatDayLabel(day)}`} onClick={(e) => e.stopPropagation()} className="rounded p-0.5 text-text-muted opacity-60 transition-opacity hover:text-primary hover:opacity-100 max-sm:hidden">
                        <Icon name="plus" size={13} />
                      </Link>
                    ))}
                </div>
                <div className="flex flex-col gap-1">
                  {dayItems.slice(0, 3).map((it) => (
                    <Chip key={it.id} item={it} zone={zone} compact dot onOpenPersonal={onOpenPersonal} />
                  ))}
                  {dayItems.length > 3 && <span className="px-1 text-[10.5px] font-medium text-text-muted">+{dayItems.length - 3} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WeekGrid({
  cursor,
  items,
  zone,
  today,
  readOnly,
  newEventHref,
  onPick,
  canPersonal,
  onOpenPersonal,
}: {
  cursor: DayKey;
  items: CalendarItem[];
  zone: string;
  today: DayKey;
  readOnly: boolean;
  newEventHref: (d: DayKey) => string;
  onPick: (d: DayKey) => void;
  canPersonal: boolean;
  onOpenPersonal: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7" aria-label="Week">
      {weekDays(cursor).map((day) => {
        const dayItems = itemsOnDay(items, day, zone);
        return (
          <section key={day} data-day={day} className={`min-h-[120px] rounded-app-lg border bg-card p-3 shadow-app md:p-2 ${day === today ? "border-primary bg-primary-bg/40 ring-1 ring-primary" : "border-border"}`}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className={`text-xs font-semibold ${day === today ? "text-primary" : "text-text-primary"}`}>
                {formatDayLabel(day)}
                {day === today && <span className="ml-1.5 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-white">Today</span>}
              </h3>
              {!readOnly &&
                (canPersonal ? (
                  <button type="button" aria-label={`Add an event on ${formatDayLabel(day)}`} onClick={() => onPick(day)} className="text-text-muted hover:text-primary">
                    <Icon name="plus" size={13} />
                  </button>
                ) : (
                  <Link href={newEventHref(day)} aria-label={`Add an event on ${formatDayLabel(day)}`} className="text-text-muted hover:text-primary">
                    <Icon name="plus" size={13} />
                  </Link>
                ))}
            </div>
            <div className="flex flex-col gap-1">
              {dayItems.length === 0 && <span className="text-xs text-text-muted/80">Nothing</span>}
              {dayItems.map((it) => (
                <Chip key={it.id} item={it} zone={zone} onOpenPersonal={onOpenPersonal} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ListView({ range, items, zone, loading, onOpenPersonal }: { range: { first: DayKey; last: DayKey }; items: CalendarItem[]; zone: string; loading: boolean; onOpenPersonal: (id: string) => void }) {
  const days: DayKey[] = [];
  for (let d = range.first; d <= range.last; d = addDays(d, 1)) days.push(d);
  const groups = days.map((d) => ({ day: d, list: itemsOnDay(items, d, zone) })).filter((g) => g.list.length > 0);
  return (
    <div className="overflow-hidden rounded-app-lg border border-border bg-card shadow-app" aria-label="Agenda">
      {groups.length === 0 ? (
        loading ? (
        <div className="space-y-4 p-5" aria-busy="true" aria-label="Loading calendar">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton h-6 w-full rounded-app-sm" />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState compact icon="calendar" title="No events in this period." description="Try another range or clear the filters." />
      )
      ) : (
        groups.map((g) => (
          <section key={g.day} data-day={g.day} className="border-b border-border-light px-4 py-3.5 last:border-0 sm:px-5">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-secondary">
              {formatDayLabel(g.day)}
              {g.day === todayKey(zone) && <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-white">Today</span>}
            </h3>
            <div className="flex flex-col gap-1.5">
              {g.list.map((it) => (
                <div key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="w-28 shrink-0 text-xs text-text-muted">
                    {formatTimeInZone(it.startsAt, zone)} – {formatTimeInZone(it.endsAt, zone)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Chip item={it} zone={zone} compact onOpenPersonal={onOpenPersonal} />
                  </div>
                  {it.clientName && <span className="max-w-full truncate text-xs text-text-muted max-sm:basis-full max-sm:pl-[7.75rem]">{it.clientName}</span>}
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
