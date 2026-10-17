import { apiFetchServer } from "../../../../lib/api/server";
import { ProfileForm } from "../../../../modules/auth/components/ProfileForm";
import { NotificationPreferences } from "../../../../modules/notifications/components/NotificationPreferences";

export default async function ProfilePage() {
  const { profile } = await apiFetchServer("/auth/me");
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="page-title">My profile</h1>
      <p className="mb-5 text-sm text-text-muted">Update your name, phone, time zone and notifications.</p>
      <ProfileForm profile={profile} />
      <div className="mt-8">
        <NotificationPreferences />
      </div>
    </div>
  );
}
