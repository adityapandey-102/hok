"use client";

import Link from "next/link";
import { hiddenPartsLabel, partHref, partProgressLabel, partsSummary, type WorkChild } from "../../../lib/domain";
import { Panel } from "../../../components/ui/Panel";
import { Icon } from "../../../components/ui/Icon";
import { StatusPill, type PillTone } from "../../../components/ui/StatusPill";
import { Button } from "../../../components/ui/Button";

interface StageLike {
  id: string;
  name: string;
  position: number;
  openChildren?: number;
}

function partTone(c: WorkChild): PillTone {
  if (c.kind === "event" && c.state === "cancelled") return "gray";
  if (c.finished) return "green";
  if (c.kind === "event" && c.state === "postponed") return "amber";
  return "blue";
}

/**
 * The "Parts" section of an event or a task (round 4): child events and tasks grouped by the stage of this item
 * they hang on. Each stage row shows how many parts still hold it and, for someone who may move the item, an
 * "Add part" button. A stage with no parts is only listed when the viewer can add one. Parts the viewer can't see
 * are counted ("+2 you can't see"); they still hold the stage.
 */
export function PartsPanel({
  stages,
  parts,
  hiddenParts,
  canAdd,
  onAdd,
}: {
  stages: readonly StageLike[];
  parts: readonly WorkChild[];
  hiddenParts: number;
  canAdd: boolean;
  onAdd: (stage: StageLike) => void;
}) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const rows = ordered.filter((s) => canAdd || parts.some((p) => p.stageId === s.id) || (s.openChildren ?? 0) > 0);
  if (rows.length === 0 && hiddenParts === 0) return null;
  const hidden = hiddenPartsLabel(hiddenParts);

  return (
    <Panel
      icon="layers"
      title="Parts"
      subtitle={parts.length > 0 ? `${partsSummary(parts)}${hidden ? `, ${hidden}` : ""}` : hidden ? hidden : "Child events and tasks, tied to a stage"}
    >
      <div data-testid="parts-panel" className="divide-y divide-border-light border-t border-border-light">
        {rows.map((s) => {
          const mine = parts.filter((p) => p.stageId === s.id);
          const open = s.openChildren ?? mine.filter((p) => !(p.finished || (p.kind === "event" && p.state === "cancelled"))).length;
          return (
            <section key={s.id} aria-label={`Parts at ${s.name}`} data-testid="parts-stage">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <h4 className="min-w-0 truncate text-[15px] font-semibold text-text-primary">
                    {s.position}. {s.name}
                  </h4>
                  {open > 0 ? (
                    <StatusPill label={`${open} unfinished`} tone="amber" />
                  ) : mine.length > 0 ? (
                    <StatusPill label="All finished" tone="green" />
                  ) : null}
                </div>
                {canAdd && (
                  <Button variant="ghost" className="-mr-2 text-primary" aria-label={`Add part at ${s.name}`} onClick={() => onAdd(s)}>
                    <Icon name="plus" size={15} /> Add part
                  </Button>
                )}
              </div>
              {mine.length > 0 && (
                <ul className="inset-rows pb-1">
                  {mine.map((c) => (
                    <li key={`${c.kind}-${c.id}`} data-testid="part-row" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5">
                      <Icon name={c.kind === "event" ? "calendar" : "clipboard"} size={16} className="shrink-0 text-text-muted" />
                      <Link href={partHref(c)} className="min-w-0 flex-1 basis-40 truncate text-[15px] font-medium text-text-primary underline-offset-2 hover:underline focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none">
                        {c.title}
                        <span className="sr-only"> ({c.kind})</span>
                      </Link>
                      {c.assigneeName && <span className="text-[13px] text-text-muted">{c.assigneeName}</span>}
                      <StatusPill label={partProgressLabel(c)} tone={partTone(c)} />
                      {c.finished && <Icon name="check-circle" size={16} filled className="shrink-0 text-success" />}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        {hidden && (
          <p data-testid="parts-hidden" className="px-5 py-3 text-[13px] text-text-muted">
            {hidden}. They still count toward the stage.
          </p>
        )}
      </div>
    </Panel>
  );
}
