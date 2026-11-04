"use client";

import { useId, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { clampPartCount, PARTS_MAX_AT_ONCE, type WorkKind } from "../../../lib/domain";
import { newPartEventHref, type PartContext } from "../partContext";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { FieldLabel, Input } from "../../../components/ui/Field";
import { Segmented } from "../../../components/ui/Segmented";

// Only loaded when someone chooses "Task": keeps the task form out of the event page's first load.
const TaskFormModal = dynamic(() => import("../../staff-tasks/components/TaskFormModal").then((m) => m.TaskFormModal));

/** What the dialog needs to know about the stage the part is added under. */
export type PartTarget = Omit<PartContext, "count">;

/**
 * "Add part" (round 4): a small chooser (Event or Task, each only when the viewer may make it) and "How many?"
 * (1 to 20). An event part opens the new-event page for the parent's client; a task part opens the task form
 * in a dialog. Mounted only while open, so each opening starts fresh. `onDone(made, total, failure)` runs when
 * task parts were created (or a run stopped early); an event part leaves the page.
 */
export function AddPart({
  target,
  canEvent,
  canTask,
  eventNeedsClient = false,
  zone,
  onClose,
  onDone,
}: {
  target: PartTarget;
  canEvent: boolean;
  canTask: boolean;
  /** The viewer may make events but the parent (a task) has no client, so events are not offered. */
  eventNeedsClient?: boolean;
  zone: string;
  onClose: () => void;
  onDone: (made: number, total: number, failure?: string) => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const [kind, setKind] = useState<WorkKind>(canEvent ? "event" : "task");
  const [count, setCount] = useState("1");
  const [taskPart, setTaskPart] = useState<PartContext | null>(null);

  const options = [
    ...(canEvent ? [{ id: "event" as const, label: "Event" }] : []),
    ...(canTask ? [{ id: "task" as const, label: "Task" }] : []),
  ];

  function next(e: React.FormEvent) {
    e.preventDefault();
    const part: PartContext = { ...target, count: clampPartCount(count) };
    if (kind === "event") {
      onClose();
      router.push(newPartEventHref(part));
    } else {
      setTaskPart(part);
    }
  }

  if (taskPart) {
    return <TaskFormModal open zone={zone} part={taskPart} onClose={onClose} onSaved={() => onClose()} onPartsDone={onDone} />;
  }

  return (
    <Modal open onClose={onClose} labelledBy={titleId} panelClassName="max-w-md p-6">
      <h2 id={titleId} className="font-serif text-lg text-text-primary">
        Add a part
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Under {target.stageName}. {target.parentTitle} can&apos;t move past that stage until its parts are finished.
      </p>
      {options.length === 0 ? (
        <p className="mt-4 text-sm text-text-secondary">You can&apos;t add parts here.</p>
      ) : (
        <form onSubmit={next} className="mt-4 flex flex-col gap-4">
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-text-secondary">What is the part?</div>
            {options.length > 1 ? (
              <Segmented options={options} value={kind} onChange={setKind} label="Part type" stretch />
            ) : (
              <p className="text-sm text-text-primary">{options[0]!.label}</p>
            )}
            {eventNeedsClient && <p className="mt-1.5 text-xs text-text-muted">An event part needs a client, and this task has none.</p>}
          </div>
          <div>
            <FieldLabel htmlFor="part-count">How many?</FieldLabel>
            <Input
              id="part-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={PARTS_MAX_AT_ONCE}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              onBlur={() => setCount(String(clampPartCount(count)))}
              className="max-w-28"
            />
            <p className="mt-1.5 text-xs text-text-muted">1 to {PARTS_MAX_AT_ONCE}. With more than one, each title gets a number added (Reel 1, Reel 2…).</p>
          </div>
          <div className="flex justify-end gap-2 max-sm:[&>button]:flex-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Continue</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
