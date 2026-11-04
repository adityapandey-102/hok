import { describe, expect, it } from "vitest";
import {
  addLinkDtoSchema,
  blockDtoSchema,
  commentDtoSchema,
  createStaffTaskDtoSchema,
  reopenDtoSchema,
  shareLinkDtoSchema,
  staffTaskQueryDtoSchema,
  stageMoveDtoSchema,
  unblockDtoSchema,
  updateStaffTaskDtoSchema,
} from "./staff-task.dto";

const ID = "7c443f82-7913-4383-b49c-605bdbe8e139";
const TPL = "0a8d1f5e-3c2b-4d6e-9f10-2b7c4d5e6f70";
const paths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.map(String).join("."));

describe("createStaffTaskDtoSchema", () => {
  it("round 4: an optional parent needs a kind, an id and a stage id; PATCH takes none", () => {
    const body = { title: "x", assigneeId: ID, templateId: TPL };
    expect(createStaffTaskDtoSchema.safeParse({ ...body, parent: { kind: "task", id: ID, stageId: TPL } }).success).toBe(true);
    expect(createStaffTaskDtoSchema.safeParse({ ...body, parent: { kind: "event", id: ID, stageId: TPL } }).success).toBe(true);
    expect(paths(createStaffTaskDtoSchema.safeParse({ ...body, parent: { kind: "todo", id: ID, stageId: TPL } }))).toContain("parent.kind");
    expect(paths(createStaffTaskDtoSchema.safeParse({ ...body, parent: { kind: "task", id: ID } }))).toContain("parent.stageId");
    expect(updateStaffTaskDtoSchema.safeParse({ parent: { kind: "task", id: ID, stageId: TPL }, version: 1 }).success).toBe(false);
  });

  it("needs a title, an assignee and a template; trims, blank optional text becomes null", () => {
    const r = createStaffTaskDtoSchema.safeParse({ title: "  Edit reel ", assigneeId: ID, templateId: TPL, description: "", brief: "" });
    expect(r.success && r.data).toMatchObject({ title: "Edit reel", description: null, brief: null });
    expect(paths(createStaffTaskDtoSchema.safeParse({ assigneeId: ID, templateId: TPL }))).toContain("title");
    expect(paths(createStaffTaskDtoSchema.safeParse({ title: "x", templateId: TPL }))).toContain("assigneeId");
    expect(paths(createStaffTaskDtoSchema.safeParse({ title: "x", assigneeId: "meera", templateId: TPL }))).toContain("assigneeId");
    expect(paths(createStaffTaskDtoSchema.safeParse({ title: "x", assigneeId: ID }))).toContain("templateId");
    expect(paths(createStaffTaskDtoSchema.safeParse({ title: "x", assigneeId: ID, templateId: "reel-edit" }))).toContain("templateId");
  });

  it("due date is an instant with an offset; zone-less wall times are refused", () => {
    const base = { title: "x", assigneeId: ID, templateId: TPL };
    expect(createStaffTaskDtoSchema.safeParse({ ...base, dueAt: "2026-10-20T18:00:00+05:30" }).success).toBe(true);
    expect(paths(createStaffTaskDtoSchema.safeParse({ ...base, dueAt: "2026-10-20T18:00:00" }))).toContain("dueAt");
  });

  it("brief links must be http(s) and are capped at 20; blank labels become null", () => {
    const base = { title: "x", assigneeId: ID, templateId: TPL };
    const ok = createStaffTaskDtoSchema.safeParse({ ...base, links: [{ url: "https://drive.google.com/d/1", label: " " }] });
    expect(ok.success && ok.data.links).toEqual([{ url: "https://drive.google.com/d/1", label: null }]);
    expect(paths(createStaffTaskDtoSchema.safeParse({ ...base, links: [{ url: "javascript:alert(1)" }] }))).toContain("links.0.url");
    expect(paths(createStaffTaskDtoSchema.safeParse({ ...base, links: [{ url: "drive folder" }] }))).toContain("links.0.url");
    const many = Array.from({ length: 21 }, (_, i) => ({ url: `https://e.com/${i}` }));
    expect(paths(createStaffTaskDtoSchema.safeParse({ ...base, links: many }))).toContain("links");
  });

  it("refuses an unknown priority; the old editor fields are gone (ignored, never stored)", () => {
    const base = { title: "x", assigneeId: ID, templateId: TPL };
    expect(paths(createStaffTaskDtoSchema.safeParse({ ...base, priority: "asap" }))).toContain("priority");
    const r = createStaffTaskDtoSchema.safeParse({ ...base, rawFilesUrl: "https://x.test", script: "old" });
    expect(r.success && ("rawFilesUrl" in r.data || "script" in r.data)).toBe(false);
  });

  it("the brief is capped at 20000 characters", () => {
    const base = { title: "x", assigneeId: ID, templateId: TPL };
    expect(createStaffTaskDtoSchema.safeParse({ ...base, brief: "x".repeat(20000) }).success).toBe(true);
    expect(paths(createStaffTaskDtoSchema.safeParse({ ...base, brief: "x".repeat(20001) }))).toContain("brief");
  });
});

describe("updateStaffTaskDtoSchema", () => {
  it("requires a version; null clears optional fields", () => {
    expect(updateStaffTaskDtoSchema.safeParse({ title: "x" }).success).toBe(false);
    const r = updateStaffTaskDtoSchema.safeParse({ dueAt: null, clientId: null, brief: null, version: 3 });
    expect(r.success && r.data).toMatchObject({ dueAt: null, clientId: null, brief: null, version: 3 });
  });

  it("refuses fields that have their own endpoints or are fixed: status, templateId (400)", () => {
    expect(updateStaffTaskDtoSchema.safeParse({ status: "done", title: "x", version: 1 }).success).toBe(false);
    expect(updateStaffTaskDtoSchema.safeParse({ templateId: TPL, version: 1 }).success).toBe(false);
  });
});

describe("stage, block, unblock, reopen and comment bodies", () => {
  it("stage: exactly one of stageId / complete:true, plus a version", () => {
    expect(stageMoveDtoSchema.safeParse({ stageId: ID, version: 1 }).success).toBe(true);
    expect(stageMoveDtoSchema.safeParse({ complete: true, comment: "done!", version: 1 }).success).toBe(true);
    expect(stageMoveDtoSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(stageMoveDtoSchema.safeParse({ stageId: ID, complete: true, version: 1 }).success).toBe(false);
    expect(stageMoveDtoSchema.safeParse({ complete: false, version: 1 }).success).toBe(false);
    expect(stageMoveDtoSchema.safeParse({ stageId: "cut", version: 1 }).success).toBe(false);
    expect(stageMoveDtoSchema.safeParse({ stageId: ID }).success).toBe(false);
  });

  it("block: a reason of 1 to 1000 characters; unblock: optional comment", () => {
    expect(blockDtoSchema.parse({ reason: "  Waiting for footage ", version: 2 }).reason).toBe("Waiting for footage");
    expect(blockDtoSchema.safeParse({ reason: "  ", version: 2 }).success).toBe(false);
    expect(blockDtoSchema.safeParse({ reason: "x".repeat(1001), version: 2 }).success).toBe(false);
    expect(blockDtoSchema.safeParse({ version: 2 }).success).toBe(false);
    expect(unblockDtoSchema.safeParse({ version: 2 }).success).toBe(true);
    expect(unblockDtoSchema.safeParse({ comment: "Footage arrived", version: 2 }).success).toBe(true);
  });

  it("reopen: an optional stage (a uuid) and comment; the old status is gone", () => {
    expect(reopenDtoSchema.safeParse({ version: 2 }).success).toBe(true);
    expect(reopenDtoSchema.safeParse({ stageId: ID, version: 2 }).success).toBe(true);
    expect(reopenDtoSchema.safeParse({ stageId: "last", version: 2 }).success).toBe(false);
    expect(reopenDtoSchema.safeParse({ stageId: ID }).success).toBe(false);
  });

  it("a comment can't be blank or over 2000 characters", () => {
    expect(commentDtoSchema.safeParse({ body: "  " }).success).toBe(false);
    expect(commentDtoSchema.safeParse({ body: "x".repeat(2001) }).success).toBe(false);
    expect(commentDtoSchema.parse({ body: " ok " }).body).toBe("ok");
  });
});

describe("link bodies", () => {
  it("add: a kind, an http(s) url, optional label and stage", () => {
    expect(addLinkDtoSchema.safeParse({ kind: "brief", url: "https://drive.google.com/d/1" }).success).toBe(true);
    expect(addLinkDtoSchema.safeParse({ kind: "delivered", url: "https://x.test/a", label: "Cut 1", stageId: ID }).success).toBe(true);
    expect(addLinkDtoSchema.safeParse({ kind: "other", url: "https://x.test/a" }).success).toBe(false);
    expect(addLinkDtoSchema.safeParse({ kind: "brief", url: "javascript:alert(1)" }).success).toBe(false);
    expect(addLinkDtoSchema.safeParse({ kind: "brief", url: "https://x.test/" + "a".repeat(2000) }).success).toBe(false);
    expect(addLinkDtoSchema.safeParse({ kind: "brief", url: "https://x.test/a", label: "x".repeat(121) }).success).toBe(false);
  });

  it("share: everything optional; a stage must be a uuid", () => {
    expect(shareLinkDtoSchema.parse({})).toEqual({ title: null });
    expect(shareLinkDtoSchema.safeParse({ title: " Final cut ", stageId: ID }).success).toBe(true);
    expect(shareLinkDtoSchema.safeParse({ stageId: "x" }).success).toBe(false);
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
