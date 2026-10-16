"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { installMode, type InstallMode } from "../../../lib/pwa/platform";

/** Chrome's install event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "hok.installHint.dismissed";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * A small, dismissible "Install the app" card for the staff app. Installing
 * matters because web push (M9) on iPhones only works for an installed app.
 *
 * - Chrome / Edge / Android: shown only once the browser says the app can be
 *   installed (`beforeinstallprompt`); the button opens the browser's dialog.
 * - iPhone / iPad: there's no install dialog, so it explains Share → Add to
 *   Home Screen.
 * - Already installed, other browsers, or dismissed: nothing.
 * The dismissal is remembered on this device only.
 */
export function InstallAppHint() {
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    // Reading the device happens once, after mount (the server can't know it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(installMode({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, standalone }));
    setHidden(readDismissed());

    function onBeforeInstall(event: Event) {
      event.preventDefault(); // show our own hint instead of the browser's mini-bar
      setDeferred(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferred(null);
      setMode("installed");
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage blocked (private mode): the hint just comes back next time.
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (hidden || mode === null || mode === "installed") return null;
  if (mode === "prompt" && !deferred) return null;

  return (
    <div
      role="status"
      className="mb-5 flex flex-wrap items-center gap-3 rounded-app-lg border border-border bg-card px-4 py-3 shadow-app print:hidden"
    >
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-text-primary">Install the HOK app</p>
        {mode === "ios" ? (
          <p className="mt-0.5 text-text-secondary">
            Tap <Icon name="share" size={15} className="inline-block align-[-2px]" /> Share, then{" "}
            <span className="font-semibold">Add to Home Screen</span>, to open HOK like an app and get notifications.
          </p>
        ) : (
          <p className="mt-0.5 text-text-secondary">Open HOK like an app from your home screen or desktop.</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {mode === "prompt" && (
          <Button type="button" onClick={install}>
            Install
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={dismiss} aria-label="Dismiss install hint">
          Not now
        </Button>
      </div>
    </div>
  );
}
