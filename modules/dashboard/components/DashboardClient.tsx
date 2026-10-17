"use client";

import { useEffect, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { dashboardApi, type ClientsSection, type Dashboard, type TasksSection } from "../api/dashboardApi";
import { totalTasks } from "../format";
import { CommentRows, EventRows, Panel, StageBars, StatCard, TaskCommentRows, TaskRows, TaskStatusCards, TeamWorkload, WeekStrip } from "./widgets";

/**
 * /app: the role dashboard (FR-DSH-01..03), one read of GET /dashboard.
 * Admin: firm totals and lists, then their own clients and tasks. SMM / MM:
 * own clients and tasks. Everyone else: tasks only.
 */
export function DashboardClient() {
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ key: number; data?: Dashboard; error?: string } | null>(null);
  const current = result?.key === reload ? result : null;

  useEffect(() => {
    let cancelled = false;
    const forKey = reload;
    dashboardApi
      .get()
      .then((data) => !cancelled && setResult({ key: forKey, data }))
      .catch((e: unknown) => !cancelled && setResult({ key: forKey, error: e instanceof Error ? e.message : "Could not load the dashboard." }));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="mt-2 text-sm text-text-muted">Your day at a glance.</p>
      </div>
      {current?.error ? (
        <Card className="p-5 text-sm">
          <p role="alert" className="text-error">
            {current.error}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => setReload((n) => n + 1)}>
            Try again
          </Button>
        </Card>
      ) : !current?.data ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading dashboard">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20 rounded-app-lg" />
            ))}
          </div>
          <div className="skeleton h-48 rounded-app-lg" />
          <div className="skeleton h-48 rounded-app-lg" />
        </div>
      ) : (
        <DashboardView data={current.data} />
      )}
    </div>
  );
}

function DashboardView({ data }: { data: Dashboard }) {
  const zone = data.window.timeZone;
  const { firm, clients, tasks } = data;
  return (
    <>
      {firm && (
        <section aria-labelledby="firm-h" className="flex flex-col gap-4">
          <h2 id="firm-h" className="font-serif text-xl text-text-primary">
            Firm
          </h2>
          <div aria-label="Firm totals" role="group" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard href="/app/clients" icon="users" label="Clients" value={firm.totals.clients} />
            <StatCard href="/app/calendar" icon="calendar" label="Active events" value={firm.totals.activeEvents} />
            <StatCard href="/app/tasks" icon="clipboard" label="Open tasks" value={firm.totals.openTasks} />
            <StatCard href="/app/comments" icon="message" label="Unresolved comments" value={firm.totals.unresolvedComments} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel icon="bar-chart" title="Firm tasks by status" subtitle={`${totalTasks(firm.tasksByStatus)} tasks in total`}>
              <TaskStatusCards counts={firm.tasksByStatus} />
            </Panel>
            <Panel icon="alert" title="Overdue tasks">
              <TaskRows tasks={firm.overdueTasks} zone={zone} showAssignee empty="Nothing is overdue." />
            </Panel>
            <Panel icon="calendar" title="This week's firm events">
              <EventRows events={firm.week} zone={zone} empty="No events this week." />
            </Panel>
            <Panel icon="message" title="Latest unresolved comments">
              <CommentRows comments={firm.latestComments} zone={zone} empty="No unresolved comments." />
            </Panel>
          </div>
          <Panel icon="users" title="Team workload" subtitle="Active staff">
            <TeamWorkload rows={firm.team} />
          </Panel>
        </section>
      )}
      {clients && <ClientsBlock clients={clients} today={data.window.today} zone={zone} />}
      <TasksBlock tasks={tasks} zone={zone} />
    </>
  );
}

function ClientsBlock({ clients, today, zone }: { clients: ClientsSection; today: string; zone: string }) {
  const { received, inProgress } = clients.unresolvedComments;
  return (
    <section aria-labelledby="clients-h" className="flex flex-col gap-4">
      <h2 id="clients-h" className="font-serif text-xl text-text-primary">
        My clients
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard href="/app/clients" icon="users" label="My clients" value={clients.clientCount} />
        <StatCard href="/app/comments" icon="message" label="Unresolved comments" value={received + inProgress} hint={`${received} received · ${inProgress} in progress`} />
        <StatCard href="/app/calendar" icon="calendar" label="Today's events" value={clients.today.length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon="calendar" title="Today's events">
          <EventRows events={clients.today} zone={zone} empty="No events today." />
        </Panel>
        <Panel icon="calendar-clock" title="Next 7 days">
          <WeekStrip today={today} events={[...clients.today, ...clients.upcoming]} zone={zone} />
        </Panel>
        <Panel icon="clock" title="Upcoming events">
          <EventRows events={clients.upcoming} zone={zone} empty="Nothing coming up this week." />
        </Panel>
        <Panel icon="bar-chart" title="Events by stage">
          <StageBars groups={clients.byStage} />
        </Panel>
      </div>
      <Panel icon="message" title="Latest comments" subtitle="From your clients">
        <CommentRows comments={clients.latestComments} zone={zone} empty="No unresolved comments from your clients." />
      </Panel>
    </section>
  );
}

function TasksBlock({ tasks, zone }: { tasks: TasksSection; zone: string }) {
  return (
    <section aria-labelledby="tasks-h" className="flex flex-col gap-4">
      <h2 id="tasks-h" className="font-serif text-xl text-text-primary">
        My tasks
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard href="/app/tasks" icon="clipboard" label="To do" value={tasks.counts.todo} />
        <StatCard href="/app/tasks" icon="refresh" label="In progress" value={tasks.counts.in_progress} />
        <StatCard href="/app/tasks" icon="clock" label="Due today" value={tasks.dueToday} />
        <StatCard href="/app/tasks" icon="alert" label="Overdue" value={tasks.overdue} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon="clipboard" title="Open tasks" subtitle={`${tasks.counts.blocked} blocked · ${tasks.counts.done} done`}>
          <TaskRows tasks={tasks.open} zone={zone} empty="You have no open tasks." />
        </Panel>
        <Panel icon="message" title="Recent comments on my tasks">
          <TaskCommentRows comments={tasks.recentComments} zone={zone} />
        </Panel>
      </div>
    </section>
  );
}
