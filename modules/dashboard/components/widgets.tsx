import Link from "next/link";
import {
  EVENT_TYPE_LABELS,
  ROLE_LABELS,
  STAFF_TASK_STATUS_LABELS,
  formatDayLabel,
  formatInZone,
  type StaffTaskStatus,
} from "../../../lib/domain";
import { Card, CardHeader } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { StatusPill } from "../../../components/ui/StatusPill";
import { COMMENT_STATUS_LABELS, STATUS_TONES as COMMENT_TONES } from "../../client-comments/lib/commentStatus";
import { PriorityPill, TaskStatusPill } from "../../staff-tasks/components/taskUi";
import type {
  DashboardComment,
  DashboardEvent,
  DashboardTask,
  DashboardTaskComment,
  StageGroup,
  TaskStatusCounts,
  WorkloadRow,
} from "../api/dashboardApi";
import { barPercents, dueText, isOverdueText, stageProgress, weekStrip } from "../format";

const ROW = "flex flex-col gap-1 px-5 py-3 transition-colors hover:bg-primary-bg/50 sm:flex-row sm:items-center sm:justify-between sm:gap-3";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-sm text-text-muted">{children}</p>;
}

/** A titled panel: header + body. The title also names the landmark for tests and screen readers. */
export function Panel({ icon, title, subtitle, children }: { icon: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card regionLabel={title} className="min-w-0 overflow-hidden">
      <CardHeader icon={icon} title={title} subtitle={subtitle} />
      {children}
    </Card>
  );
}

export function StatCard({ href, icon, label, value, hint }: { href: string; icon: string; label: string; value: number; hint?: string }) {
  return (
    <Link href={href} aria-label={`${label}: ${value}`} className="block rounded-app-lg outline-none focus-visible:ring-2 focus-visible:ring-gold/70">
      <Card hover className="flex h-full items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-app bg-primary-bg text-primary" aria-hidden>
          <Icon emoji={icon} size={18} />
        </div>
        <div className="min-w-0">
          <div className="figure text-2xl leading-none text-text-primary">{value}</div>
          <div className="mt-1 text-xs text-text-muted">{label}</div>
          {hint && <div className="text-xs text-text-muted">{hint}</div>}
        </div>
      </Card>
    </Link>
  );
}

const STATUS_ORDER: StaffTaskStatus[] = ["todo", "in_progress", "blocked", "done"];

export function TaskStatusCards({ counts }: { counts: TaskStatusCounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
      {STATUS_ORDER.map((s) => (
        <div key={s} className="rounded-app border border-border-light p-3">
          <div className="figure text-xl leading-none text-text-primary">{counts[s]}</div>
          <div className="mt-1 text-xs text-text-muted">{STAFF_TASK_STATUS_LABELS[s]}</div>
        </div>
      ))}
    </div>
  );
}

export function TaskRows({ tasks, zone, showAssignee = false, empty }: { tasks: DashboardTask[]; zone: string; showAssignee?: boolean; empty: string }) {
  if (tasks.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-border-light">
      {tasks.map((t) => {
        const due = dueText(t.dueAt, t.status, zone);
        return (
          <li key={t.id}>
            <Link href={`/app/tasks/${t.id}`} className={ROW}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">{t.title}</p>
                <p className="truncate text-xs text-text-muted">{[t.clientName, showAssignee ? t.assigneeName : null].filter(Boolean).join(" · ") || "No client"}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <PriorityPill priority={t.priority} />
                <TaskStatusPill status={t.status} />
                <span className={`text-xs ${isOverdueText(due) ? "font-semibold text-error" : "text-text-muted"}`}>{due}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function EventRows({ events, zone, empty }: { events: DashboardEvent[]; zone: string; empty: string }) {
  if (events.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-border-light">
      {events.map((e) => (
        <li key={e.id}>
          <Link href={`/app/events/${e.id}`} className={ROW}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{e.title}</p>
              <p className="truncate text-xs text-text-muted">
                {e.clientName} · {EVENT_TYPE_LABELS[e.type]} · {formatInZone(e.startsAt, zone)}
              </p>
            </div>
            <div className="shrink-0">
              <StatusPill label={stageProgress(e)} tone="purple" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CommentRows({ comments, zone, empty }: { comments: DashboardComment[]; zone: string; empty: string }) {
  if (comments.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-border-light">
      {comments.map((c) => (
        <li key={c.id}>
          <Link href={`/app/comments?commentId=${c.id}`} className={ROW}>
            <div className="min-w-0">
              <p className="truncate text-sm text-text-primary">{c.excerpt}</p>
              <p className="truncate text-xs text-text-muted">
                {c.clientName}
                {c.eventTitle ? ` · ${c.eventTitle}` : ""} · {formatInZone(c.createdAt, zone)}
              </p>
            </div>
            <div className="shrink-0">
              <StatusPill label={COMMENT_STATUS_LABELS[c.status]} tone={COMMENT_TONES[c.status]} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TaskCommentRows({ comments, zone }: { comments: DashboardTaskComment[]; zone: string }) {
  if (comments.length === 0) return <Empty>No comments on your tasks yet.</Empty>;
  return (
    <ul className="divide-y divide-border-light">
      {comments.map((c) => (
        <li key={c.id}>
          <Link href={`/app/tasks/${c.taskId}`} className={ROW}>
            <div className="min-w-0">
              <p className="truncate text-sm text-text-primary">{c.comment}</p>
              <p className="truncate text-xs text-text-muted">
                {c.authorName ?? "Someone"} on {c.taskTitle} · {formatInZone(c.createdAt, zone)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Seven day cells from today: the weekday, the date and the count of events on that day. */
export function WeekStrip({ today, events, zone }: { today: string; events: DashboardEvent[]; zone: string }) {
  const days = weekStrip(today, events, zone);
  return (
    <ol className="grid grid-cols-7 gap-1.5 p-4 sm:gap-2 sm:p-5">
      {days.map(({ day, count }, i) => {
        const [wd, d] = formatDayLabel(day).split(" ");
        return (
          <li key={day} data-day={day} className={`flex min-w-0 flex-col items-center rounded-app border py-2 ${i === 0 ? "border-gold bg-gold-bg" : "border-border-light"}`}>
            <span className="text-[10px] uppercase tracking-wide text-text-muted sm:text-xs">{wd}</span>
            <span className="text-sm font-semibold text-text-primary">{d}</span>
            <span className={`mt-1 text-xs ${count ? "font-semibold text-primary" : "text-text-muted"}`} aria-label={`${count} events`}>
              {count || "·"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function StageBars({ groups }: { groups: StageGroup[] }) {
  if (groups.length === 0) return <Empty>No active events in progress.</Empty>;
  const widths = barPercents(groups.map((g) => g.count));
  return (
    <ul className="flex flex-col gap-3 p-5">
      {groups.map((g, i) => (
        <li key={g.stageName}>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="truncate text-text-secondary">{g.stageName}</span>
            <span className="font-semibold text-text-primary">{g.count}</span>
          </div>
          <div className="h-2 rounded-full bg-primary-bg" aria-hidden>
            <div className="gradient-primary h-2 rounded-full" style={{ width: `${widths[i]}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TeamWorkload({ rows }: { rows: WorkloadRow[] }) {
  if (rows.length === 0) return <Empty>No active team members yet.</Empty>;
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-light text-left text-xs text-text-muted">
              <th className="px-5 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 text-right font-medium">Open</th>
              <th className="px-3 py-2 text-right font-medium">Overdue</th>
              <th className="px-5 py-2 text-right font-medium">Done this week</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {rows.map((r) => (
              <tr key={r.userId}>
                <td className="px-5 py-2.5 font-semibold text-text-primary">{r.name}</td>
                <td className="px-3 py-2.5 text-text-secondary">{ROLE_LABELS[r.role]}</td>
                <td className="px-3 py-2.5 text-right">{r.open}</td>
                <td className={`px-3 py-2.5 text-right ${r.overdue ? "font-semibold text-error" : ""}`}>{r.overdue}</td>
                <td className="px-5 py-2.5 text-right">{r.doneThisWeek}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-border-light sm:hidden">
        {rows.map((r) => (
          <li key={r.userId} className="px-5 py-3">
            <p className="text-sm font-semibold text-text-primary">{r.name}</p>
            <p className="text-xs text-text-muted">{ROLE_LABELS[r.role]}</p>
            <p className="mt-1 text-xs text-text-secondary">
              Open {r.open} · <span className={r.overdue ? "font-semibold text-error" : ""}>Overdue {r.overdue}</span> · Done this week {r.doneThisWeek}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
