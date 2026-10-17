import Link from "next/link";
import { CountUp } from "../../../components/ui/CountUp";
import { Icon, type IconName } from "../../../components/ui/Icon";
import { EmptyState } from "../../../components/ui/EmptyState";
import { StatusPill } from "../../../components/ui/StatusPill";
import { ROLE_LABELS, formatTimeInZone } from "../../../lib/domain";
import { COMMENT_STATUS_LABELS, STATUS_TONES as COMMENT_TONES } from "../../client-comments/lib/commentStatus";
import { PriorityPill } from "../../staff-tasks/components/taskUi";
import type { DashboardComment, DashboardEvent, DashboardTask, DashboardTaskComment, StageGroup, TaskStatusCounts, WorkloadRow } from "../api/dashboardApi";
import { barPercents, dueText, isOverdueText, percentOf, stagePercent, totalTasks, weekStrip } from "../format";

export { HeroBand, type HeroCell } from "../../../components/ui/HeroBand";
export { Panel } from "../../../components/ui/Panel";

/** A preview row that links somewhere: hairline-separated, hover tint. */
function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent-bg">
        {children}
      </Link>
    </li>
  );
}

/* ------------------------------------------------------- tasks by status */

type StatusKey = keyof TaskStatusCounts;

/**
 * Status colours (validated as a set with the dataviz checker, light and dark):
 * not started graphite, in progress blue, blocked amber (also hatched: the
 * second cue for colour-blind readers and print), done green. Every status
 * also carries an icon and its name, so colour is never the only signal.
 */
const STATUS: Record<StatusKey, { label: string; icon: IconName; color: string; hint: string }> = {
  todo: { label: "To do", icon: "list", color: "var(--color-chart-todo)", hint: "Not started yet" },
  in_progress: { label: "In progress", icon: "refresh", color: "var(--color-info)", hint: "Being worked on" },
  blocked: { label: "Blocked", icon: "ban", color: "var(--color-warning)", hint: "Waiting on something" },
  done: { label: "Done", icon: "check-circle", color: "var(--color-success)", hint: "Finished" },
};
/** Rows read in workflow order. */
const ROW_ORDER: StatusKey[] = ["todo", "in_progress", "blocked", "done"];
/** The bar keeps green and amber apart (they're hard to tell apart for colour-blind readers when they touch). */
const BAR_ORDER: StatusKey[] = ["done", "in_progress", "todo", "blocked"];
const HATCH = "repeating-linear-gradient(135deg, transparent 0 4px, rgba(255,255,255,0.4) 4px 6px)";

/**
 * Tasks by status, made to answer three questions at a glance: how much is
 * open, how far along are we, and what's stuck. A headline (open tasks, share
 * done), one segmented bar for the whole, then a row per status -- count,
 * share on one common scale, and a link to exactly those tasks.
 */
export function StatusBreakdown({ counts }: { counts: TaskStatusCounts }) {
  const total = totalTasks(counts);
  const open = counts.todo + counts.in_progress + counts.blocked;
  const donePct = percentOf(counts.done, total);
  if (total === 0) return <EmptyState compact icon="clipboard" title="No tasks yet" description="Tasks you assign will show here." />;
  return (
    <div className="flex flex-col gap-5 px-5 pb-5">
      <div className="flex items-end justify-between gap-4">
        <p>
          <span className="figure block text-[34px] leading-none text-text-primary">
            <CountUp to={open} />
          </span>
          <span className="mt-1 block text-[13px] text-text-muted">open of {plural(total, "task")}</span>
        </p>
        <p className="text-right">
          <span className="figure block text-[22px] leading-none text-success">{donePct}%</span>
          <span className="mt-1 block text-[13px] text-text-muted">done</span>
        </p>
      </div>

      {/* The whole, in one bar: hover a segment for its numbers. */}
      <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={ROW_ORDER.map((k) => `${STATUS[k].label} ${counts[k]}`).join(", ")}>
        {BAR_ORDER.filter((k) => counts[k] > 0).map((k) => (
          <span
            key={k}
            title={`${STATUS[k].label}: ${counts[k]} (${percentOf(counts[k], total)}%)`}
            className="grow-x h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(counts[k] / total) * 100}%`, background: k === "blocked" ? `${HATCH}, ${STATUS[k].color}` : STATUS[k].color }}
          />
        ))}
      </div>

      <ul className="-mx-2 flex flex-col">
        {ROW_ORDER.map((k) => {
          const pct = percentOf(counts[k], total);
          const attention = k === "blocked" && counts[k] > 0;
          return (
            <li key={k}>
              <Link
                href={`/app/tasks?status=${k}`}
                className="group flex items-center gap-3 rounded-app px-2 py-2 transition-colors hover:bg-accent-bg"
                title={`${STATUS[k].label}: ${counts[k]} of ${total} (${pct}%) - open the list`}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-app text-white"
                  style={{ background: k === "blocked" ? `${HATCH}, ${STATUS[k].color}` : STATUS[k].color }}
                  aria-hidden
                >
                  <Icon name={STATUS[k].icon} size={15} />
                </span>
                <span className="w-28 shrink-0">
                  <span className="block text-[13.5px] font-medium text-text-primary">{STATUS[k].label}</span>
                  <span className={`block text-[11.5px] ${attention ? "font-medium text-warning-text" : "text-text-muted"}`}>
                    {attention ? "Needs attention" : STATUS[k].hint}
                  </span>
                </span>
                {/* Per-row share bars only where there's room; on narrow panels the bar above carries the proportions. */}
                <span className="hidden h-2 flex-1 overflow-hidden rounded-full bg-border-light sm:block lg:hidden xl:block" aria-hidden>
                  <span className="grow-x block h-full rounded-full" style={{ width: `${pct}%`, background: STATUS[k].color }} />
                </span>
                <span className="figure ml-auto w-8 shrink-0 text-right text-[16px] text-text-primary sm:ml-0 lg:ml-auto xl:ml-0">{counts[k]}</span>
                <span className="w-10 shrink-0 text-right text-xs text-text-muted">{pct}%</span>
                <Icon name="chevron-right" size={14} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const plural = (n: number, one: string) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : `${one}s`}`;

/* ------------------------------------------------------------------ rows */

export function TaskRows({ tasks, zone, showAssignee = false, empty }: { tasks: DashboardTask[]; zone: string; showAssignee?: boolean; empty: string }) {
  if (tasks.length === 0) return <EmptyState compact icon="check-circle" title={empty} />;
  return (
    <ul className="divide-y divide-border-light">
      {tasks.map((t) => (
        <RowLink key={t.id} href={`/app/tasks/${t.id}`}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-text-primary">{t.title}</span>
            <span className="block truncate text-xs text-text-muted">
              {[t.clientName, showAssignee ? t.assigneeName : null].filter(Boolean).join(" · ") || "No client"}
            </span>
          </span>
          <span className="hidden shrink-0 sm:inline-flex">
            <PriorityPill priority={t.priority} />
          </span>
          <DueShort dueAt={t.dueAt} status={t.status} zone={zone} />
        </RowLink>
      ))}
    </ul>
  );
}

/** "Overdue 4d" in crimson, "Due today" in amber, otherwise muted: short enough for a preview row. */
function DueShort({ dueAt, status, zone }: { dueAt: string | null; status: DashboardTask["status"]; zone: string }) {
  const text = dueText(dueAt, status, zone);
  const tone = isOverdueText(text) ? "text-error font-medium" : text === "Due today" ? "text-warning-text font-medium" : "text-text-muted";
  return <span className={`w-24 shrink-0 text-right text-xs ${tone}`}>{text}</span>;
}

function EventDate({ iso, zone }: { iso: string; zone: string }) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: zone }).format(d);
  const mon = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: zone }).format(d);
  return (
    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-app bg-accent-bg ring-1 ring-border ring-inset">
      <span className="figure text-[15px] leading-none text-text-primary">{day}</span>
      <span className="mt-0.5 text-[10px] leading-none text-text-muted">{mon}</span>
    </span>
  );
}

export function EventRows({ events, zone, empty }: { events: DashboardEvent[]; zone: string; empty: string }) {
  if (events.length === 0) return <EmptyState compact icon="calendar" title={empty} />;
  return (
    <ul className="divide-y divide-border-light">
      {events.map((e) => (
        <RowLink key={e.id} href={`/app/events/${e.id}`}>
          <EventDate iso={e.startsAt} zone={zone} />
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[13.5px] font-medium text-text-primary ${e.state === "cancelled" ? "line-through opacity-60" : ""}`}>{e.title}</span>
            <span className="block truncate text-xs text-text-muted">
              {e.clientName} · {formatTimeInZone(e.startsAt, zone)}
            </span>
          </span>
          <span className="hidden w-32 shrink-0 sm:block" title={`Stage ${e.currentStagePosition} of ${e.stageCount}`}>
            <span className="flex justify-between gap-2 text-[11.5px]">
              <span className="truncate text-text-secondary">{e.currentStageName}</span>
              <span className="text-text-muted">
                {e.currentStagePosition}/{e.stageCount}
              </span>
            </span>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-border-light">
              <span className="grow-x block h-full rounded-full bg-ink" style={{ width: `${Math.max(stagePercent(e), 6)}%` }} />
            </span>
          </span>
        </RowLink>
      ))}
    </ul>
  );
}

function relativeTime(iso: string, now: number = Date.now()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Initials({ name }: { name: string }) {
  const text = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[11.5px] font-semibold text-on-ink">
      {text}
    </span>
  );
}

export function CommentRows({ comments, empty }: { comments: DashboardComment[]; empty: string }) {
  if (comments.length === 0) return <EmptyState compact icon="message" title={empty} />;
  return (
    <ul className="divide-y divide-border-light">
      {comments.map((c) => (
        <RowLink key={c.id} href={`/app/comments?commentId=${c.id}`}>
          <Initials name={c.clientName} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-[13.5px] font-medium text-text-primary">{c.clientName}</span>
              <span className="shrink-0 text-[11px] text-text-muted">{relativeTime(c.createdAt)}</span>
            </span>
            <span className="block truncate text-xs text-text-secondary">{c.excerpt}</span>
          </span>
          <StatusPill label={COMMENT_STATUS_LABELS[c.status]} tone={COMMENT_TONES[c.status]} />
        </RowLink>
      ))}
    </ul>
  );
}

export function TaskCommentRows({ comments }: { comments: DashboardTaskComment[] }) {
  if (comments.length === 0) return <EmptyState compact icon="message" title="No comments on your tasks yet" />;
  return (
    <ul className="divide-y divide-border-light">
      {comments.map((c) => (
        <RowLink key={c.id} href={`/app/tasks/${c.taskId}`}>
          <Initials name={c.authorName ?? "?"} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-[13.5px] font-medium text-text-primary">{c.authorName ?? "Someone"}</span>
              <span className="shrink-0 text-[11px] text-text-muted">{relativeTime(c.createdAt)}</span>
            </span>
            <span className="block truncate text-xs text-text-secondary">{c.comment}</span>
            <span className="block truncate text-[11px] text-text-muted">on {c.taskTitle}</span>
          </span>
        </RowLink>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------- week strip */

/** The next seven days: weekday, date and how many events each holds; today in crimson. Opens the calendar. */
export function WeekStrip({ today, events, zone }: { today: string; events: DashboardEvent[]; zone: string }) {
  const days = weekStrip(today, events, zone);
  return (
    <div className="grid grid-cols-7 gap-1.5 px-5 pb-4">
      {days.map(({ day, count }) => {
        const isToday = day === today;
        const date = new Date(`${day}T12:00:00Z`);
        return (
          <Link
            key={day}
            href="/app/calendar"
            className={`flex flex-col items-center gap-1 rounded-app py-2.5 transition-colors ${
              isToday ? "bg-ink text-on-ink" : "bg-accent-bg text-text-primary hover:bg-border-light"
            }`}
          >
            <span className={`text-[10.5px] ${isToday ? "opacity-70" : "text-text-muted"}`}>
              {new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(date)}
            </span>
            <span className="figure text-[16px] leading-none">{Number(day.slice(8))}</span>
            <span aria-label={`${count} events`} className="flex h-1.5 items-center gap-0.5">
              {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${isToday ? "bg-brand-on-dark" : "bg-primary"}`} />
              ))}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ stage bars */

/** Where active events stand: one row per stage, the busiest stage marked. */
export function StageBars({ groups }: { groups: StageGroup[] }) {
  if (groups.length === 0) return <EmptyState compact icon="layers" title="No active events" />;
  const widths = barPercents(groups.map((g) => g.count));
  const top = Math.max(...groups.map((g) => g.count));
  return (
    <ul className="flex flex-col gap-3 px-5 pb-5">
      {groups.map((g, i) => (
        <li key={g.stageName} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-[13px] text-text-secondary" title={g.stageName}>
            {g.stageName}
          </span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-border-light">
            <span className={`grow-x block h-full rounded-full ${g.count === top && groups.length > 1 ? "bg-primary" : "bg-ink"}`} style={{ width: `${widths[i]}%` }} />
          </span>
          <span className="figure w-8 shrink-0 text-right text-[14px] text-text-primary">{g.count}</span>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------- team workload */

/** One person's load as a bar: open work in ink, the overdue part of it in crimson. */
export function WorkloadBar({ row, max }: { row: WorkloadRow; max: number }) {
  const open = max > 0 ? (row.open / max) * 100 : 0;
  const overdue = row.open > 0 ? (row.overdue / row.open) * 100 : 0;
  return (
    <span className="block h-2 flex-1 overflow-hidden rounded-full bg-border-light" aria-hidden>
      <span className="grow-x flex h-full overflow-hidden rounded-full bg-ink" style={{ width: `${Math.max(open, row.open > 0 ? 4 : 0)}%` }}>
        <span className="ml-auto h-full bg-primary" style={{ width: `${overdue}%` }} />
      </span>
    </span>
  );
}

export function TeamRows({ rows }: { rows: WorkloadRow[] }) {
  if (rows.length === 0) return <EmptyState compact icon="users" title="No active staff yet" />;
  const max = Math.max(...rows.map((r) => r.open));
  return (
    <ul className="divide-y divide-border-light">
      {rows.map((r) => (
        <li key={r.userId}>
          <Link href={`/app/tasks?assigneeId=${r.userId}&assignee=${encodeURIComponent(r.name)}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent-bg">
            <Initials name={r.name} />
            <span className="w-36 min-w-0 shrink-0 sm:w-44">
              <span className="block truncate text-[13.5px] font-medium text-text-primary">{r.name}</span>
              <span className="block truncate text-xs text-text-muted">{ROLE_LABELS[r.role]}</span>
            </span>
            <WorkloadBar row={r} max={max} />
            <span className="w-20 shrink-0 text-right text-xs text-text-secondary">
              <span className="figure text-[14px] text-text-primary">{r.open}</span> open
              {r.overdue > 0 && <span className="block text-error">{r.overdue} overdue</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
