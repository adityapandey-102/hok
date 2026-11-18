"use client";

import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { desktopLayout, highlightTotals, phoneLayout, railAriaLabel, railCaption, segmentsReached, type RailUnit } from "./railLayout";

export interface RailStage {
  key: string;
  name: string;
  /** The stage needs approval (a lock) or has it (a green seal). */
  approval?: "needed" | "approved";
  /** Unfinished parts (child work) holding this stage. */
  parts?: number;
  /** `approval`: a request waits on this stage (an amber ring and chip). */
  highlight?: "approval" | "files";
  /** Files shared on this stage (a crimson count on the node). */
  files?: number;
}

type NodeState = "done" | "current" | "upcoming";

/**
 * A production-stage rail (staff event and task pages, the client portal).
 * Finished stages are ink nodes with a tick, the current one is crimson with a
 * soft pulse, the rest are hollow and numbered. It scales with the count
 * (round 5, FR-STG-RAIL):
 *   - 640px and up: one horizontal row up to 6 stages, then a wrapping grid
 *     (7 across on desktop) whose connector continues across the wrapped rows;
 *   - phones: a vertical list up to 4 stages, then a native dropdown whose
 *     summary shows "Step 5 of 13", the current name and a progress bar.
 * `onStageClick` turns every stage into a button. Both layouts are in the
 * markup and CSS shows one, so nothing flashes on load.
 */
export function StageRail({
  stages,
  currentIndex,
  label = "Stages",
  unit = "Stage",
  onStageClick,
  summaryChips = true,
}: {
  stages: RailStage[];
  /** Index into `stages` of the current one (-1 if none; `stages.length` when all are done). */
  currentIndex: number;
  label?: string;
  /** The client portal says "Step", staff pages say "Stage". */
  unit?: RailUnit;
  onStageClick?: (key: string) => void;
  /** The phone dropdown's approval / file chips; off where the page already shows them right above. */
  summaryChips?: boolean;
}) {
  if (stages.length === 0) return null;
  const desktop = desktopLayout(stages.length);
  const phone = phoneLayout(stages.length);
  const listLabel = label;
  const item = (s: RailStage, i: number) => <RailItem key={s.key} s={s} i={i} count={stages.length} currentIndex={currentIndex} unit={unit} onStageClick={onStageClick} />;

  return (
    <div role="group" aria-label={railAriaLabel(label, stages, currentIndex, unit)} data-testid="stage-rail">
      {phone === "list" && desktop === "row" ? (
        <ol aria-label={listLabel} className="flex flex-col sm:flex-row">
          {stages.map(item)}
        </ol>
      ) : (
        <>
          {desktop === "row" ? (
            <ol aria-label={listLabel} className="hidden sm:flex sm:flex-row">
              {stages.map(item)}
            </ol>
          ) : (
            <ol aria-label={listLabel} className="hidden grid-cols-4 gap-y-5 sm:grid lg:grid-cols-7">
              {stages.map((s, i) => (
                <GridCell key={s.key} s={s} i={i} count={stages.length} currentIndex={currentIndex} unit={unit} onStageClick={onStageClick} />
              ))}
            </ol>
          )}
          <PhoneDropdown stages={stages} currentIndex={currentIndex} label={listLabel} unit={unit} item={item} chips={summaryChips} />
        </>
      )}
    </div>
  );
}

function stateOf(i: number, currentIndex: number): NodeState {
  return i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
}

/** The round node: ink tick, crimson pulse or hollow number; an amber ring when an approval waits; a crimson file count top right. */
function Node({ state, number, size, ring, files, unit }: { state: NodeState; number: number; size: "sm" | "md"; ring?: boolean; files?: number; unit: RailUnit }) {
  const box = size === "md" ? "h-7 w-7" : "h-6 w-6";
  return (
    <span className={`relative z-10 flex shrink-0 items-center justify-center rounded-full ${box} ${ring ? "ring-2 ring-warning ring-offset-2 ring-offset-card" : ""}`}>
      {state === "current" ? (
        <span className={`current-pulse flex items-center justify-center rounded-full bg-primary ${box}`}>
          <span className="h-2 w-2 rounded-full bg-white" />
        </span>
      ) : state === "done" ? (
        <span className={`flex items-center justify-center rounded-full bg-ink text-on-ink ${box}`}>
          <Icon name="check" size={13} strokeWidth={3} />
        </span>
      ) : (
        <span className={`flex items-center justify-center rounded-full border-2 border-border bg-card text-[10.5px] font-semibold text-text-muted ${box}`}>{number}</span>
      )}
      {!!files && files > 0 && (
        <span
          role="img"
          aria-label={`${files} ${files === 1 ? "file" : "files"}`}
          data-testid="stage-files-badge"
          className={`absolute -top-2 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold ring-2 ring-card ${unit === "Step" ? "bg-success text-on-ink" : "bg-primary text-white"}`}
        >
          {files}
        </span>
      )}
    </span>
  );
}

/** The lock / seal and parts badge that follow a stage name, plus the screen-reader texts. */
function Marks({ s, state, unit }: { s: RailStage; state: NodeState; unit: RailUnit }) {
  return (
    <>
      {s.approval && (
        <>
          <Icon name={s.approval === "approved" ? "shield" : "lock"} size={12} className={`ml-1 inline align-[-1px] ${s.approval === "approved" ? "text-success" : "text-text-muted"}`} />
          <span className="sr-only"> ({s.approval === "approved" ? "approved" : "needs approval"})</span>
        </>
      )}
      {!!s.parts && s.parts > 0 && (
        <>
          <span aria-hidden data-testid="stage-parts-badge" title={`${s.parts} unfinished ${s.parts === 1 ? "part" : "parts"}`} className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-bg px-1 text-[10.5px] font-semibold text-warning-text">
            {s.parts}
          </span>
          <span className="sr-only"> ({s.parts} unfinished {s.parts === 1 ? "part" : "parts"})</span>
        </>
      )}
      {state === "current" && <span className="sr-only"> (current {unit.toLowerCase()})</span>}
      {state === "done" && <span className="sr-only"> (done)</span>}
    </>
  );
}

/** "Your approval" in the portal (unit Step), "Approval" on staff pages. */
function ApprovalChip({ unit }: { unit: RailUnit }) {
  return <span className="inline-flex rounded-full bg-warning-bg px-2 py-0.5 text-[10.5px] leading-tight font-semibold text-warning-text">{unit === "Step" ? "Your approval" : "Approval"}</span>;
}

/** Wraps a stage's content in a button when the rail is clickable; a plain div otherwise. */
function Tap({ s, onStageClick, className, children }: { s: RailStage; onStageClick?: (key: string) => void; className: string; children: ReactNode }) {
  if (!onStageClick) return <div className={className}>{children}</div>;
  return (
    <button type="button" onClick={() => onStageClick(s.key)} className={`${className} cursor-pointer rounded-app outline-none focus-visible:ring-4 focus-visible:ring-ring/25`}>
      {children}
    </button>
  );
}

interface ItemProps {
  s: RailStage;
  i: number;
  count: number;
  currentIndex: number;
  unit: RailUnit;
  onStageClick?: (key: string) => void;
}

/** Vertical list item (phones, and the dropdown's list) that turns into a row item from 640px up. */
function RailItem({ s, i, count, currentIndex, unit, onStageClick }: ItemProps) {
  const state = stateOf(i, currentIndex);
  const last = i === count - 1;
  const done = state === "done";
  const marked = s.highlight === "approval";
  return (
    <li aria-current={state === "current" ? "step" : undefined} className="relative min-w-0 pb-5 last:pb-0 sm:flex-1 sm:pr-2 sm:pb-0">
      {!last && (
        <span
          aria-hidden
          className={`absolute top-7 bottom-1 left-[11px] w-[2px] rounded-full sm:top-[11px] sm:right-1 sm:bottom-auto sm:left-8 sm:h-[2px] sm:w-auto ${done ? "bg-ink" : "bg-border"}`}
        />
      )}
      <Tap s={s} onStageClick={onStageClick} className={`flex w-full min-w-0 gap-3 text-left sm:flex-col sm:gap-2 ${onStageClick ? "min-h-11 items-start" : ""}`}>
        <Node state={state} number={i + 1} size="sm" ring={marked} files={s.files} unit={unit} />
        <span title={s.name} className={`min-w-0 pt-0.5 text-[12.5px] leading-snug sm:truncate sm:pt-0 ${state === "current" ? "font-semibold text-text-primary" : done ? "text-text-secondary" : "text-text-muted"}`}>
          {s.name}
          <Marks s={s} state={state} unit={unit} />
          {marked && (
            <span className="mt-1 block">
              <ApprovalChip unit={unit} />
            </span>
          )}
        </span>
      </Tap>
    </li>
  );
}

/** One cell of the wrapping grid: a 28px node, the label under it, and two half connectors so the line runs across wrapped rows. */
function GridCell({ s, i, count, currentIndex, unit, onStageClick }: ItemProps) {
  const state = stateOf(i, currentIndex);
  const { incoming, outgoing } = segmentsReached(i, currentIndex);
  const marked = s.highlight === "approval";
  return (
    <li aria-current={state === "current" ? "step" : undefined} className="relative flex min-w-0 justify-center">
      {i > 0 && <span aria-hidden className={`absolute top-[13px] left-0 h-[2px] w-1/2 ${incoming ? "bg-ink" : "bg-border"}`} />}
      {i < count - 1 && <span aria-hidden className={`absolute top-[13px] right-0 h-[2px] w-1/2 ${outgoing ? "bg-ink" : "bg-border"}`} />}
      <Tap s={s} onStageClick={onStageClick} className="relative flex w-full flex-col items-center gap-1.5 px-1 text-center">
        <Node state={state} number={i + 1} size="md" ring={marked} files={s.files} unit={unit} />
        <span title={s.name} className={`block max-w-[104px] text-center text-[11.5px] leading-tight ${state === "current" ? "font-semibold text-text-primary" : state === "done" ? "text-text-secondary" : "text-text-muted"}`}>
          <span className="line-clamp-2">{s.name}</span>
          <Marks s={s} state={state} unit={unit} />
          {marked && (
            <span className="mt-1 block">
              <ApprovalChip unit={unit} />
            </span>
          )}
        </span>
      </Tap>
    </li>
  );
}

/** Phones, more than 4 stages: a native <details> (no script for the open state), as in needleye's status tracker. */
function PhoneDropdown({ stages, currentIndex, label, unit, item, chips }: { stages: RailStage[]; currentIndex: number; label: string; unit: RailUnit; item: (s: RailStage, i: number) => ReactNode; chips: boolean }) {
  const count = stages.length;
  const allDone = currentIndex >= count;
  const at = Math.min(Math.max(currentIndex, 0), count - 1);
  const current = stages[at]!;
  const totals = highlightTotals(stages);
  const pct = allDone ? 100 : currentIndex < 0 ? 0 : Math.round(((currentIndex + 1) / count) * 100);
  return (
    <details
      className="group rounded-app-lg border border-border-light bg-card sm:hidden"
      onToggle={(e) => {
        if (e.currentTarget.open) e.currentTarget.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest" });
      }}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-app-lg p-3 outline-none focus-visible:ring-4 focus-visible:ring-ring/25 [&::-webkit-details-marker]:hidden">
        <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${allDone ? "bg-ink text-on-ink" : "current-pulse bg-primary text-white"}`}>
          {allDone ? <Icon name="check" size={14} strokeWidth={3} /> : at + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-text-muted" data-testid="stage-rail-caption">
            {railCaption(unit, currentIndex, count)}
          </span>
          <span className="block truncate text-[14px] font-semibold text-text-primary">{allDone ? "Finished" : current.name}</span>
          <span aria-hidden className="mt-1.5 block h-1 overflow-hidden rounded-full bg-border-light">
            <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.max(pct, 4)}%` }} />
          </span>
          {chips && (totals.approval || totals.files > 0) && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {totals.approval && <span className="inline-flex rounded-full bg-warning-bg px-2 py-0.5 text-[10.5px] leading-tight font-semibold text-warning-text">{unit === "Step" ? "Needs your approval" : "Needs approval"}</span>}
              {totals.files > 0 && (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] leading-tight font-semibold ${unit === "Step" ? "bg-success-bg text-success" : "bg-primary-bg text-primary"}`}>
                  {totals.files} {totals.files === 1 ? "file" : "files"}{unit === "Step" ? " shared" : ""}
                </span>
              )}
            </span>
          )}
        </span>
        <Icon name="chevron-down" size={18} className="shrink-0 text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <ol aria-label={label} className="flex flex-col border-t border-border-light px-4 pt-4 pb-4">
        {stages.map(item)}
      </ol>
    </details>
  );
}
