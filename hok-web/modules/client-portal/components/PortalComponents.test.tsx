import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PortalEventDetail } from "../api/publicPortalApi";
import { PortalFilesTag } from "./PortalFilesTag";
import { PortalEventView } from "./PortalEventModal";

const noop = () => {};

describe("PortalFilesTag", () => {
  it("says '1 file shared' / 'N files shared' in green, as a button", () => {
    const one = renderToStaticMarkup(<PortalFilesTag count={1} ripple={false} onClick={noop} />);
    expect(one).toContain("1 file shared");
    expect(one).toContain("<button");
    expect(one).toContain("bg-success-bg");
    expect(renderToStaticMarkup(<PortalFilesTag count={3} ripple={false} onClick={noop} />)).toContain("3 files shared");
  });
  it("ripples only when asked", () => {
    expect(renderToStaticMarkup(<PortalFilesTag count={2} ripple onClick={noop} />)).toContain("file-tag-ripple");
    expect(renderToStaticMarkup(<PortalFilesTag count={2} ripple={false} onClick={noop} />)).not.toContain("file-tag-ripple");
  });
});

const stages = [1, 2, 3, 4].map((p) => ({ position: p, name: ["Brief", "Shoot", "Edit", "Final"][p - 1]! }));
const asset = (id: string, stagePosition: number | null) => ({ id, title: `File ${id}`, url: `https://drive.test/${id}`, type: "video", stageName: stagePosition ? stages[stagePosition - 1]!.name : null, stagePosition, createdAt: "2026-11-17T10:00:00Z" });
const event = (over: Partial<PortalEventDetail> = {}): PortalEventDetail => ({
  id: "e1",
  title: "Brand shoot",
  type: "shoot",
  startsAt: "2026-11-20T04:30:00Z",
  endsAt: "2026-11-20T06:30:00Z",
  timeZone: "Asia/Kolkata",
  location: null,
  state: "active",
  stages,
  currentStagePosition: 2,
  stageCount: 4,
  awaitingYourApproval: true,
  approvalStagePosition: 3,
  fileCount: 3,
  fileStages: [
    { position: 2, count: 1 },
    { position: 3, count: 1 },
  ],
  latestFileAt: "2026-11-17T10:00:00Z",
  updates: [{ stageName: "Shoot", note: "All set", createdAt: "2026-11-16T10:00:00Z" }],
  pendingApproval: { id: "ap1", version: 1, stageName: "Edit", requestNote: null, requestLink: null, requestedAt: "2026-11-17T10:00:00Z" },
  approvalHistory: [],
  assets: [asset("a", 2), asset("b", 3), asset("c", null)],
  ...over,
});
const view = (e: PortalEventDetail, extra: Partial<Parameters<typeof PortalEventView>[0]> = {}) =>
  renderToStaticMarkup(<PortalEventView event={e} token="t" zone="Asia/Kolkata" onDecided={noop} onStale={noop} onClose={noop} {...extra} />);

describe("PortalEventView order", () => {
  it("reads: your action, shared with you, progress, updates, approval history", () => {
    const html = view(event({ approvalHistory: [{ stageName: "Brief", status: "approved", decidedVia: "portal", decidedAt: "2026-11-10T10:00:00Z", decisionComment: null }] }));
    const at = (s: string) => html.indexOf(s);
    expect(at("Your action")).toBeGreaterThan(-1);
    expect(at("Your action")).toBeLessThan(at('aria-label="Shared with you"'));
    expect(at('aria-label="Shared with you"')).toBeLessThan(at('aria-label="Progress"'));
    expect(at('aria-label="Progress"')).toBeLessThan(at('aria-label="Updates"'));
    expect(at('aria-label="Updates"')).toBeLessThan(at("Approval history"));
    expect(at("Approval history")).toBeLessThan(at('aria-label="Comments on this event"'));
  });

  it("shows a green files tag in the header, rippling for files newer than the last visit", () => {
    const html = view(event());
    expect(html).toContain("3 files shared");
    expect(html).toContain("file-tag-ripple"); // no last visit known: every tag ripples
    expect(view(event(), { lastVisit: Date.parse("2026-11-18T00:00:00Z") })).not.toContain("file-tag-ripple");
    expect(view(event({ assets: [], fileCount: 0, fileStages: [], latestFileAt: null }))).not.toContain("files shared");
  });

  it("has a Comment chip in the header and a composer for this event", () => {
    const html = view(event());
    expect(html).toMatch(/<\/svg> Comment<\/button>/);
    expect(html).toContain("Write a comment about Brand shoot…");
    expect(html).toContain("portal-sheet-bar");
  });

  it("groups files by step: the awaiting step, then the current one, then other files last", () => {
    const html = view(event());
    const at = (s: string) => html.indexOf(s);
    expect(at("Step 3 · Edit")).toBeLessThan(at("Step 2 · Shoot"));
    expect(at("Step 2 · Shoot")).toBeLessThan(at("Other files"));
    expect(html).toContain('target="_blank"');
  });

  it("leaves out the action and the files section when there are none", () => {
    const html = view(event({ pendingApproval: null, awaitingYourApproval: false, approvalStagePosition: null, assets: [], fileCount: 0, fileStages: [] }));
    expect(html).not.toContain("Your action");
    expect(html).not.toContain("Shared with you");
  });

  it("folds the approval history away when it has more than 3 entries", () => {
    const entry = { stageName: "Brief", status: "approved" as const, decidedVia: "portal" as const, decidedAt: "2026-11-10T10:00:00Z", decisionComment: null };
    expect(view(event({ approvalHistory: [entry, entry, entry] }))).toContain('<details open=""');
    expect(view(event({ approvalHistory: [entry, entry, entry, entry] }))).not.toContain('<details open=""');
  });

  it("shows the amber ring on the awaiting step and the file counts in its progress", () => {
    const html = view(event());
    expect(html).toContain("ring-warning");
    expect(html).toContain('aria-label="1 file"');
  });
});
