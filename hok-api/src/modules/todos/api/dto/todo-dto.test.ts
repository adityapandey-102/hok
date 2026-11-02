import { describe, expect, it } from "vitest";
import { createTodoDtoSchema, todoQueryDtoSchema, updateTodoDtoSchema } from "./todo.dto";

const paths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.map(String).join("."));

describe("createTodoDtoSchema", () => {
  it("needs a trimmed 1-200 character title; blank notes become null", () => {
    const r = createTodoDtoSchema.safeParse({ title: "  Send invoice ", notes: "" });
    expect(r.success && r.data).toMatchObject({ title: "Send invoice", notes: null });
    expect(paths(createTodoDtoSchema.safeParse({}))).toContain("title");
    expect(paths(createTodoDtoSchema.safeParse({ title: "   " }))).toContain("title");
    expect(paths(createTodoDtoSchema.safeParse({ title: "x".repeat(201) }))).toContain("title");
  });

  it("notes are capped at 2000 characters; urgency is one of four", () => {
    expect(paths(createTodoDtoSchema.safeParse({ title: "x", notes: "n".repeat(2001) }))).toContain("notes");
    expect(paths(createTodoDtoSchema.safeParse({ title: "x", urgency: "asap" }))).toContain("urgency");
    expect(createTodoDtoSchema.safeParse({ title: "x", urgency: "urgent" }).success).toBe(true);
  });

  it("the due time is an instant with an offset; zone-less wall times are refused", () => {
    expect(createTodoDtoSchema.safeParse({ title: "x", dueAt: "2026-11-10T18:00:00+05:30" }).success).toBe(true);
    expect(createTodoDtoSchema.safeParse({ title: "x", dueAt: "2026-11-10T12:30:00Z" }).success).toBe(true);
    expect(paths(createTodoDtoSchema.safeParse({ title: "x", dueAt: "2026-11-10T18:00:00" }))).toContain("dueAt");
  });

  it("refuses unknown keys (a caller can't smuggle an owner or a done stamp)", () => {
    expect(createTodoDtoSchema.safeParse({ title: "x", ownerId: "someone" }).success).toBe(false);
    expect(createTodoDtoSchema.safeParse({ title: "x", doneAt: "2026-11-10T12:30:00Z" }).success).toBe(false);
  });
});

describe("updateTodoDtoSchema", () => {
  it("requires a version; null clears the due date; done is a boolean", () => {
    expect(updateTodoDtoSchema.safeParse({ title: "x" }).success).toBe(false);
    const r = updateTodoDtoSchema.safeParse({ dueAt: null, done: true, version: 3 });
    expect(r.success && r.data).toMatchObject({ dueAt: null, done: true, version: 3 });
    expect(paths(updateTodoDtoSchema.safeParse({ done: "yes", version: 1 }))).toContain("done");
  });

  it("refuses unknown keys", () => {
    expect(updateTodoDtoSchema.safeParse({ version: 1, title: "x", ownerId: "someone" }).success).toBe(false);
  });
});

describe("todoQueryDtoSchema", () => {
  it("defaults to open, 50 per page; clamps the limit to 100", () => {
    expect(todoQueryDtoSchema.parse({})).toMatchObject({ status: "open", limit: 50, offset: 0 });
    expect(todoQueryDtoSchema.parse({ limit: "999" }).limit).toBe(100);
    expect(todoQueryDtoSchema.parse({ limit: "0" }).limit).toBe(1);
  });

  it("refuses an unknown status, a non-numeric limit, a bad instant and a reversed range", () => {
    expect(todoQueryDtoSchema.safeParse({ status: "finished" }).success).toBe(false);
    expect(todoQueryDtoSchema.safeParse({ limit: "many" }).success).toBe(false);
    expect(todoQueryDtoSchema.safeParse({ dueFrom: "yesterday" }).success).toBe(false);
    expect(todoQueryDtoSchema.safeParse({ dueFrom: "2026-11-10T00:00:00Z", dueTo: "2026-11-09T00:00:00Z" }).success).toBe(false);
    expect(todoQueryDtoSchema.safeParse({ status: "all", dueFrom: "2026-11-01T00:00:00Z", dueTo: "2026-12-01T00:00:00Z" }).success).toBe(true);
  });
});
