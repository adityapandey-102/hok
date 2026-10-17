"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/Toast";
import { notificationsApi } from "../api/notificationsApi";
import { registerServiceWorker } from "../registerServiceWorker";
import { urlBase64ToUint8Array } from "../format";

type State = "checking" | "hidden" | "off" | "on" | "denied";

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * "Turn on push on this device" -- a button, never an automatic prompt. The
 * browser permission dialog only appears after the user clicks. Hidden when the
 * browser or the server (no VAPID keys) cannot do push.
 */
export function PushPrompt({ className = "" }: { className?: string }) {
  const { showToast } = useToast();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported()) return; // stays "checking": renders nothing
    let cancelled = false;
    (async () => {
      try {
        const cfg = await notificationsApi.pushConfig();
        if (cancelled) return;
        if (!cfg.enabled || !cfg.publicKey) return setState("hidden");
        if (Notification.permission === "denied") return setState("denied");
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled)
          setState(sub && Notification.permission === "granted" ? "on" : "off");
      } catch {
        if (!cancelled) setState("hidden");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        (await notificationsApi.pushConfig()).publicKey;
      if (!publicKey) throw new Error("Push is not configured");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg =
        (await registerServiceWorker()) ??
        (await navigator.serviceWorker.ready);
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth)
        throw new Error("The browser returned an incomplete subscription");
      await notificationsApi.subscribePush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent.slice(0, 400),
      });
      setState("on");
      showToast("Push notifications are on for this device.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not turn on push",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await notificationsApi.unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      showToast("Push notifications are off for this device.", "info");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not turn off push",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  if (state === "checking" || state === "hidden") return null;

  return (
    <div
      className={`flex items-center justify-between gap-3 text-xs text-text-secondary ${className}`}
    >
      {state === "denied" ? (
        <span>
          Push is blocked in this browser. Allow notifications in the site
          settings to turn it on.
        </span>
      ) : state === "on" ? (
        <>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="check-circle" size={14} /> Push is on for this device
          </span>
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            disabled={busy}
            onClick={disable}
          >
            Turn off
          </Button>
        </>
      ) : (
        <>
          <span>Get alerts even when HOK is closed.</span>
          <Button
            variant="outline"
            className="px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={enable}
          >
            <Icon name="bell" size={14} />{" "}
            {busy ? "Turning on…" : "Turn on push"}
          </Button>
        </>
      )}
    </div>
  );
}
