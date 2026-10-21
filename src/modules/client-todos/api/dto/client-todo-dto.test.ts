import { describe, expect, it } from "vitest";
import { clientTodoQueryDtoSchema, createClientTodoDtoSchema, deleteClientTodoQuerySchema, updateClientTodoDtoSchema } from "./client-todo.dto";

describe("createClientTodoDtoSchema", () => {
  it("trims the title and turns a blank description into null", () => {
    const r = createClientTodoDtoSchema.safeParse({ title: "  Get the product list ", description: "  " });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.title).toBe("Get the product list");
    expect(r.data.description).toBeNull();
  });
  it("rejects an empty or over-long title, an unknown priority, a due date without an offset and a bad event id", () => {
    expect(createClientTodoDtoSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(createClientTodoDtoSchema.safeParse({ title: "x".repeat(201) }).success).toBe(false);
    expect(createClientTodoDtoSchema.safeParse({ title: "x", priority: "asap" }).success).toBe(false);
    expect(createClientTodoDtoSchema.safeParse({ title: "x", dueAt: "2026-10-20" }).success).toBe(false);
    expect(createClientTodoDtoSchema.safeParse({ title: "x", dueAt: "2026-10-20T18:00:00+05:30" }).success).toBe(true);
    expect(createClientTodoDtoSchema.safeParse({ title: "x", eventId: "nope" }).success).toBe(false);
    expect(createClientTodoDtoSchema.safeParse({ title: "x", description: "y".repeat(2001) }).success).toBe(false);
  });
});

describe("updateClientTodoDtoSchema", () => {
  it("requires a version; every field is optional; status must be a known one", () => {
    expect(updateClientTodoDtoSchema.safeParse({ title: "x" }).success).toBe(false);
    expect(updateClientTodoDtoSchema.safeParse({ version: 1 }).success).toBe(true);
    expect(updateClientTodoDtoSchema.safeParse({ version: 1, status: "done", dueAt: null, eventId: null }).success).toBe(true);
    expect(updateClientTodoDtoSchema.safeParse({ version: 1, status: "blocked" }).success).toBe(false);
    expect(updateClientTodoDtoSchema.safeParse({ version: 0 }).success).toBe(false);
  });
});

describe("clientTodoQueryDtoSchema", () => {
  it("defaults to 20 per page, clamps the limit to 1..100 and parses flags", () => {
    expect(clientTodoQueryDtoSchema.parse({})).toMatchObject({ limit: 20, offset: 0, overdue: false });
    expect(clientTodoQueryDtoSchema.parse({ limit: "100000" }).limit).toBe(100);
    expect(clientTodoQueryDtoSchema.parse({ limit: "0" }).limit).toBe(1);
    expect(clientTodoQueryDtoSchema.parse({ overdue: "true" }).overdue).toBe(true);
    expect(clientTodoQueryDtoSchema.parse({ status: "all" }).status).toBe("all");
  });
  it("is strict: an unknown status/priority, a non-numeric limit or a bad instant is an error; blank search is dropped", () => {
    expect(clientTodoQueryDtoSchema.safeParse({ status: "blocked" }).success).toBe(false);
    expect(clientTodoQueryDtoSchema.safeParse({ priority: "asap" }).success).toBe(false);
    expect(clientTodoQueryDtoSchema.safeParse({ limit: "abc" }).success).toBe(false);
    expect(clientTodoQueryDtoSchema.safeParse({ dueFrom: "2026-10-14" }).success).toBe(false);
    expect(clientTodoQueryDtoSchema.parse({ search: "  " }).search).toBeUndefined();
  });
});

describe("deleteClientTodoQuerySchema", () => {
  it("version is optional", () => {
    expect(deleteClientTodoQuerySchema.parse({}).version).toBeUndefined();
    expect(deleteClientTodoQuerySchema.parse({ version: "3" }).version).toBe(3);
  });
});
