import type { WorkParentRef } from "../../lib/domain";

/**
 * "Add a part" (round 4): everything the create forms need to make child events or tasks under one stage of a
 * parent. `clientId` / `eventId` are what the parts inherit by default (an event parent's own client and itself;
 * a task parent's client and event, if any).
 */
export interface PartContext {
  parent: WorkParentRef;
  parentTitle: string;
  stageName: string;
  /** How many to create (1 to 20); with more than one the titles get " 1" … " N" added. */
  count: number;
  clientId: string | null;
  clientName: string | null;
  eventId: string | null;
  eventTitle: string | null;
}

/** The new-event page for a part: the parent travels in the query string; the API re-checks everything. */
export function newPartEventHref(part: PartContext): string {
  const q = new URLSearchParams({
    clientId: part.clientId ?? "",
    parentKind: part.parent.kind,
    parentId: part.parent.id,
    parentStageId: part.parent.stageId,
    parentTitle: part.parentTitle,
    stageName: part.stageName,
    count: String(part.count),
  });
  return `/app/events/new?${q.toString()}`;
}
