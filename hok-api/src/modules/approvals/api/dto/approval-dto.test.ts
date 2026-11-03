import { describe, expect, it } from "vitest";
import { approvalQueryDtoSchema, cancelApprovalDtoSchema, decideApprovalDtoSchema, requestApprovalDtoSchema } from "./approval.dto";

const ID = "3f1c2b7e-9d3a-4f55-8a43-2c1d9e0b7a11";

describe("approval DTOs", () => {
  it("a request takes the item, an optional note and an optional http(s) link; blanks mean none", () => {
    expect(requestApprovalDtoSchema.parse({ subject: "task", subjectId: ID, note: "  ", link: "" })).toEqual({ subject: "task", subjectId: ID });
    expect(requestApprovalDtoSchema.parse({ subject: "event", subjectId: ID, note: " Please look ", link: "https://drive.google.com/x" })).toMatchObject({
      note: "Please look",
      link: "https://drive.google.com/x",
    });
  });

  it("refuses a javascript: or relative link, an unknown subject, a non-uuid id, an over-long note and unknown keys", () => {
    for (const link of ["javascript:alert(1)", "/relative", "ftp://x.test/a"]) {
      expect(requestApprovalDtoSchema.safeParse({ subject: "task", subjectId: ID, link }).success, link).toBe(false);
    }
    expect(requestApprovalDtoSchema.safeParse({ subject: "client", subjectId: ID }).success).toBe(false);
    expect(requestApprovalDtoSchema.safeParse({ subject: "task", subjectId: "nope" }).success).toBe(false);
    expect(requestApprovalDtoSchema.safeParse({ subject: "task", subjectId: ID, note: "x".repeat(2001) }).success).toBe(false);
    expect(requestApprovalDtoSchema.safeParse({ subject: "task", subjectId: ID, status: "approved" }).success).toBe(false);
  });

  it("a decision needs the version and approve|changes; the comment is trimmed, blank = none, capped at 2000, text only", () => {
    expect(decideApprovalDtoSchema.parse({ version: 1, decision: "changes", comment: "  Logo  " })).toEqual({ version: 1, decision: "changes", comment: "Logo" });
    expect(decideApprovalDtoSchema.parse({ version: 2, decision: "approve", comment: "   " })).toEqual({ version: 2, decision: "approve" });
    expect(decideApprovalDtoSchema.safeParse({ version: 0, decision: "approve" }).success).toBe(false);
    expect(decideApprovalDtoSchema.safeParse({ version: 1, decision: "maybe" }).success).toBe(false);
    expect(decideApprovalDtoSchema.safeParse({ version: 1, decision: "approve", comment: "x".repeat(2001) }).success).toBe(false);
    expect(decideApprovalDtoSchema.safeParse({ version: 1, decision: "approve", decidedBy: "me" }).success).toBe(false);
  });

  it("a cancel needs only the version", () => {
    expect(cancelApprovalDtoSchema.parse({ version: 3 })).toEqual({ version: 3 });
    expect(cancelApprovalDtoSchema.safeParse({}).success).toBe(false);
  });

  it("the inbox defaults to to_decide, 20 per page, and clamps the page size to 100", () => {
    expect(approvalQueryDtoSchema.parse({})).toEqual({ view: "to_decide", limit: 20, offset: 0 });
    expect(approvalQueryDtoSchema.parse({ view: "requested", status: "approved", limit: "500", offset: "40" })).toEqual({ view: "requested", status: "approved", limit: 100, offset: 40 });
    expect(approvalQueryDtoSchema.safeParse({ view: "everything" }).success).toBe(false);
  });
});
