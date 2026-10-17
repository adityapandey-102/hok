"use client";

import { useEffect, useState } from "react";
import { Panel } from "../../../components/ui/Panel";
import { Loader } from "../../../components/ui/Loader";
import { useToast } from "../../../components/ui/Toast";
import {
  notificationsApi,
  type NotificationPreference,
} from "../api/notificationsApi";
import { PushPrompt } from "./PushPrompt";

/** Per-trigger in-app / push toggles. Mount in My profile. */
export function NotificationPreferences() {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPreference[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    notificationsApi
      .getPreferences()
      .then((r) => setPrefs(r.preferences))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load preferences",
        ),
      );
  }, []);

  async function change(
    p: NotificationPreference,
    next: { push: boolean; inApp: boolean },
  ) {
    if (!prefs) return;
    const before = prefs;
    setPrefs(prefs.map((x) => (x.type === p.type ? { ...x, ...next } : x)));
    setSaving(true);
    try {
      const res = await notificationsApi.updatePreferences([
        { type: p.type, ...next },
      ]);
      setPrefs(res.preferences);
    } catch (err) {
      setPrefs(before);
      showToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel icon="bell" title="Notifications" subtitle="Choose what reaches you, in the bell and as push.">
      <div className="space-y-4 px-5 pb-5">
        <PushPrompt />
        {error ? (
          <p className="text-sm text-error">{error}</p>
        ) : !prefs ? (
          <div className="flex justify-center py-4">
            <Loader label="Loading preferences" />
          </div>
        ) : prefs.length === 0 ? (
          <p className="text-sm text-text-muted">No notification types yet.</p>
        ) : (
          <ul className="divide-y divide-border-light">
            {prefs.map((p) => (
              <li
                key={p.type}
                className="flex flex-col gap-2.5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">
                    {p.label}
                  </p>
                  <p className="text-xs text-text-muted">{p.description}</p>
                </div>
                <div className="flex shrink-0 gap-2 text-sm text-text-secondary">
                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-app px-3 ring-1 ring-border ring-inset transition-colors hover:bg-accent-bg">
                    <input
                      className="h-4 w-4"
                      type="checkbox"
                      checked={p.inApp}
                      disabled={saving}
                      aria-label={`${p.label}: in-app`}
                      onChange={(e) =>
                        change(p, {
                          inApp: e.target.checked,
                          push: e.target.checked ? p.push : false,
                        })
                      }
                    />
                    In-app
                  </label>
                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-app px-3 ring-1 ring-border ring-inset transition-colors hover:bg-accent-bg">
                    <input
                      className="h-4 w-4"
                      type="checkbox"
                      checked={p.push}
                      disabled={saving || !p.inApp}
                      aria-label={`${p.label}: push`}
                      onChange={(e) =>
                        change(p, { inApp: p.inApp, push: e.target.checked })
                      }
                    />
                    Push
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
