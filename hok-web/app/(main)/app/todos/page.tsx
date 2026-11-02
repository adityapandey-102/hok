import { redirect } from "next/navigation";
import { hasCapability } from "../../../../lib/domain";
import { apiFetchServer } from "../../../../lib/api/server";
import { TodosPageClient } from "../../../../modules/todos/components/TodosPageClient";

/** My to-dos (round 1): the caller's own private list, for every role. */
export default async function TodosPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "todos:manage")) redirect("/app");
  return <TodosPageClient zone={profile.timeZone} />;
}
