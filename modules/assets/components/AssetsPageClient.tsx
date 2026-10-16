"use client";

import { AssetsPanel } from "./AssetsPanel";

/** /app/assets: the asset link library across every client the viewer can see (Admin: all; a manager: their own). */
export function AssetsPageClient({ isAdmin, viewerTimeZone }: { isAdmin: boolean; viewerTimeZone: string }) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="page-title">Assets</h1>
        <p className="text-sm text-text-muted">
          {isAdmin ? "Every client's asset links." : "Asset links across your clients."} Links only; files stay in Drive, Dropbox and friends.
        </p>
      </div>
      <AssetsPanel viewerTimeZone={viewerTimeZone} />
    </div>
  );
}
