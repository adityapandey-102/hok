import { notFound, redirect } from "next/navigation";
import { hasCapability } from "../../../../../lib/domain";
import { apiFetchServer, ApiError } from "../../../../../lib/api/server";
import { TaskDetailClient } from "../../../../../modules/staff-tasks/components/TaskDetailClient";

export default async function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "staff_tasks:read")) redirect("/app");

  // Someone else's task and an unknown id are both a 404 from the API.
  const result = await apiFetchServer(`/staff-tasks/${taskId}`).catch((err: unknown) => {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  });

  return <TaskDetailClient initialTask={result.task} isAdmin={profile.role === "admin"} viewerId={profile.id} zone={profile.timeZone} />;
}
