"use client";

import Link from "next/link";
import { formatInZone, formatTimeInZone, STAFF_TASK_PRIORITY_LABELS, STAFF_TASK_STATUS_LABELS, TODO_URGENCY_LABELS } from "../../../lib/domain";
import { TYPE_CHIP_CLASSES, type CalendarItem } from "../calendarItems";

/** The hover text of a chip: title, client, the time in the viewer's zone (plus the item's own zone when it differs), and what kind of thing it is. */
function tooltip(item: CalendarItem, zone: string): string {
  const same = formatTimeInZone(item.startsAt, zone) === formatTimeInZone(item.startsAt, item.timeZone);
  const lines = [`${item.title}${item.clientName ? ` · ${item.clientName}` : ""}`, formatInZone(item.startsAt, zone, true)];
  if (item.kind === "event" || item.kind === "personal") {
    if (!same) lines.push(`${formatInZone(item.startsAt, item.timeZone, true)} (event time)`);
    if (item.state !== "active") lines.push(item.state);
  } else if (item.kind === "task") {
    lines.push(
      `Task · ${item.taskStatus ? STAFF_TASK_STATUS_LABELS[item.taskStatus] : ""}${item.stageName ? ` · ${item.stageName}${item.taskStageNumber && item.taskStageCount ? ` ${item.taskStageNumber}/${item.taskStageCount}` : ""}` : ""}${item.taskPriority ? ` · ${STAFF_TASK_PRIORITY_LABELS[item.taskPriority]}` : ""}${item.assigneeName ? ` · ${item.assigneeName}` : ""}`,
    );
  } else {
    lines.push(`To-do${item.urgency ? ` · ${TODO_URGENCY_LABELS[item.urgency]}` : ""}${item.done ? " · done" : ""}`);
  }
  return lines.join("\n");
}

const BASE = "block w-full truncate rounded-app-sm border px-1.5 py-[3px] text-left text-[11.5px] leading-tight transition-colors hover:border-text-secondary";

/**
 * One calendar entry as a chip (week and list views). Events and tasks link to
 * their page; a personal entry opens its modal; a to-do opens its day (where it
 * can be ticked off). Cancelled / postponed events and done to-dos are struck through.
 */
export function CalendarChip({
  item,
  zone,
  compact,
  onOpenPersonal,
  onOpenDay,
}: {
  item: CalendarItem;
  zone: string;
  compact?: boolean;
  onOpenPersonal?: (id: string) => void;
  onOpenDay?: () => void;
}) {
  const faded = item.state !== "active" || item.done;
  const cls = `${BASE} ${TYPE_CHIP_CLASSES[item.type]} ${faded ? "line-through opacity-60" : ""}`;
  const body = (
    <>
      {!compact && <span className="mr-1 font-semibold">{formatTimeInZone(item.startsAt, zone)}</span>}
      <span>{item.title}</span>
      {item.kind === "task" && item.stageName && <span className="ml-1 text-text-muted" data-testid="chip-stage">· {item.stageName}</span>}
    </>
  );
  if (item.kind === "personal" || item.kind === "todo") {
    return (
      <button
        type="button"
        title={tooltip(item, zone)}
        onClick={(e) => {
          e.stopPropagation();
          if (item.kind === "personal") onOpenPersonal?.(item.id);
          else onOpenDay?.();
        }}
        data-testid="calendar-item"
        data-kind={item.kind}
        className={cls}
      >
        {body}
      </button>
    );
  }
  return (
    <Link href={item.href} title={tooltip(item, zone)} onClick={(e) => e.stopPropagation()} data-testid="calendar-item" data-kind={item.kind} className={`${cls} hover:bg-accent-light/40`}>
      {body}
    </Link>
  );
}
