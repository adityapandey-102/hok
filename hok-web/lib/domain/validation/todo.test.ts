import { describe, expect, it } from "vitest";
import { buildTodoPayload, todoFormSchema, type TodoFormValues } from "./todo";

const base: TodoFormValues = { title: "Call the printer", notes: "", urgency: "medium", due: "" };
const firstError = (v: Partial<TodoFormValues>) => {
  const r = todoFormSchema.safeParse({ ...base, ...v });
  return r.success ? null : r.error.issues[0]?.path.join(".");
};

describe("todoFormSchema", () => {
  it("accepts a bare title, and a full form", () => {
    expect(firstError({})).toBeNull();
    expect(firstError({ notes: "ring twice", urgency: "urgent", due: "2026-11-20T17:00" })).toBeNull();
  });
  it("needs a title of 1 to 200 characters once trimmed", () => {
    expect(firstError({ title: "   " })).toBe("title");
    expect(firstError({ title: "x".repeat(201) })).toBe("title");
    expect(firstError({ title: "x".repeat(200) })).toBeNull();
  });
  it("caps the notes at 2000 characters", () => {
    expect(firstError({ notes: "n".repeat(2001) })).toBe("notes");
  });
  it("only takes a full date and time", () => {
    expect(firstError({ due: "2026-11-20" })).toBe("due");
    expect(firstError({ due: "tomorrow" })).toBe("due");
  });
  it("rejects an unknown urgency", () => {
    expect(firstError({ urgency: "asap" as never })).toBe("urgency");
  });
});

describe("buildTodoPayload", () => {
  it("omits blank optional fields on create", () => {
    expect(buildTodoPayload({ ...base, title: "  Call  " }, "Asia/Kolkata", false)).toEqual({ title: "Call", notes: undefined, urgency: "medium", dueAt: undefined });
  });
  it("sends null for blank optional fields on edit, so they clear", () => {
    expect(buildTodoPayload(base, "Asia/Kolkata", true)).toMatchObject({ notes: null, dueAt: null });
  });
  it("turns the due wall time in the viewer's zone into an instant", () => {
    expect(new Date(buildTodoPayload({ ...base, due: "2026-11-20T17:00" }, "Asia/Kolkata", false).dueAt ?? "").toISOString()).toBe("2026-11-20T11:30:00.000Z");
  });
});
