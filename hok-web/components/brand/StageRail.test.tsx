import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StageRail, type RailStage } from "./StageRail";

const stages = (n: number): RailStage[] => Array.from({ length: n }, (_, i) => ({ key: `s${i + 1}`, name: `Stage name ${i + 1}` }));

describe("StageRail", () => {
  it("renders all 13 stage names (grid on tablets and up, list inside the dropdown on phones)", () => {
    const html = renderToStaticMarkup(<StageRail stages={stages(13)} currentIndex={4} />);
    for (let i = 1; i <= 13; i++) expect(html).toContain(`>Stage name ${i}<`);
    expect(html).toContain("<details");
    expect(html).toContain("--rail-lg:7");
  });

  it("uses the grid (never a squeezed row) even with few, long-named stages, one column per stage", () => {
    const html = renderToStaticMarkup(<StageRail stages={stages(6)} currentIndex={0} />);
    expect(html).toContain("sm:grid");
    expect(html).toContain("--rail-sm:4;--rail-lg:6");
    expect(html).not.toContain("sm:flex-row");
  });

  it("shows the phone summary as 'Stage 5 of 13' with the current name", () => {
    const html = renderToStaticMarkup(<StageRail stages={stages(13)} currentIndex={4} />);
    expect(html).toContain("Stage 5 of 13");
    expect(html).toContain('aria-label="Stages: Stage name 5 (Stage 5 of 13)"');
    expect(html).toContain('aria-current="step"');
  });

  it("says 'All 13 stages done' when finished, and 'Step' for the portal", () => {
    expect(renderToStaticMarkup(<StageRail stages={stages(13)} currentIndex={13} />)).toContain("All 13 stages done");
    expect(renderToStaticMarkup(<StageRail stages={stages(13)} currentIndex={2} unit="Step" />)).toContain("Step 3 of 13");
  });

  it("keeps a short list as a plain list with no dropdown", () => {
    const html = renderToStaticMarkup(<StageRail stages={stages(4)} currentIndex={1} />);
    expect(html).not.toContain("<details");
    expect(html).toContain("flex flex-col sm:hidden"); // the phone list
    expect(html).toContain("sm:grid"); // the grid from 640px
  });

  it("uses the grid plus a phone dropdown for 5 to 6 stages", () => {
    const html = renderToStaticMarkup(<StageRail stages={stages(6)} currentIndex={0} />);
    expect(html).toContain("<details");
    expect(html).toContain("sm:grid");
    expect(html).not.toContain("sm:flex-row");
  });

  it("shows the approval ring and chip, and the file count, plus the summary chips", () => {
    const withHighlights = stages(13).map((s, i) => (i === 4 ? { ...s, highlight: "approval" as const, files: 2 } : i === 6 ? { ...s, highlight: "files" as const, files: 1 } : s));
    const html = renderToStaticMarkup(<StageRail stages={withHighlights} currentIndex={4} unit="Step" />);
    expect(html).toContain("ring-warning");
    expect(html).toContain("Your approval");
    expect(html).toContain('aria-label="2 files"');
    expect(html).toContain('aria-label="1 file"');
    expect(html).toContain("Needs your approval");
    expect(html).toContain("3 files shared");
    expect(html).toContain("bg-success text-on-ink"); // green file badges in the portal
    const staff = renderToStaticMarkup(<StageRail stages={withHighlights} currentIndex={4} />);
    expect(staff).toContain("bg-primary text-white"); // crimson on staff pages
  });

  it("says 'Approval' and 'Needs approval' on staff pages", () => {
    const html = renderToStaticMarkup(<StageRail stages={stages(8).map((s, i) => (i === 1 ? { ...s, highlight: "approval" as const } : s))} currentIndex={1} />);
    expect(html).toContain(">Approval<");
    expect(html).toContain("Needs approval");
    expect(html).not.toContain("Your approval");
  });

  it("makes every stage a button when onStageClick is given", () => {
    const html = renderToStaticMarkup(<StageRail stages={stages(3)} currentIndex={0} onStageClick={() => {}} />);
    // Each stage is a button in the grid (≥ 640px) and in the phone list; only one of the two is displayed.
    expect(html.match(/<button/g)).toHaveLength(6);
  });

  it("renders nothing for an empty list", () => {
    expect(renderToStaticMarkup(<StageRail stages={[]} currentIndex={-1} />)).toBe("");
  });
});
