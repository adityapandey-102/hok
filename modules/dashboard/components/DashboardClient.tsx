"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { dashboardApi, type ClientsSection, type Dashboard, type DashboardView, type FirmSection, type TasksSection } from "../api/dashboardApi";
import { greeting, longDate } from "../format";
import { CommentRows, EventRows, HeroBand, Panel, StageBars, StatusBreakdown, TaskCommentRows, TaskRows, TeamRows, WeekStrip, type HeroCell } from "./widgets";

/**
 * /app: the role dashboard (FR-DSH-01..03), one read of GET /dashboard.
 * Every list is a preview of at most five rows with a link to its full,
 * paged page; the hero band holds the numbers that matter and opens them.
 * Admin: the firm (their own clients and tasks are on /app/my-clients, the
 * `mine` view). SMM / MM: their clients and tasks. Everyone else: their tasks.
 */
export function DashboardClient({ firstName, view = "overview" }: { firstName: string; view?: DashboardView }) {
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ key: number; data?: Dashboard; error?: string } | null>(null);
  const current = result?.key === reload ? result : null;

  useEffect(() => {
    let cancelled = false;
    const forKey = reload;
    dashboardApi
      .get(view)
      .then((data) => !cancelled && setResult({ key: forKey, data }))
      .catch((e: unknown) => !cancelled && setResult({ key: forKey, error: e instanceof Error ? e.message : "Could not load the dashboard." }));
    return () => {
      cancelled = true;
    };
  }, [reload, view]);

  const zone = current?.data?.window.timeZone;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        {view === "mine" ? (
          <div>
            <h1 className="page-title">My clients</h1>
            <p className="text-sm text-text-muted">The clients whose team you’re on and the tasks assigned to you.</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-text-muted">{zone ? longDate(zone) : " "}</p>
            <h1 className="page-title mt-1">{zone ? `${greeting(zone)}, ${firstName}` : `Welcome, ${firstName}`}</h1>
          </div>
        )}
      </header>

      {current?.error ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
          <p role="alert" className="text-error">
            {current.error}
          </p>
          <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
            Try again
          </Button>
        </Card>
      ) : !current?.data ? (
        <DashboardSkeleton />
      ) : (
        <DashboardView data={current.data} />
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading dashboard">
      <div className="skeleton h-36 rounded-app-xl" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="skeleton h-72 rounded-app-lg lg:col-span-5" />
        <div className="skeleton h-72 rounded-app-lg lg:col-span-7" />
      </div>
    </div>
  );
}

function DashboardView({ data }: { data: Dashboard }) {
  const zone = data.window.timeZone;
  if (data.firm) return <AdminView firm={data.firm} zone={zone} today={data.window.today} />;
  if (!data.tasks) return null;
  if (data.clients) return <ManagerView clients={data.clients} tasks={data.tasks} zone={zone} today={data.window.today} ownPage={data.view === "mine"} />;
  return <StaffView tasks={data.tasks} zone={zone} />;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------------ Admin */

function AdminView({ firm, zone, today }: { firm: FirmSection; zone: string; today: string }) {
  const t = firm.totals;
  const cells: HeroCell[] = [
    { href: "/app/clients", icon: "briefcase", label: "Clients", value: t.clients, caption: "Active and paused" },
    { href: "/app/calendar", icon: "calendar", label: "Active events", value: t.activeEvents, caption: `${plural(t.weekEvents, "event")} this week` },
    { href: "/app/tasks", icon: "clipboard", label: "Open tasks", value: t.openTasks, caption: `${plural(t.teamSize, "person", "people")} on the team` },
    { href: "/app/tasks?due=overdue", icon: "alert", label: "Overdue", value: t.overdueTasks, caption: t.overdueTasks > 0 ? "Needs a nudge" : "All on time", alert: t.overdueTasks > 0 },
    { href: "/app/comments", icon: "message", label: "Client comments", value: t.unresolvedComments, caption: t.unresolvedComments > 0 ? "Waiting for a reply" : "All answered", alert: t.unresolvedComments > 0 },
  ];
  const week = [...firm.week].slice(0, 5);
  return (
    <>
      <HeroBand cells={cells} label="The firm at a glance" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Panel icon="bar-chart" title="Tasks by status" subtitle="Every staff task, firm-wide" className="lg:col-span-5" footer={{ href: "/app/tasks", label: "Task board" }}>
          <StatusBreakdown counts={firm.tasksByStatus} />
        </Panel>
        <Panel
          icon="alert"
          title="Overdue tasks"
          subtitle={t.overdueTasks > 0 ? "Past their due date, oldest first" : "Nothing is late"}
          className="lg:col-span-7"
          footer={t.overdueTasks > firm.overdueTasks.length ? { href: "/app/tasks?due=overdue", label: `See all ${t.overdueTasks}` } : undefined}
        >
          <TaskRows tasks={firm.overdueTasks} zone={zone} showAssignee empty="No overdue tasks" />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Panel icon="calendar" title="This week" subtitle={`${plural(t.weekEvents, "event")} across all clients`} className="lg:col-span-7" footer={{ href: "/app/calendar", label: "Calendar" }}>
          <WeekStrip today={today} events={firm.week} zone={zone} />
          <EventRows events={week} zone={zone} empty="Nothing scheduled this week" />
        </Panel>
        <Panel
          icon="message"
          title="Client comments"
          subtitle="Waiting for a reply, newest first"
          className="lg:col-span-5"
          footer={{ href: "/app/comments", label: "Inbox" }}
        >
          <CommentRows comments={firm.latestComments} empty="Every comment is answered" />
        </Panel>
      </div>

      <Panel
        icon="users"
        title="Team workload"
        subtitle="The busiest people right now: open work, with the overdue part in red"
        footer={{ href: "/app/team", label: `See all ${t.teamSize}` }}
      >
        <TeamRows rows={firm.team} />
      </Panel>

    </>
  );
}

/* ---------------------------------------------------------------- Manager */

function ManagerView({ clients, tasks, zone, today, ownPage = false }: { clients: ClientsSection; tasks: TasksSection; zone: string; today: string; ownPage?: boolean }) {
  const unresolved = clients.unresolvedComments.received + clients.unresolvedComments.inProgress;
  const openMine = tasks.counts.todo + tasks.counts.in_progress + tasks.counts.blocked;
  const cells: HeroCell[] = [
    { href: "/app/clients", icon: "briefcase", label: "My clients", value: clients.clientCount, caption: "Active and paused" },
    { href: "/app/calendar", icon: "calendar", label: "This week", value: clients.weekEventCount, caption: `${plural(clients.today.length, "event")} today` },
    { href: "/app/comments", icon: "message", label: "Client comments", value: unresolved, caption: `${clients.unresolvedComments.received} new, ${clients.unresolvedComments.inProgress} in progress`, alert: clients.unresolvedComments.received > 0 },
    { href: "/app/tasks", icon: "clipboard", label: "My tasks", value: openMine, caption: tasks.overdue > 0 ? `${tasks.overdue} overdue` : "All on time", alert: tasks.overdue > 0 },
  ];
  return (
    <>
      <HeroBand cells={cells} label="Your work at a glance" />
      <MyClients clients={clients} zone={zone} today={today} titled={!ownPage} />
      <MyTasks tasks={tasks} zone={zone} />
    </>
  );
}

function MyClients({ clients, zone, today, titled = true }: { clients: ClientsSection; zone: string; today: string; titled?: boolean }) {
  const week = [...clients.today, ...clients.upcoming].slice(0, 5);
  return (
    <>
      {titled && <h2 className="mt-2 font-serif text-[19px] text-text-primary">My clients</h2>}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Panel icon="calendar" title="This week" subtitle={plural(clients.weekEventCount, "event")} className="lg:col-span-7" footer={{ href: "/app/calendar", label: "Calendar" }}>
          <WeekStrip today={today} events={[...clients.today, ...clients.upcoming]} zone={zone} />
          <EventRows events={week} zone={zone} empty="Nothing scheduled this week" />
        </Panel>
        <Panel icon="layers" title="Events by stage" subtitle="Where your active events stand" className="lg:col-span-5" footer={{ href: "/app/clients", label: "My clients" }}>
          <StageBars groups={clients.byStage} />
        </Panel>
      </div>
      <Panel icon="message" title="Client comments" subtitle="Waiting for your reply" footer={{ href: "/app/comments", label: "Inbox" }}>
        <CommentRows comments={clients.latestComments} empty="Every comment is answered" />
      </Panel>
    </>
  );
}

/* ------------------------------------------------------------------ Staff */

function StaffView({ tasks, zone }: { tasks: TasksSection; zone: string }) {
  const cells: HeroCell[] = [
    { href: "/app/tasks", icon: "clipboard", label: "To do", value: tasks.counts.todo, caption: "Not started" },
    { href: "/app/tasks", icon: "refresh", label: "In progress", value: tasks.counts.in_progress, caption: tasks.counts.blocked > 0 ? `${tasks.counts.blocked} blocked` : "Moving" },
    { href: "/app/tasks?due=today", icon: "clock", label: "Due today", value: tasks.dueToday, caption: "Before the day ends" },
    { href: "/app/tasks?due=overdue", icon: "alert", label: "Overdue", value: tasks.overdue, caption: tasks.overdue > 0 ? "Past the due date" : "All on time", alert: tasks.overdue > 0 },
  ];
  return (
    <>
      <HeroBand cells={cells} label="Your tasks at a glance" />
      <MyTasks tasks={tasks} zone={zone} />
    </>
  );
}

function MyTasks({ tasks, zone }: { tasks: TasksSection; zone: string }) {
  const open = tasks.counts.todo + tasks.counts.in_progress + tasks.counts.blocked;
  return (
    <>
      <h2 className="mt-2 font-serif text-[19px] text-text-primary">My tasks</h2>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Panel
          icon="clipboard"
          title="Open tasks"
          subtitle="Overdue and soonest due first"
          className="lg:col-span-7"
          footer={{ href: "/app/tasks", label: open > tasks.open.length ? `View all ${open} open tasks` : "Open my tasks" }}
        >
          <TaskRows tasks={tasks.open} zone={zone} empty="You have no open tasks" />
        </Panel>
        <Panel icon="message" title="Comments on my tasks" subtitle="From the people you work with" className="lg:col-span-5">
          <TaskCommentRows comments={tasks.recentComments} />
        </Panel>
      </div>
      {tasks.counts.done > 0 && (
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Icon name="check-circle" size={14} className="text-success" />
          {plural(tasks.counts.done, "task")} done so far
        </p>
      )}
    </>
  );
}
