import { describe, expect, it } from "vitest";
import { taskStatusChangedPayload } from "./notification.messages";

describe("taskStatusChangedPayload", () => {
  it("names the status in words, not the stored code", () => {
    const p = taskStatusChangedPayload({ taskId: "t1", title: "Edit the reel", to: "in_progress", actorName: "Meera" });
    expect(p.title).toBe("Edit the reel: In progress");
    expect(p.body).toBe("Meera moved this task to In progress.");
    expect(taskStatusChangedPayload({ taskId: "t1", title: "X", to: "done" }).body).toBe("This task moved to Done.");
  });
});
