import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { TasksPageClient } from "../../../../modules/staff-tasks/components/TasksPageClient";

/** Staff tasks (M7): "My tasks" for everyone, the Admin's list + Kanban for the Admin. */
export default async function TasksPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "staff_tasks:read")) redirect("/app");
  return <TasksPageClient isAdmin={profile.role === "admin"} zone={profile.timeZone} />;
}
