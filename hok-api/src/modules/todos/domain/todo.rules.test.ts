import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { TODO_REMINDER_GRACE_MS, assertTodoVersion, nextTodoReminder } from "./todo.rules";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const DUE = new Date("2026-11-10T12:00:00Z");
const at = (offsetMs: number) => new Date(DUE.getTime() + offsetMs);

describe("nextTodoReminder", () => {
  it("urgent: 1 day before, 1 hour before, then at the due time, then nothing", () => {
    const early = at(-3 * DAY);
    const first = nextTodoReminder(DUE, "urgent", early);
    expect(first).toEqual(at(-DAY));
    const second = nextTodoReminder(DUE, "urgent", first!);
    expect(second).toEqual(at(-HOUR));
    const third = nextTodoReminder(DUE, "urgent", second!);
    expect(third).toEqual(DUE);
    expect(nextTodoReminder(DUE, "urgent", third!)).toBeNull();
  });

  it("high: 1 hour before, then at the due time", () => {
    const first = nextTodoReminder(DUE, "high", at(-2 * DAY));
    expect(first).toEqual(at(-HOUR));
    expect(nextTodoReminder(DUE, "high", first!)).toEqual(DUE);
    expect(nextTodoReminder(DUE, "high", DUE)).toBeNull();
  });

  it("medium: only at the due time", () => {
    expect(nextTodoReminder(DUE, "medium", at(-2 * DAY))).toEqual(DUE);
    expect(nextTodoReminder(DUE, "medium", at(-1))).toEqual(DUE);
    expect(nextTodoReminder(DUE, "medium", DUE)).toBeNull();
  });

  it("low: never", () => {
    expect(nextTodoReminder(DUE, "low", at(-2 * DAY))).toBeNull();
  });

  it("no due date: never, whatever the urgency", () => {
    for (const u of ["low", "medium", "high", "urgent"] as const) {
      expect(nextTodoReminder(null, u, new Date("2026-11-01T00:00:00Z"))).toBeNull();
    }
  });

  it("a due time in the past gives null", () => {
    for (const u of ["low", "medium", "high", "urgent"] as const) {
      expect(nextTodoReminder(DUE, u, at(1))).toBeNull();
    }
  });

  it("urgent with the due time 30 minutes away: only the 'at due' moment is left", () => {
    expect(nextTodoReminder(DUE, "urgent", at(-30 * 60_000))).toEqual(DUE);
  });

  it("is strictly after: a moment equal to `after` is not returned", () => {
    expect(nextTodoReminder(DUE, "high", at(-HOUR))).toEqual(DUE);
  });
});

describe("TODO_REMINDER_GRACE_MS", () => {
  it("is 30 minutes", () => {
    expect(TODO_REMINDER_GRACE_MS).toBe(30 * 60_000);
  });
});

describe("assertTodoVersion", () => {
  it("passes on a match; a stale version is 409 TODO_MODIFIED", () => {
    expect(() => assertTodoVersion(2, 2)).not.toThrow();
    try {
      assertTodoVersion(2, 1);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
      expect((err as AppError).code).toBe("TODO_MODIFIED");
    }
  });
});
