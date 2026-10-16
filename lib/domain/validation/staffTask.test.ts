import { describe, expect, it } from "vitest";
import { buildStaffTaskPayload, parseReferenceLinks, staffTaskFormSchema, type StaffTaskFormValues } from "./staffTask";
import { describeTaskUpdate, isTaskOverdue, nextStatuses, type StaffTaskUpdate } from "../types/staffTask";

const base: StaffTaskFormValues = {
  title: "Cut the reel",
  description: "",
  assigneeId: "u1",
  priority: "medium",
  due: "",
  clientId: "",
  eventId: "",
  rawFilesUrl: "",
  referenceUrl: "",
  script: "",
  referenceLinks: "",
};

const firstError = (role: Parameters<typeof staffTaskFormSchema>[0], v: Partial<StaffTaskFormValues>) => {
  const r = staffTaskFormSchema(role).safeParse({ ...base, ...v });
  return r.success ? null : r.error.issues[0]?.path.join(".");
};

describe("staffTaskFormSchema", () => {
  it("needs a title and an assignee", () => {
    expect(firstError("developer", {})).toBeNull();
    expect(firstError("developer", { title: " " })).toBe("title");
    expect(firstError("developer", { assigneeId: "" })).toBe("assigneeId");
  });

  it("an editor task needs the raw files link; others don't", () => {
    expect(firstError("editor", {})).toBe("rawFilesUrl");
    expect(firstError("editor", { rawFilesUrl: "https://drive.google.com/x" })).toBeNull();
    expect(firstError("developer", {})).toBeNull();
  });

  it("links must be http(s)", () => {
    expect(firstError("editor", { rawFilesUrl: "drive folder" })).toBe("rawFilesUrl");
    expect(firstError("editor", { rawFilesUrl: "https://d.com", referenceUrl: "javascript:alert(1)" })).toBe("referenceUrl");
    expect(firstError("developer", { referenceLinks: "https://a.com\nnope" })).toBe("referenceLinks");
  });
});

describe("buildStaffTaskPayload", () => {
  it("create omits blanks; converts the due wall time in the Admin's zone to an instant", () => {
    const p = buildStaffTaskPayload({ ...base, due: "2026-10-20T18:00" }, "developer", "Asia/Kolkata", false);
    expect(p).toMatchObject({ title: "Cut the reel", dueAt: "2026-10-20T18:00:00+05:30", description: undefined, clientId: undefined, script: undefined });
  });

  it("edit sends blanks as null so they clear", () => {
    const p = buildStaffTaskPayload(base, "developer", "UTC", true);
    expect(p).toMatchObject({ description: null, dueAt: null, clientId: null, eventId: null, rawFilesUrl: null });
  });

  it("the editor brief is sent only for an editor", () => {
    const v = { ...base, rawFilesUrl: " https://drive.google.com/x ", script: "Hook" };
    expect(buildStaffTaskPayload(v, "editor", "UTC", false)).toMatchObject({ rawFilesUrl: "https://drive.google.com/x", script: "Hook" });
    expect(buildStaffTaskPayload(v, "developer", "UTC", false)).toMatchObject({ rawFilesUrl: undefined, script: undefined });
  });
});

describe("helpers", () => {
  it("parseReferenceLinks splits lines and drops blanks", () => {
    expect(parseReferenceLinks(" https://a.com \n\nhttps://b.com")).toEqual([
      { url: "https://a.com", label: null },
      { url: "https://b.com", label: null },
    ]);
  });

  it("isTaskOverdue: past due and not done", () => {
    const now = Date.parse("2026-10-14T12:00:00Z");
    expect(isTaskOverdue({ dueAt: "2026-10-14T11:00:00Z", status: "todo" }, now)).toBe(true);
    expect(isTaskOverdue({ dueAt: "2026-10-14T11:00:00Z", status: "done" }, now)).toBe(false);
    expect(isTaskOverdue({ dueAt: null, status: "todo" }, now)).toBe(false);
  });

  it("nextStatuses: any other status while open; none once done", () => {
    expect(nextStatuses("todo")).toEqual(["in_progress", "blocked", "done"]);
    expect(nextStatuses("done")).toEqual([]);
  });

  it("describeTaskUpdate", () => {
    const u = (o: Partial<StaffTaskUpdate>): StaffTaskUpdate => ({
      id: "1",
      kind: "status",
      authorId: null,
      authorName: null,
      fromStatus: null,
      toStatus: null,
      fromAssigneeName: null,
      toAssigneeName: null,
      comment: null,
      createdAt: "",
      ...o,
    });
    expect(describeTaskUpdate(u({ fromStatus: "todo", toStatus: "done" }))).toBe("moved it To do → Done");
    expect(describeTaskUpdate(u({ kind: "reassigned", fromAssigneeName: "Meera", toAssigneeName: "Arjun" }))).toBe("reassigned it Meera → Arjun");
    expect(describeTaskUpdate(u({ kind: "created", toAssigneeName: "Meera" }))).toBe("assigned it to Meera");
  });
});
