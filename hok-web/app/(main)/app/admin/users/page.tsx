import { redirect } from "next/navigation";
import { hasCapability } from "../../../../../lib/domain";
import { apiFetchServer } from "../../../../../lib/api/server";
import UserManagementClient from "../../../../../modules/admin-users/components/UserManagementClient";

export default async function UserManagementPage() {
  const { profile } = await apiFetchServer("/auth/me");
  if (!hasCapability(profile.role, "users:manage")) redirect("/app");
  return <UserManagementClient />;
}
