import type { EventState, EventSummary, EventType, StaffTaskPriority, StaffTaskStatus, TodoUrgency } from "../../lib/domain";

/** The four kinds of thing a calendar shows (round 1: tasks and to-dos join client events and personal entries). */
export type CalendarKind = "event" | "personal" | "task" | "todo";

/** Order everywhere a day lists its kinds: the pop-up's sections and the month cell's counts. */
export const KIND_ORDER: readonly CalendarKind[] = ["event", "task", "todo", "personal"];

/**
 * What the calendar draws. Client events, the caller's personal entries, staff
 * tasks (placed at their due time) and the caller's own to-dos (likewise) all
 * map onto it. Tasks and to-dos are a single instant: startsAt = endsAt = due.
 */
export interface CalendarItem {
  id: string;
  kind: CalendarKind;
  title: string;
  startsAt: string;
  endsAt: string;
  /** The item own IANA zone, for the event-local time in tooltips. Tasks and to-dos come as "UTC": they show in the viewer's zone. */
  timeZone: string;
  href: string;
  type: EventType | "personal" | "task" | "todo";
  state: EventState;
  clientId: string | null;
  clientName: string | null;
  stageName: string | null;
  /** Tasks only. */
  taskStatus: StaffTaskStatus | null;
  taskPriority: StaffTaskPriority | null;
  assigneeName: string | null;
  /** To-dos only. */
  urgency: TodoUrgency | null;
  done: boolean;
}

export function fromEvent(e: EventSummary): CalendarItem {
  return {
    id: e.id,
    kind: "event",
    title: e.title,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    timeZone: e.timeZone,
    href: `/app/events/${e.id}`,
    type: e.type,
    state: e.state,
    clientId: e.clientId,
    clientName: e.clientName,
    stageName: e.currentStageName,
    taskStatus: null,
    taskPriority: null,
    assigneeName: null,
    urgency: null,
    done: false,
  };
}

/**
 * Chip styles. Client work is a neutral tint (crimson is kept for today's date
 * marker); personal entries are outlined and transparent so they never read as
 * client work; tasks lean on the info blue and to-dos on the success green, both
 * as a quiet tint with a coloured left edge. The map stays keyed by type so a
 * type can get its own look later.
 */
const CLIENT_CHIP = "bg-accent-bg text-text-primary border-border border-l-[3px] border-l-ink";
export const TYPE_CHIP_CLASSES: Record<CalendarItem["type"], string> = {
  shoot: CLIENT_CHIP,
  campaign: CLIENT_CHIP,
  meeting: CLIENT_CHIP,
  content_posting: CLIENT_CHIP,
  other: CLIENT_CHIP,
  personal: "bg-transparent text-text-secondary border-dashed border-text-muted",
  task: "bg-info-bg text-text-primary border-transparent border-l-[3px] border-l-info",
  todo: "bg-success-bg text-text-primary border-transparent border-l-[3px] border-l-success",
};

/** The small coloured dot per kind (month cells on phones, the legend). */
export const KIND_DOT: Record<CalendarKind, string> = {
  event: "bg-ink",
  task: "bg-info",
  todo: "bg-success",
  personal: "border border-dashed border-text-muted bg-transparent",
};

/** One item of GET /calendar: a client event, a personal entry, a task or a to-do (contract §6). */
export interface FeedItem {
  kind: CalendarKind;
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  clientId: string | null;
  clientName: string | null;
  ownerId: string;
  eventType?: EventType;
  state?: EventState;
  currentStageName?: string;
  /** task */
  status?: StaffTaskStatus;
  priority?: StaffTaskPriority;
  assigneeId?: string;
  assigneeName?: string;
  /** todo */
  urgency?: TodoUrgency;
  done?: boolean;
}

export interface FeedResult {
  from: string;
  to: string;
  truncated: boolean;
  items: FeedItem[];
}

export function fromFeedItem(f: FeedItem): CalendarItem {
  const href = f.kind === "event" ? `/app/events/${f.id}` : f.kind === "task" ? `/app/tasks/${f.id}` : f.kind === "todo" ? "/app/todos" : "";
  return {
    id: f.id,
    kind: f.kind,
    title: f.title,
    startsAt: f.startsAt,
    endsAt: f.endsAt,
    timeZone: f.timeZone,
    href,
    type: f.kind === "event" ? (f.eventType ?? "other") : f.kind,
    state: f.state ?? "active",
    clientId: f.clientId,
    clientName: f.clientName,
    stageName: f.kind === "event" ? (f.currentStageName ?? null) : null,
    taskStatus: f.kind === "task" ? (f.status ?? null) : null,
    taskPriority: f.kind === "task" ? (f.priority ?? null) : null,
    assigneeName: f.kind === "task" ? (f.assigneeName ?? null) : null,
    urgency: f.kind === "todo" ? (f.urgency ?? null) : null,
    done: f.kind === "todo" ? !!f.done : false,
  };
}

export type KindCounts = Record<CalendarKind, number>;

/** How many of each kind are in a list (one pass). */
export function countByKind(items: readonly Pick<CalendarItem, "kind">[]): KindCounts {
  const counts: KindCounts = { event: 0, task: 0, todo: 0, personal: 0 };
  for (const it of items) counts[it.kind] += 1;
  return counts;
}

/** The visible wording of a count: "2 events", "1 task", "1 to-do", "3 personal" (personal doesn't take a plural). */
function noun(kind: CalendarKind, n: number): string {
  switch (kind) {
    case "event":
      return n === 1 ? "1 event" : `${n} events`;
    case "task":
      return n === 1 ? "1 task" : `${n} tasks`;
    case "todo":
      return n === 1 ? "1 to-do" : `${n} to-dos`;
    case "personal":
      return `${n} personal`;
  }
}

/** Non-zero kinds as short strings, in KIND_ORDER: ["2 events", "3 tasks", "1 to-do", "1 personal"]. */
export function countParts(counts: KindCounts): { kind: CalendarKind; text: string }[] {
  return KIND_ORDER.filter((k) => counts[k] > 0).map((kind) => ({ kind, text: noun(kind, counts[kind]) }));
}

/** "2 events · 3 tasks · 1 to-do · 1 personal"; empty when the day has nothing. */
export function countsText(counts: KindCounts): string {
  return countParts(counts)
    .map((p) => p.text)
    .join(" · ");
}

/** The screen-reader version of the line: "2 events, 3 tasks, 1 to-do, 1 personal entry". */
export function countsAria(counts: KindCounts): string {
  return countParts(counts)
    .map((p) => (p.kind === "personal" ? (counts.personal === 1 ? "1 personal entry" : `${counts.personal} personal entries`) : p.text))
    .join(", ");
}
