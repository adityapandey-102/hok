import { apiFetchServer } from "../../../../lib/api/server";
import { ProfileForm } from "../../../../modules/auth/components/ProfileForm";
import { NotificationPreferences } from "../../../../modules/notifications/components/NotificationPreferences";

export default async function ProfilePage() {
  const { profile } = await apiFetchServer("/auth/me");
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="page-title">My profile</h1>
        <p className="text-sm text-text-muted">Update your name, phone, time zone and notifications.</p>
      </header>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ProfileForm profile={profile} />
        </div>
        <div className="lg:col-span-7">
          <NotificationPreferences />
        </div>
      </div>
    </div>
  );
}
