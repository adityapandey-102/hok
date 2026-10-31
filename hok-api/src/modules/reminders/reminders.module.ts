import { logger } from "../../common/logger/logger";
import { notifier } from "../notifications/notifications.module";
import { ReminderRunner } from "./application/reminder-runner";
import { DrizzleRemindersRepository } from "./infrastructure/drizzle-reminders.repository";

/**
 * Composition root for reminders. The API server starts it (src/index.ts);
 * tests build their own runner with a fixed clock and call `runOnce`.
 */
export function createReminderRunner(clock?: () => Date): ReminderRunner {
  return new ReminderRunner(new DrizzleRemindersRepository(), { push: (p) => notifier.push(p) }, logger, clock);
}
