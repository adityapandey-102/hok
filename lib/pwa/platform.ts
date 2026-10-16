/**
 * How "Install the app" works on this device. Pure (inputs come from
 * `navigator`), so it is unit-tested.
 *
 * - `installed`: already running as an installed app; show nothing.
 * - `ios`: iPhone/iPad Safari has no install prompt; staff must use
 *   Share → Add to Home Screen (and web push on iOS 16.4+ only works there).
 * - `prompt`: Chrome/Edge/Android, which fire `beforeinstallprompt`; a button
 *   can open the browser's own install dialog.
 */
export type InstallMode = "installed" | "ios" | "prompt";

export interface InstallEnvironment {
  userAgent: string;
  /** navigator.maxTouchPoints: iPadOS 13+ reports itself as a Mac with touch. */
  maxTouchPoints: number;
  /** matchMedia("(display-mode: standalone)").matches, or iOS's navigator.standalone. */
  standalone: boolean;
}

export function isIos({ userAgent, maxTouchPoints }: Pick<InstallEnvironment, "userAgent" | "maxTouchPoints">): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function installMode(env: InstallEnvironment): InstallMode {
  if (env.standalone) return "installed";
  return isIos(env) ? "ios" : "prompt";
}
