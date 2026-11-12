"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  dayRange,
  defaultDueForDay,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  formatDayLabel,
  formatMonthTitle,
  formatTimeInZone,
  hasCapability,
  isSameMonth,
  itemsStartingOnDay,
  monthGrid,
  shiftMonth,
  todayKey,
  visibleRange,
  weekDays,
  type DayKey,
  type EventType,
  type Role,
  type Todo,
} from "../../../lib/domain";
import { useMediaQuery } from "../../../lib/hooks/useMediaQuery";
import { calendarApi } from "../calendarApi";
import { PersonalEventModal } from "../../personal-events/components/PersonalEventModal";
import { TaskFormModal } from "../../staff-tasks/components/TaskFormModal";
import { TodoFormModal } from "../../todos/components/TodoFormModal";
import { usersApi } from "../../admin-users/api/usersApi";
import { clientsApi } from "../../clients/api/clientsApi";
import { Button } from "../../../components/ui/Button";
import { Segmented } from "../../../components/ui/Segmented";
import { Icon } from "../../../components/ui/Icon";
import { Select } from "../../../components/ui/Select";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import {
  KIND_DOT,
  KIND_ORDER,
  TYPE_CHIP_CLASSES,
  countParts,
  countByKind,
  countsAria,
  fromFeedItem,
  type CalendarItem,
  type CalendarKind,
} from "../calendarItems";
import { CalendarChip } from "./CalendarChip";
import { DayModal } from "./DayModal";

type View = "month" | "week" | "list";
const VIEWS: { id: View; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "list", label: "List" },
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEGEND_LABEL: Record<CalendarKind, string> = { event: "Client event", task: "Task", todo: "To-do", personal: "Personal" };

/**
 * The calendar, built from plain CSS grids (no calendar library). Loads only the
 * visible range from the merged GET /calendar feed in the viewer time zone:
 * client events, the caller's personal entries, staff tasks and the caller's
 * own to-dos (the last two at their due time). Month cells show COUNTS per
 * kind and open the day pop-up, which lists the day and holds the create
 * buttons the viewer is allowed; week and list show chips. List is the
 * default on phones. `clientId` scopes it to one client (the client workspace
 * tab: events only); otherwise it is the person's own calendar, or the Admin
 * global one (owner filter). `role` decides which creates and filters exist.
 */
export function CalendarView({
  viewerTimeZone,
  isAdmin,
  role,
  clientId,
  readOnly = false,
}: {
  viewerTimeZone: string;
  isAdmin: boolean;
  /** The viewer's role. Not needed on a client tab, where the viewer is always a client manager. */
  role?: Role;
  clientId?: string;
  readOnly?: boolean;
}) {
  const { showToast } = useToast();
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
  const [dayOpen, setDayOpen] = useState<DayKey | null>(null);
  const [personal, setPersonal] = useState<{ id: string | null; day?: string } | null>(null);
  const [taskForm, setTaskForm] = useState<{ due: string } | null>(null);
  const [todoForm, setTodoForm] = useState<{ due?: string; todo?: Todo } | null>(null);

  // What this viewer may do. On a client tab only events exist, and only on a live client.
  const onClientTab = !!clientId;
  const can = (cap: Parameters<typeof hasCapability>[1]) => !onClientTab && !readOnly && !!role && hasCapability(role, cap);
  const canEvent = onClientTab ? !readOnly : can("events:write");
  const canTask = can("staff_tasks:assign");
  const canTodo = can("todos:manage");
  const canPersonal = can("personal_events:manage");
  const sawClients = onClientTab || (!!role && hasCapability(role, "events:read"));

  const reload = () => setReloadKey((k) => k + 1);
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

  function newEventHref(day: DayKey): string {
    const q = new URLSearchParams({ date: day });
    if (clientId) q.set("clientId", clientId);
    else if (clientFilter) q.set("clientId", clientFilter);
    return `/app/events/new?${q.toString()}`;
  }

  const title = view === "week" ? `${formatDayLabel(range.first)} – ${formatDayLabel(range.last)}` : formatMonthTitle(cursor);
  const legend = KIND_ORDER.filter((k) => (k === "event" ? sawClients : k === "personal" ? !onClientTab && !!role && hasCapability(role, "personal_events:manage") : !onClientTab));

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
        <Segmented label="Calendar view" options={VIEWS} value={view} onChange={setChosenView} className="max-sm:w-full" stretch />
      </div>

      {sawClients && (
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
              aria-label="Filter by person"
              placeholder="Everyone"
              value={ownerFilter || null}
              clearable
              load={(q) => usersApi.searchOptions(q)}
              onChange={(id) => setOwnerFilter(id ?? "")}
            />
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted" aria-hidden="true">
        {legend.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            {k === "event" || k === "personal" ? (
              <span className={`inline-block h-3 w-4 rounded-sm border ${TYPE_CHIP_CLASSES[k === "event" ? "shoot" : "personal"]}`} />
            ) : (
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${KIND_DOT[k]}`} />
            )}
            {LEGEND_LABEL[k]}
          </span>
        ))}
        {sawClients && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-text-muted line-through">Cancelled</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          Today
        </span>
      </div>

      {error && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-app border border-error/30 bg-error-bg p-3 text-sm text-error">
          <span>{error}</span>
          <button className="font-medium underline" onClick={reload}>
            Retry
          </button>
        </div>
      )}
      {truncated && <p className="mb-3 text-xs text-text-muted">Showing the first items in this range. Narrow the filters to see the rest.</p>}

      <div className={`transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
        {view === "month" && <MonthGrid cursor={cursor} items={visible} zone={viewerTimeZone} today={today} onOpenDay={setDayOpen} />}
        {view === "week" && <WeekGrid cursor={cursor} items={visible} zone={viewerTimeZone} today={today} onOpenDay={setDayOpen} onOpenPersonal={(id) => setPersonal({ id })} />}
        {view === "list" && <ListView range={range} items={visible} zone={viewerTimeZone} loading={loading} onOpenDay={setDayOpen} onOpenPersonal={(id) => setPersonal({ id })} />}
      </div>

      {dayOpen && (
        <DayModal
          day={dayOpen}
          items={visible}
          zone={viewerTimeZone}
          onClose={() => setDayOpen(null)}
          onChanged={reload}
          onOpenPersonal={(id) => {
            setDayOpen(null);
            setPersonal({ id });
          }}
          onEditTodo={(todo) => {
            setDayOpen(null);
            setTodoForm({ todo });
          }}
          actions={{
            newEventHref: canEvent ? newEventHref(dayOpen) : undefined,
            onNewTask: canTask
              ? () => {
                  setTaskForm({ due: defaultDueForDay(dayOpen) });
                  setDayOpen(null);
                }
              : undefined,
            onNewTodo: canTodo
              ? () => {
                  setTodoForm({ due: defaultDueForDay(dayOpen) });
                  setDayOpen(null);
                }
              : undefined,
            onNewPersonal: canPersonal
              ? () => {
                  setPersonal({ id: null, day: dayOpen });
                  setDayOpen(null);
                }
              : undefined,
          }}
        />
      )}
      {personal && (
        <PersonalEventModal eventId={personal.id} day={personal.day} zone={viewerTimeZone} onClose={() => setPersonal(null)} onChanged={reload} />
      )}
      {taskForm && (
        <TaskFormModal
          open
          zone={viewerTimeZone}
          defaultDue={taskForm.due}
          onClose={() => setTaskForm(null)}
          onSaved={() => {
            setTaskForm(null);
            showToast("Task created.", "success");
            reload();
          }}
        />
      )}
      {todoForm && (
        <TodoFormModal
          todo={todoForm.todo}
          zone={viewerTimeZone}
          defaultDue={todoForm.due}
          onClose={() => setTodoForm(null)}
          onSaved={(_saved, created) => {
            setTodoForm(null);
            showToast(created ? "To-do added." : "To-do saved.", "success");
            reload();
          }}
        />
      )}
    </div>
  );
}

/** A month cell's counts: stacked "● 2 events" lines from `sm` up, coloured dots with numbers on phones. */
function CellCounts({ items }: { items: CalendarItem[] }) {
  const counts = countByKind(items);
  const parts = countParts(counts);
  if (parts.length === 0) return null;
  return (
    <div role="img" aria-label={countsAria(counts)} data-testid="day-counts" className="mt-0.5">
      <ul className="flex flex-wrap gap-x-1.5 gap-y-0.5 sm:hidden">
        {parts.map((p) => (
          <li key={p.kind} className="inline-flex items-center gap-0.5 text-[10.5px] leading-none font-semibold text-text-secondary">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${KIND_DOT[p.kind]}`} />
            {counts[p.kind]}
          </li>
        ))}
      </ul>
      <ul className="hidden flex-col gap-0.5 sm:flex">
        {parts.map((p) => (
          <li key={p.kind} className="flex items-center gap-1.5 text-[11.5px] leading-tight text-text-secondary">
            <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[p.kind]}`} />
            <span className="truncate">{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthGrid({ cursor, items, zone, today, onOpenDay }: { cursor: DayKey; items: CalendarItem[]; zone: string; today: DayKey; onOpenDay: (d: DayKey) => void }) {
  const weeks = monthGrid(cursor);
  return (
    <div className="overflow-hidden rounded-app-lg bg-card shadow-app" role="grid" aria-label="Month">
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
            // A multi-day item counts once, on its first day (the pop-up lists it as "Ongoing" on later days).
            const dayItems = itemsStartingOnDay(items, day, zone);
            const inMonth = isSameMonth(day, cursor);
            return (
              <div
                key={day}
                role="gridcell"
                data-day={day}
                className={`border-r border-border-light last:border-r-0 ${day === today ? "bg-primary-bg/60" : inMonth ? "" : "bg-app-bg/60"}`}
              >
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  className="flex h-full min-h-14 w-full flex-col items-stretch p-1 text-left transition-colors outline-none hover:bg-accent-bg/70 focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:ring-inset sm:min-h-[104px] sm:p-1.5"
                >
                  <span className="sr-only">{formatDayLabel(day)}</span>
                  <span
                    aria-hidden
                    className={`inline-flex h-6 min-w-6 items-center justify-center self-start rounded-full px-1 text-xs ${day === today ? "bg-primary font-bold text-white shadow-app" : inMonth ? "font-medium text-text-primary" : "text-text-muted/70"}`}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <CellCounts items={dayItems} />
                </button>
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
  onOpenDay,
  onOpenPersonal,
}: {
  cursor: DayKey;
  items: CalendarItem[];
  zone: string;
  today: DayKey;
  onOpenDay: (d: DayKey) => void;
  onOpenPersonal: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7" aria-label="Week">
      {weekDays(cursor).map((day) => {
        const dayItems = itemsStartingOnDay(items, day, zone);
        return (
          <section key={day} data-day={day} className={`min-h-[120px] rounded-app-lg border bg-card p-3 shadow-app md:p-2 ${day === today ? "border-primary bg-primary-bg/40 ring-1 ring-primary" : "border-border"}`}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className={`text-xs font-semibold ${day === today ? "text-primary" : "text-text-primary"}`}>
                {formatDayLabel(day)}
                {day === today && <span className="ml-1.5 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-white">Today</span>}
              </h3>
              <button type="button" aria-label={`Open ${formatDayLabel(day)}`} onClick={() => onOpenDay(day)} className="rounded p-0.5 text-text-muted hover:text-primary">
                <Icon name="plus" size={13} />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {dayItems.length === 0 && <span className="text-xs text-text-muted/80">Nothing</span>}
              {dayItems.map((it) => (
                <CalendarChip key={`${it.kind}-${it.id}`} item={it} zone={zone} onOpenPersonal={onOpenPersonal} onOpenDay={() => onOpenDay(day)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ListView({
  range,
  items,
  zone,
  loading,
  onOpenDay,
  onOpenPersonal,
}: {
  range: { first: DayKey; last: DayKey };
  items: CalendarItem[];
  zone: string;
  loading: boolean;
  onOpenDay: (d: DayKey) => void;
  onOpenPersonal: (id: string) => void;
}) {
  const days: DayKey[] = [];
  for (let d = range.first; d <= range.last; d = addDays(d, 1)) days.push(d);
  const groups = days.map((d) => ({ day: d, list: itemsStartingOnDay(items, d, zone) })).filter((g) => g.list.length > 0);
  return (
    <div className="overflow-hidden rounded-app-lg bg-card shadow-app" aria-label="Agenda">
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
          <EmptyState compact icon="calendar" title="Nothing in this period." description="Try another range or clear the filters." />
        )
      ) : (
        groups.map((g) => (
          <section key={g.day} data-day={g.day} className="border-b border-border-light px-4 py-3.5 last:border-0 sm:px-5">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <button type="button" onClick={() => onOpenDay(g.day)} className="rounded-app-sm hover:text-primary hover:underline focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none" aria-label={`Open ${formatDayLabel(g.day)}`}>
                {formatDayLabel(g.day)}
              </button>
              {g.day === todayKey(zone) && <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-white">Today</span>}
            </h3>
            <div className="flex flex-col gap-1.5">
              {g.list.map((it) => (
                <div key={`${it.kind}-${it.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="w-28 shrink-0 text-xs text-text-muted">
                    {it.startsAt === it.endsAt ? formatTimeInZone(it.startsAt, zone) : `${formatTimeInZone(it.startsAt, zone)} – ${formatTimeInZone(it.endsAt, zone)}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <CalendarChip item={it} zone={zone} compact onOpenPersonal={onOpenPersonal} onOpenDay={() => onOpenDay(g.day)} />
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
