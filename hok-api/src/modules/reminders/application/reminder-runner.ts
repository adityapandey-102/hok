import { REMINDER_BATCH, REMINDER_CHECK_EVERY_MS, REMINDER_FIRST_CHECK_MS, REMINDER_MAX_ROUNDS, reminderWindow } from "../domain/reminder.rules";
import type { ReminderPusherPort, RemindersRepositoryPort } from "./ports/reminders.port";

interface RunnerLog {
  info(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}

/**
 * The in-process reminder check (ARCHITECTURE §9): every 10 minutes, claim
 * what is due (bell rows written in the same transaction), then send the web
 * pushes. No Redis, no queue, no extra service. Runs only in the API server
 * (src/index.ts), never in tests or scripts, which call `runOnce` directly.
 */
export class ReminderRunner {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly repo: RemindersRepositoryPort,
    private readonly pusher: ReminderPusherPort,
    private readonly log: RunnerLog,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * One check. Claims in rounds of REMINDER_BATCH while rounds come back full
   * (bounded). Overlapping calls are skipped, not queued. Returns how many
   * reminders went out.
   */
  async runOnce(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      for (let round = 0; round < REMINDER_MAX_ROUNDS; round++) {
        const now = this.clock();
        const pushes = await this.repo.claimDue(now, reminderWindow(now), REMINDER_BATCH);
        sent += pushes.length;
        for (const p of pushes) await this.pusher.push(p);
        // Fewer than a batch in total can't have left anything behind; otherwise look again (bounded).
        if (pushes.length < REMINDER_BATCH) break;
      }
      if (sent > 0) this.log.info({ sent }, "reminders sent");
    } catch (err) {
      this.log.error({ err }, "reminder check failed");
    } finally {
      this.running = false;
    }
    return sent;
  }

  start(everyMs = REMINDER_CHECK_EVERY_MS, firstMs = REMINDER_FIRST_CHECK_MS): void {
    if (this.timer) return;
    const first = setTimeout(() => void this.runOnce(), firstMs);
    first.unref();
    this.timer = setInterval(() => void this.runOnce(), everyMs);
    // Never keeps the process alive on its own (graceful shutdown).
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
