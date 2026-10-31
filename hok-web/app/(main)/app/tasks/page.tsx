import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { TasksPageClient } from "../../../../modules/staff-tasks/components/TasksPageClient";
import type { DueFilter, TaskFilterState } from "../../../../modules/staff-tasks/components/taskFilters";

const DUE: DueFilter[] = ["overdue", "today", "week"];
const STATUS: TaskFilterState["status"][] = ["todo", "in_progress", "blocked", "done", "all"];

/**
 * Staff tasks (M7): "My tasks" for everyone, the Admin's list + Kanban for the
 * Admin. Links can open it pre-filtered (the dashboard's "View all"):
 * `?due=overdue|today|week`, `?status=todo|in_progress|blocked|done|all`, and for
 * the Admin `?assigneeId=…&assignee=Name`.
 */
export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "staff_tasks:read")) redirect("/app");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? sp[k] : undefined);
  const due = DUE.find((d) => d === one("due"));
  const status = STATUS.find((st) => st === one("status"));
  const isAdmin = profile.role === "admin";
  const assigneeId = isAdmin && /^[0-9a-f-]{36}$/i.test(one("assigneeId") ?? "") ? one("assigneeId") : undefined;
  return (
    <TasksPageClient
      isAdmin={isAdmin}
      zone={profile.timeZone}
      initialFilters={{ ...(due ? { due } : {}), ...(status ? { status } : {}), ...(assigneeId ? { assigneeId } : {}) }}
      initialAssigneeName={assigneeId ? one("assignee") : undefined}
    />
  );
}
