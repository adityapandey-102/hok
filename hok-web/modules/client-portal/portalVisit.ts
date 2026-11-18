import { useEffect, useState } from "react";
import { visitKey } from "./portalLogic";

/**
 * "New" files are those shared since this browser last opened the portal (round 5). The last visit
 * lives in localStorage under a hash of the token (never the token itself). Every read and write is
 * guarded: private windows and blocked storage just mean no "New" pills.
 */
export function readLastVisit(token: string): number | null {
  try {
    const raw = window.localStorage.getItem(visitKey(token));
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeLastVisit(token: string, at: number = Date.now()): void {
  try {
    window.localStorage.setItem(visitKey(token), String(at));
  } catch {
    // storage unavailable: nothing to remember
  }
}

/**
 * The previous visit's time, fixed for this page view (so "New" pills stay while you read). Today's
 * visit is saved after 5 seconds, or when the page is left.
 */
export function useLastVisit(token: string): number | null {
  const [last] = useState<number | null>(() => readLastVisit(token));
  useEffect(() => {
    const save = () => writeLastVisit(token);
    const timer = setTimeout(save, 5000);
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [token]);
  return last;
}
