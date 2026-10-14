import { Card } from "../../../components/ui/Card";

/**
 * Staff landing page. The role dashboards arrive in M10; until then this page
 * only confirms the session and the shell work.
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="mt-2 text-sm text-text-muted">Welcome to HOK. Your workspace fills in as each part of the app is built.</p>
      </div>
      <Card accent className="p-6">
        <p className="text-sm text-text-secondary">
          Clients, events, calendars, asset links, the client portal and team tasks will appear here.
        </p>
      </Card>
    </div>
  );
}
