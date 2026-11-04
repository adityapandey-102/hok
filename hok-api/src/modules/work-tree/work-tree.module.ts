/**
 * The Work-tree module's public surface (round 4: parent and child events and tasks). There are no routes of its own:
 * children are created through POST /events and POST /staff-tasks and shown on their details. This module owns the
 * shared reads (the move gate's open-children counts, the children list, the parent facts) in
 * infrastructure/work-tree-gate.ts, and the "last unfinished child finished" notification.
 *
 * The Events, Staff-tasks and Approvals composition roots (their routes files) pass `workTreeNotifier` into their
 * services as the `WorkTreeNotifier` port (domain/work-tree.ts); their Application layers never import this file.
 */
import { notifier } from "../notifications/notifications.module";
import { DrizzleWorkTreeNotifier } from "./infrastructure/work-tree-notifier";

/** Bell + web push to the parent's people when its stage has no unfinished part left. Best-effort, never throws. */
export const workTreeNotifier = new DrizzleWorkTreeNotifier((request) => notifier.notify(request));
