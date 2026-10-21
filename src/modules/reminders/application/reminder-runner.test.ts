import { describe, expect, it, vi } from "vitest";
import { REMINDER_BATCH, REMINDER_LEAD_MS, REMINDER_MAX_ROUNDS, reminderWindow } from "../domain/reminder.rules";
import type { ReminderPush, RemindersRepositoryPort } from "./ports/reminders.port";
import { ReminderRunner } from "./reminder-runner";

const NOW = new Date("2026-10-20T03:00:00Z");
const push = (n: number): ReminderPush => ({ type: "task_due_reminder", recipientIds: [`u${n}`], actorId: null, payload: { title: `t${n}` } });
const log = { info: vi.fn(), error: vi.fn() };

describe("reminderWindow", () => {
  it("covers moments after now and up to two hours ahead", () => {
    expect(reminderWindow(NOW)).toEqual({ after: NOW, until: new Date(NOW.getTime() + REMINDER_LEAD_MS) });
    expect(REMINDER_LEAD_MS).toBe(2 * 60 * 60 * 1000);
  });
});

describe("ReminderRunner", () => {
  it("claims the window around now and pushes what it claimed", async () => {
    const claimDue = vi.fn<RemindersRepositoryPort["claimDue"]>().mockResolvedValueOnce([push(1), push(2)]);
    const pushed: ReminderPush[] = [];
    const runner = new ReminderRunner({ claimDue }, { push: (p) => Promise.resolve(void pushed.push(p)) }, log, () => NOW);
    expect(await runner.runOnce()).toBe(2);
    expect(claimDue).toHaveBeenCalledWith(NOW, reminderWindow(NOW), REMINDER_BATCH);
    expect(pushed.map((p) => p.recipientIds[0])).toEqual(["u1", "u2"]);
  });

  it("claims again while rounds come back full, but never more than the round limit", async () => {
    const full = Array.from({ length: REMINDER_BATCH }, (_, i) => push(i));
    const claimDue = vi.fn<RemindersRepositoryPort["claimDue"]>().mockResolvedValue(full);
    const runner = new ReminderRunner({ claimDue }, { push: () => Promise.resolve() }, log, () => NOW);
    expect(await runner.runOnce()).toBe(REMINDER_BATCH * REMINDER_MAX_ROUNDS);
    expect(claimDue).toHaveBeenCalledTimes(REMINDER_MAX_ROUNDS);
  });

  it("skips an overlapping run and survives a failed claim", async () => {
    let release!: (v: ReminderPush[]) => void;
    const claimDue = vi
      .fn<RemindersRepositoryPort["claimDue"]>()
      .mockReturnValueOnce(new Promise((r) => (release = r)))
      .mockRejectedValueOnce(new Error("db down"));
    const runner = new ReminderRunner({ claimDue }, { push: () => Promise.resolve() }, log, () => NOW);
    const first = runner.runOnce();
    expect(await runner.runOnce()).toBe(0); // overlapping: skipped
    release([]);
    expect(await first).toBe(0);
    expect(await runner.runOnce()).toBe(0); // the claim throws: logged, not thrown
    expect(log.error).toHaveBeenCalled();
  });
});
