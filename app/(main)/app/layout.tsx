import { redirect } from "next/navigation";
import type { Profile } from "../../../lib/domain";
import { apiFetchServer } from "../../../lib/api/server";
import { AppShell } from "../../../components/shell/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let profile: Profile;
  try {
    const data = await apiFetchServer("/auth/me");
    profile = data.profile;
  } catch {
    // The session can't be validated (expired, or revoked server-side but not
    // yet locally expired). Route through the logout endpoint so the cookies
    // are CLEARED before landing on /login -- a plain redirect("/login") would
    // leave the stale-but-unexpired token in place and proxy.ts would bounce
    // /login -> /app in an infinite loop. See app/api/session/logout GET.
    redirect("/api/session/logout");
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
