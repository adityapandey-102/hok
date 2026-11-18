/**
 * Pure rules behind StageRail (round 5): which layout a count of stages gets,
 * and the words for the phone dropdown. Kept out of the component so they are
 * unit-tested without a DOM.
 */
export type RailUnit = "Stage" | "Step";

/** Up to this many stages, tablets and desktops keep the single horizontal row. */
export const ROW_MAX = 6;
/** Up to this many stages, phones keep the plain vertical list; more become a dropdown. */
export const PHONE_LIST_MAX = 4;

/** ≥ 640px: one row, or needleye's wrapping grid when the row would squeeze. */
export function desktopLayout(count: number): "row" | "grid" {
  return count <= ROW_MAX ? "row" : "grid";
}

/** < 640px: the vertical list, or a dropdown when the list would run long. */
export function phoneLayout(count: number): "list" | "dropdown" {
  return count <= PHONE_LIST_MAX ? "list" : "dropdown";
}

const plural = (unit: RailUnit) => `${unit.toLowerCase()}s`;

/** The dropdown's caption: "Step 5 of 13", or "All 13 stages done" when the whole list is finished. */
export function railCaption(unit: RailUnit, currentIndex: number, count: number): string {
  if (currentIndex >= count) return `All ${count} ${plural(unit)} done`;
  if (currentIndex < 0) return `${count} ${plural(unit)}`;
  return `${unit} ${currentIndex + 1} of ${count}`;
}

/** The group's accessible name: "Event stages: Editing (Stage 5 of 13)". */
export function railAriaLabel(label: string, stages: { name: string }[], currentIndex: number, unit: RailUnit): string {
  const count = stages.length;
  if (currentIndex >= count) return `${label}: all ${count} ${plural(unit)} done`;
  if (currentIndex < 0) return `${label}: ${count} ${plural(unit)}`;
  return `${label}: ${stages[currentIndex]!.name} (${railCaption(unit, currentIndex, count)})`;
}

/** What the dropdown's summary shows when any stage is highlighted: is an approval waiting, and how many files in all. */
export function highlightTotals(stages: { highlight?: "approval" | "files"; files?: number }[]): { approval: boolean; files: number } {
  let files = 0;
  let approval = false;
  for (const s of stages) {
    if (s.highlight === "approval") approval = true;
    files += s.files ?? 0;
  }
  return { approval, files };
}

/** Which half-segments of the grid's connector are inked: the line into a cell and out of it. */
export function segmentsReached(index: number, currentIndex: number): { incoming: boolean; outgoing: boolean } {
  return { incoming: index <= currentIndex, outgoing: index + 1 <= currentIndex };
}
