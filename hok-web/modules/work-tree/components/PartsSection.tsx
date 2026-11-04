"use client";

import { useState } from "react";
import type { WorkChild, WorkKind } from "../../../lib/domain";
import { useToast } from "../../../components/ui/Toast";
import { PartsPanel } from "./PartsPanel";
import { AddPart, type PartTarget } from "./AddPart";

/**
 * Parts of an event or a task on its detail page: the list, plus the "Add part" flow. `canAdd` means the viewer
 * may move the item (and it is not done / cancelled / read-only); `canEvent` / `canTask` say which kinds they may
 * make. Shows nothing when there is nothing to list and nothing to add.
 */
export function PartsSection({
  kind,
  itemId,
  itemTitle,
  stages,
  parts,
  hiddenParts,
  canAdd,
  canEvent,
  canTask,
  eventNeedsClient = false,
  client,
  event,
  zone,
  onChanged,
}: {
  kind: WorkKind;
  itemId: string;
  itemTitle: string;
  stages: { id: string; name: string; position: number; openChildren?: number }[];
  parts: WorkChild[];
  hiddenParts: number;
  canAdd: boolean;
  canEvent: boolean;
  canTask: boolean;
  eventNeedsClient?: boolean;
  /** What new parts inherit: the item's client (an event's own; a task's, if it has one) … */
  client: { id: string; name: string } | null;
  /** … and its event (an event parent is itself the event; a task's linked event, if any). */
  event: { id: string; title: string } | null;
  zone: string;
  /** Refetch the item (parts were created). */
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [target, setTarget] = useState<PartTarget | null>(null);
  const may = canAdd && (canEvent || canTask);

  return (
    <>
      <PartsPanel
        stages={stages}
        parts={parts}
        hiddenParts={hiddenParts}
        canAdd={may}
        onAdd={(s) =>
          setTarget({
            parent: { kind, id: itemId, stageId: s.id },
            parentTitle: itemTitle,
            stageName: s.name,
            clientId: client?.id ?? null,
            clientName: client?.name ?? null,
            eventId: event?.id ?? null,
            eventTitle: event?.title ?? null,
          })
        }
      />
      {target && (
        <AddPart
          target={target}
          canEvent={canEvent}
          canTask={canTask}
          eventNeedsClient={eventNeedsClient}
          zone={zone}
          onClose={() => setTarget(null)}
          onDone={(made, total, failure) => {
            setTarget(null);
            // Whether it all worked or stopped halfway, some parts exist now: show them.
            showToast(failure ?? (made === 1 ? "Part created." : `${made} parts created.`), failure ? "error" : "success");
            if (made > 0) onChanged();
          }}
        />
      )}
    </>
  );
}
