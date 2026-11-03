import { describe, expect, it } from "vitest";
import { buildStaffTaskPayload, staffTaskFormSchema, type StaffTaskFormValues } from "./staffTask";
import { describeTaskUpdate, isTaskOverdue, type StaffTaskUpdate } from "../types/staffTask";

const base: StaffTaskFormValues = {
  title: "Cut the reel",
  description: "",
  brief: "",
  assigneeId: "u1",
  templateId: "t1",
  priority: "medium",
  due: "",
  clientId: "",
  eventId: "",
  links: [],
};

const firstError = (v: Partial<StaffTaskFormValues>, creating = true) => {
  const r = staffTaskFormSchema(creating).safeParse({ ...base, ...v });
  return r.success ? null : r.error.issues[0]?.path.join(".");
};

describe("staffTaskFormSchema", () => {
  it("needs a title, an assignee and (on create) a template", () => {
    expect(firstError({})).toBeNull();
    expect(firstError({ title: " " })).toBe("title");
    expect(firstError({ assigneeId: "" })).toBe("assigneeId");
    expect(firstError({ templateId: "" })).toBe("templateId");
  });

  it("an edit does not need a template", () => {
    expect(firstError({ templateId: "" }, false)).toBeNull();
  });

  it("brief links must be http(s); empty rows are ignored", () => {
    expect(firstError({ links: [{ url: "https://drive.google.com/x", label: "Raw files" }] })).toBeNull();
    expect(firstError({ links: [{ url: "", label: "" }] })).toBeNull();
    expect(firstError({ links: [{ url: "drive folder", label: "" }] })).toBe("links");
    expect(firstError({ links: [{ url: "javascript:alert(1)", label: "" }] })).toBe("links");
    expect(firstError({ links: [{ url: "", label: "only a label" }] })).toBe("links");
  });

  it("allows at most 20 brief links", () => {
    const row = { url: "https://a.com", label: "" };
    expect(firstError({ links: Array.from({ length: 20 }, () => row) })).toBeNull();
    expect(firstError({ links: Array.from({ length: 21 }, () => row) })).toBe("links");
  });
});

describe("buildStaffTaskPayload", () => {
  it("create omits blanks, carries the template and links, and converts the due wall time to an instant", () => {
    const p = buildStaffTaskPayload(
      { ...base, due: "2026-10-20T18:00", brief: " Hook first ", links: [{ url: " https://a.com ", label: " Raw " }, { url: "", label: "" }, { url: "https://b.com", label: "" }] },
      "Asia/Kolkata",
      false,
    );
    expect(p).toMatchObject({
      title: "Cut the reel",
      templateId: "t1",
      dueAt: "2026-10-20T18:00:00+05:30",
      brief: "Hook first",
      description: undefined,
      clientId: undefined,
      links: [{ url: "https://a.com", label: "Raw" }, { url: "https://b.com" }],
    });
    expect((p as { links: object[] }).links[1]).not.toHaveProperty("label");
  });

  it("create with no links sends none", () => {
    expect(buildStaffTaskPayload(base, "UTC", false)).toMatchObject({ links: undefined });
  });

  it("edit sends blanks as null so they clear, and never the template or links", () => {
    const p = buildStaffTaskPayload({ ...base, links: [{ url: "https://a.com", label: "" }] }, "UTC", true);
    expect(p).toMatchObject({ description: null, brief: null, dueAt: null, clientId: null, eventId: null });
    expect(p).not.toHaveProperty("templateId");
    expect(p).not.toHaveProperty("links");
  });
});

describe("helpers", () => {
  it("isTaskOverdue: past due and not done", () => {
    const now = Date.parse("2026-10-14T12:00:00Z");
    expect(isTaskOverdue({ dueAt: "2026-10-14T11:00:00Z", status: "todo" }, now)).toBe(true);
    expect(isTaskOverdue({ dueAt: "2026-10-14T11:00:00Z", status: "done" }, now)).toBe(false);
    expect(isTaskOverdue({ dueAt: null, status: "todo" }, now)).toBe(false);
  });

  it("describeTaskUpdate", () => {
    const u = (o: Partial<StaffTaskUpdate>): StaffTaskUpdate => ({
      id: "1",
      kind: "status",
      authorId: null,
      authorName: null,
      fromStatus: null,
      toStatus: null,
      fromStageName: null,
      toStageName: null,
      fromAssigneeName: null,
      toAssigneeName: null,
      comment: null,
      createdAt: "",
      ...o,
    });
    expect(describeTaskUpdate(u({ fromStatus: "todo", toStatus: "done" }))).toBe("moved it To do → Done");
    expect(describeTaskUpdate(u({ kind: "stage", fromStageName: "Cut", toStageName: "Review" }))).toBe("moved it Cut → Review");
    expect(describeTaskUpdate(u({ kind: "completed" }))).toBe("completed it");
    expect(describeTaskUpdate(u({ kind: "blocked" }))).toBe("marked it blocked");
    expect(describeTaskUpdate(u({ kind: "unblocked" }))).toBe("unblocked it");
    expect(describeTaskUpdate(u({ kind: "reopened", toStageName: "Review" }))).toBe("reopened it at Review");
    expect(describeTaskUpdate(u({ kind: "reopened", toStatus: "todo" }))).toBe("reopened it (To do)");
    expect(describeTaskUpdate(u({ kind: "reassigned", fromAssigneeName: "Meera", toAssigneeName: "Arjun" }))).toBe("reassigned it Meera → Arjun");
    expect(describeTaskUpdate(u({ kind: "created", toAssigneeName: "Meera" }))).toBe("assigned it to Meera");
  });
});
