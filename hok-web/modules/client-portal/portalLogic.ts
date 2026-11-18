import type { PortalAsset, PortalStage } from "./api/publicPortalApi";

/** Pure rules behind the portal's overview (round 5): tabs in the URL hash, "New" files, grouping files by step, relative dates. */

export type PortalTabId = "overview" | "calendar" | "messages";
export const PORTAL_TABS: readonly { id: PortalTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "calendar", label: "Calendar" },
  { id: "messages", label: "Messages" },
];

/** `#calendar` -> calendar; anything else (empty, `#overview`, junk) -> the overview. */
export function tabFromHash(hash: string): PortalTabId {
  const id = hash.replace(/^#/, "");
  return PORTAL_TABS.some((t) => t.id === id) ? (id as PortalTabId) : "overview";
}

/** Where the event view should scroll to when it opens. */
export type PortalFocus = "approval" | "files" | "comment" | { step: number };

/** A file is "New" when it was shared after this browser's last visit. Without a last visit (first time, or no storage) nothing is marked. */
export function isNewFile(createdAt: string, lastVisit: number | null): boolean {
  if (lastVisit === null) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && t > lastVisit;
}

/**
 * The green "files shared" tag ripples when something new is there: files newer than this browser's
 * last visit; when the last visit is unknown (first time, no storage) it ripples on every tag.
 */
export function shouldRipple(latestFileAt: string | null, lastVisit: number | null): boolean {
  if (!latestFileAt) return false;
  return lastVisit === null ? true : isNewFile(latestFileAt, lastVisit);
}

/** A short, non-cryptographic hash (cyrb53) so the storage key never holds the token itself. */
export function visitKey(token: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < token.length; i++) {
    const ch = token.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `hok-portal-visit-${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)}`;
}

export interface FileGroup {
  /** DOM-safe key: `step-3` or `other`. */
  key: string;
  step: number | null;
  /** "Step 3 · Edit", or "Other files". */
  title: string;
  files: PortalAsset[];
}

/**
 * Groups an event's shared files by step: the step awaiting approval first, then the current step,
 * then the rest in step order; files without a step go last under "Other files".
 */
export function groupFilesByStep(assets: PortalAsset[], stages: PortalStage[], awaitingPosition: number | null, currentPosition: number): FileGroup[] {
  const byStep = new Map<number, PortalAsset[]>();
  const other: PortalAsset[] = [];
  for (const a of assets) {
    if (a.stagePosition === null || a.stagePosition === undefined) other.push(a);
    else byStep.set(a.stagePosition, [...(byStep.get(a.stagePosition) ?? []), a]);
  }
  const rank = (p: number) => (p === awaitingPosition ? 0 : p === currentPosition ? 1 : 2);
  const groups: FileGroup[] = [...byStep.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a - b)
    .map(([position, files]) => {
      const name = stages.find((s) => s.position === position)?.name ?? files.find((f) => f.stageName)?.stageName ?? null;
      return { key: `step-${position}`, step: position, title: name ? `Step ${position} · ${name}` : `Step ${position}`, files };
    });
  if (other.length > 0) groups.push({ key: "other", step: null, title: "Other files", files: other });
  return groups;
}

/** The DOM id the event view scrolls to for a focus, or null when there is nothing to show. */
export function focusTargetId(focus: PortalFocus | undefined, hasApproval: boolean, groups: FileGroup[]): string | null {
  if (!focus) return null;
  if (focus === "approval") return hasApproval ? "pe-approval" : groups.length > 0 ? "pe-files" : null;
  if (focus === "comment") return "pe-comment";
  if (focus === "files") return groups.length > 0 ? "pe-files" : null;
  return groups.some((g) => g.step === focus.step) ? `pe-step-${focus.step}` : groups.length > 0 ? "pe-files" : null;
}

/** Only http(s) links are opened from the portal. */
export function safeHttpUrl(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}
