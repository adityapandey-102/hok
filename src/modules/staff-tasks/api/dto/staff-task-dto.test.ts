import { describe, expect, it } from "vitest";
import {
  changeStatusDtoSchema,
  commentDtoSchema,
  createStaffTaskDtoSchema,
  reopenDtoSchema,
  staffTaskQueryDtoSchema,
  updateStaffTaskDtoSchema,
} from "./staff-task.dto";

const ID = "7c443f82-7913-4383-b49c-605bdbe8e139";
const paths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.map(String).join("."));

describe("createStaffTaskDtoSchema", () => {
  it("needs a title and an assignee; trims, blank optional text becomes null", () => {
    const r = createStaffTaskDtoSchema.safeParse({ title: "  Edit reel ", assigneeId: ID, description: "", script: "" });
    expect(r.success && r.data).toMatchObject({ title: "Edit reel", description: null, script: null });
    expect(paths(createStaffTaskDtoSchema.safeParse({ assigneeId: ID }))).toContain("title");
    expect(paths(createStaffTaskDtoSchema.safeParse({ title: "x" }))).toContain("assigneeId");
    expect(paths(createStaffTaskDtoSchema.safeParse({ title: "x", assigneeId: "meera" }))).toContain("assigneeId");
  });

  it("due date is an instant with an offset; zone-less wall times are refused", () => {
    expect(createStaffTaskDtoSchema.safeParse({ title: "x", assigneeId: ID, dueAt: "2026-10-20T18:00:00+05:30" }).success).toBe(true);
    expect(paths(createStaffTaskDtoSchema.safeParse({ title: "x", assigneeId: ID, dueAt: "2026-10-20T18:00:00" }))).toContain("dueAt");
  });

  it("links must be http(s); javascript: and bare text are refused", () => {
    expect(createStaffTaskDtoSchema.safeParse({ title: "x", assigneeId: ID, rawFilesUrl: "https://drive.google.com/d/1" }).success).toBe(true);
    expect(paths(createStaffTaskDtoSchema.safeParse({ title: "x", assigneeId: ID, rawFilesUrl: "javascript:alert(1)" }))).toContain("rawFilesUrl");
    expect(paths(createStaffTaskDtoSchema.safeParse({ title: "x", assigneeId: ID, referenceUrl: "drive folder" }))).toContain("referenceUrl");
    expect(paths(createStaffTaskDtoSchema.safeParse({ title: "x", assigneeId: ID, referenceLinks: [{ url: "data:x" }] }))).toContain("referenceLinks.0.url");
  });

  it("refuses an unknown priority and too many reference links", () => {
    expect(paths(createStaffTaskDtoSchema.safeParse({ title: "x", assigneeId: ID, priority: "asap" }))).toContain("priority");
    const links = Array.from({ length: 11 }, (_, i) => ({ url: `https://e.com/${i}` }));
    expect(paths(createStaffTaskDtoSchema.safeParse({ title: "x", assigneeId: ID, referenceLinks: links }))).toContain("referenceLinks");
  });
});

describe("updateStaffTaskDtoSchema", () => {
  it("requires a version; null clears optional fields", () => {
    expect(updateStaffTaskDtoSchema.safeParse({ title: "x" }).success).toBe(false);
    const r = updateStaffTaskDtoSchema.safeParse({ dueAt: null, clientId: null, version: 3 });
    expect(r.success && r.data).toMatchObject({ dueAt: null, clientId: null, version: 3 });
  });

  it("status is not editable here (it has its own endpoints)", () => {
    const r = updateStaffTaskDtoSchema.safeParse({ status: "done", title: "x", version: 1 });
    expect(r.success && "status" in r.data).toBe(false);
  });
});

describe("status, reopen and comment bodies", () => {
  it("status: a known status + version; optional comment", () => {
    expect(changeStatusDtoSchema.safeParse({ status: "in_progress", version: 1 }).success).toBe(true);
    expect(changeStatusDtoSchema.safeParse({ status: "doing", version: 1 }).success).toBe(false);
    expect(changeStatusDtoSchema.safeParse({ status: "done" }).success).toBe(false);
  });

  it("reopen defaults to todo and can't target done", () => {
    expect(reopenDtoSchema.parse({ version: 2 }).status).toBe("todo");
    expect(reopenDtoSchema.safeParse({ status: "done", version: 2 }).success).toBe(false);
  });

  it("a comment can't be blank or over 2000 characters", () => {
    expect(commentDtoSchema.safeParse({ body: "  " }).success).toBe(false);
    expect(commentDtoSchema.safeParse({ body: "x".repeat(2001) }).success).toBe(false);
    expect(commentDtoSchema.parse({ body: " ok " }).body).toBe("ok");
  });
});

describe("staffTaskQueryDtoSchema", () => {
  it("defaults and clamps the page", () => {
    expect(staffTaskQueryDtoSchema.parse({})).toMatchObject({ limit: 20, offset: 0, open: false, overdue: false });
    expect(staffTaskQueryDtoSchema.parse({ limit: "5000" }).limit).toBe(100);
  });

  it("refuses bad enums, ids, flags, instants and reversed ranges", () => {
    for (const q of [
      { status: "doing" },
      { priority: "asap" },
      { role: "intern" },
      { assigneeId: "meera" },
      { overdue: "yes" },
      { limit: "abc" },
      { dueFrom: "2026-10-01" },
      { dueFrom: "2026-10-02T00:00:00Z", dueTo: "2026-10-01T00:00:00Z" },
    ]) {
      expect(staffTaskQueryDtoSchema.safeParse(q).success, JSON.stringify(q)).toBe(false);
    }
  });

  it("parses the flags", () => {
    expect(staffTaskQueryDtoSchema.parse({ overdue: "true", open: "true" })).toMatchObject({ overdue: true, open: true });
  });
});
