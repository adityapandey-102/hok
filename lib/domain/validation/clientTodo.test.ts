import { describe, expect, it } from "vitest";
import { buildClientTodoPayload, clientTodoFormSchema, type ClientTodoFormValues } from "./clientTodo";

const base: ClientTodoFormValues = { title: "Get the product list", description: "", priority: "medium", status: "todo", due: "", eventId: "" };

const firstError = (v: Partial<ClientTodoFormValues>) => {
  const r = clientTodoFormSchema.safeParse({ ...base, ...v });
  return r.success ? null : r.error.issues[0]?.path.join(".");
};

describe("clientTodoFormSchema", () => {
  it("needs a title within 200 characters", () => {
    expect(firstError({})).toBeNull();
    expect(firstError({ title: "  " })).toBe("title");
    expect(firstError({ title: "x".repeat(201) })).toBe("title");
  });
  it("caps the description and checks the due format", () => {
    expect(firstError({ description: "y".repeat(2001) })).toBe("description");
    expect(firstError({ due: "2026-10-20" })).toBe("due");
    expect(firstError({ due: "2026-10-20T18:00" })).toBeNull();
  });
});

describe("buildClientTodoPayload", () => {
  it("create: omits blanks and the status; the due date carries the viewer's offset", () => {
    const p = buildClientTodoPayload({ ...base, title: " Book studio ", due: "2026-10-20T18:00" }, "Asia/Kolkata", false);
    expect(p).toEqual({ title: "Book studio", description: undefined, priority: "medium", dueAt: "2026-10-20T18:00:00+05:30", eventId: undefined });
  });
  it("edit: blanks become null so they clear, and the status is sent", () => {
    const p = buildClientTodoPayload({ ...base, status: "done" }, "Asia/Kolkata", true);
    expect(p).toMatchObject({ status: "done", description: null, dueAt: null, eventId: null });
  });
});
