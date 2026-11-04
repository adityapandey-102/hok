import { beforeEach, describe, expect, it } from "vitest";
import { ApprovalsService, type ApprovalsCaller } from "./approvals.service";
import { AppError } from "../../../common/errors/app-error";
import type { AuditEvent } from "../../../common/audit/audit-logger";
import type { PortalContext } from "../../../common/database/portal-links";
import type { ApprovalRow, ApproverToken } from "../../../domain";
import type { ApprovalItemFacts } from "../domain/approval.entity";
import type { ApprovalListFilters, ApprovalsRepositoryPort, ApprovalWrite, NewApproval } from "./ports/approvals-repository.port";
import type { ApprovalNotifier } from "./ports/approval-notifier.port";

/**
 * ApprovalsService against an in-memory fake: who may ask (those who can move the item), who may decide (a matching
 * token, sees the item, not one's own request unless Admin), cancel, the versions and the states, the portal's single
 * 404, and who hears about it. The SQL (inbox, recipients, the unique index) is the integration tests' job.
 */

const ADMIN: ApprovalsCaller = { userId: "admin", role: "admin" };
const ROHAN: ApprovalsCaller = { userId: "rohan", role: "social_media_manager" };
const SARA: ApprovalsCaller = { userId: "sara", role: "marketing_manager" };
const MEERA: ApprovalsCaller = { userId: "meera", role: "editor" };
const ARJUN: ApprovalsCaller = { userId: "arjun", role: "developer" };

const PORTAL: PortalContext = { linkId: "link1", clientId: "c1", businessName: "Acme", logoUrl: null, timeZone: "Asia/Kolkata", ownerId: "rohan", teamIds: ["rohan"], ownerFirstName: "Rohan" };

function facts(o: Partial<ApprovalItemFacts> = {}): ApprovalItemFacts {
  return {
    subject: "task",
    itemId: "t1",
    title: "Reel edit",
    clientId: null,
    clientArchived: false,
    teamIds: [],
    assigneeId: "meera",
    assignedBy: "rohan",
    inactive: null,
    stageId: "s4",
    stageName: "Review",
    stagePosition: 4,
    approvers: ["social_media_manager", "admin"],
    approved: false,
    pending: false,
    ...o,
  };
}

function row(o: Partial<ApprovalRow["record"]> = {}, rest: Partial<Omit<ApprovalRow, "record">> = {}): ApprovalRow {
  return {
    record: {
      id: "a1",
      subject: "task",
      subjectId: "t1",
      subjectTitle: "Reel edit",
      clientName: null,
      stageId: "s4",
      stageName: "Review",
      stagePosition: 4,
      approvers: ["social_media_manager", "admin"] as ApproverToken[],
      status: "pending",
      requestNote: null,
      requestLink: null,
      requestedById: "meera",
      requestedByName: "Meera",
      requestedAt: "2026-11-04T05:00:00.000Z",
      decidedById: null,
      decidedByName: null,
      decidedVia: null,
      decidedAt: null,
      decisionComment: null,
      version: 1,
      ...o,
    },
    teamIds: [],
    assigneeId: "meera",
    assignedBy: "rohan",
    ...rest,
  };
}

class FakeRepo implements ApprovalsRepositoryPort {
  item: ApprovalItemFacts | null = facts();
  rows = new Map<string, ApprovalRow>([["a1", row()]]);
  inserted: NewApproval[] = [];
  writes: ApprovalWrite[] = [];
  lastFilters: ApprovalListFilters | null = null;
  lastPin: string | null | undefined;
  deciders = ["rohan", "admin", "meera"];
  eventTeam = ["rohan", "sara"];

  request(input: NewApproval, guard: (item: ApprovalItemFacts | null) => void) {
    try {
      guard(this.item);
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
    this.inserted.push(input);
    this.rows.set("new", row({ id: "new", requestNote: input.note, requestLink: input.link, requestedById: input.requestedBy }));
    return Promise.resolve("new");
  }
  findRow(id: string) {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  transition(id: string, pinClientId: string | null, guard: (row: ApprovalRow | null) => ApprovalWrite) {
    this.lastPin = pinClientId;
    const current = this.rows.get(id) ?? null;
    let write: ApprovalWrite;
    try {
      write = guard(current);
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
    this.writes.push(write);
    this.rows.set(id, {
      ...current!,
      record: { ...current!.record, status: write.status, decidedById: write.decidedBy, decidedVia: write.decidedVia, decisionComment: write.comment, version: current!.record.version + 1 },
    });
    return Promise.resolve();
  }
  list(_u: string, _r: string, filters: ApprovalListFilters) {
    this.lastFilters = filters;
    return Promise.resolve([...this.rows.values()]);
  }
  count() {
    return Promise.resolve(7);
  }
  deciderIds() {
    return Promise.resolve(this.deciders);
  }
  eventNotifiedTeam() {
    return Promise.resolve(this.eventTeam);
  }
}

class RecordingNotifier implements ApprovalNotifier {
  requests: Parameters<ApprovalNotifier["requested"]>[0][] = [];
  decisions: Parameters<ApprovalNotifier["decided"]>[0][] = [];
  requested(n: Parameters<ApprovalNotifier["requested"]>[0]) {
    this.requests.push(n);
    return Promise.resolve();
  }
  decided(n: Parameters<ApprovalNotifier["decided"]>[0]) {
    this.decisions.push(n);
    return Promise.resolve();
  }
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return err.code;
  }
}

let repo: FakeRepo;
let audit: AuditEvent[];
let notifier: RecordingNotifier;
let service: ApprovalsService;
/** Round 4: items the service asked the work-tree notifier to look at (an approved event may have finished a part). */
let changedChildren: { kind: string; id: string; actorId: string | null }[];

beforeEach(() => {
  repo = new FakeRepo();
  audit = [];
  notifier = new RecordingNotifier();
  changedChildren = [];
  service = new ApprovalsService(repo, { record: (e) => (audit.push(e), Promise.resolve()) }, notifier, {
    stageMayBeClear: () => Promise.resolve(),
    childChanged: (kind, id, actorId) => (changedChildren.push({ kind, id, actorId }), Promise.resolve()),
  });
});

const ask = (caller: ApprovalsCaller, subject: "event" | "task" = "task") => service.request(caller, { subject, subjectId: "t1", note: "Please check", link: "https://x.test/v" });
const decide = (caller: ApprovalsCaller, o: { version?: number; decision?: "approve" | "changes"; comment?: string } = {}) =>
  service.decide(caller, "a1", { version: o.version ?? 1, decision: o.decision ?? "approve", comment: o.comment });

describe("request", () => {
  it("the assignee asks for approval of the current stage; it audits, notifies the approvers (never the requester) and answers with the caller's flags", async () => {
    const a = await ask(MEERA);
    expect(repo.inserted).toEqual([{ subject: "task", itemId: "t1", note: "Please check", link: "https://x.test/v", requestedBy: "meera" }]);
    expect(a).toMatchObject({ id: "new", status: "pending", canCancel: true, canDecide: false });
    expect(audit.map((e) => e.action)).toEqual(["approval.requested"]);
    expect(audit[0]!.metadata).toEqual({ subject: "task", subjectId: "t1" });
    expect(notifier.requests).toHaveLength(1);
    expect(notifier.requests[0]).toMatchObject({ recipientIds: ["rohan", "admin"], actorId: "meera", stageName: "Review", itemTitle: "Reel edit" });
  });

  it("the creator and the Admin may ask too", async () => {
    expect(await codeOf(ask(ROHAN))).toBeNull();
    expect(await codeOf(ask(ADMIN))).toBeNull();
  });

  it("a task the caller can't see is a 404; one they see but can't move is a 403", async () => {
    expect(await codeOf(ask(ARJUN))).toBe("STAFF_TASK_NOT_FOUND");
    repo.item = facts({ clientId: "c1", teamIds: ["sara"] });
    expect(await codeOf(ask(SARA))).toBe("STAFF_TASK_FORBIDDEN");
    repo.item = null;
    expect(await codeOf(ask(ADMIN))).toBe("STAFF_TASK_NOT_FOUND");
  });

  it("an event: the Admin or a manager on the team may ask; another manager gets 404", async () => {
    repo.item = facts({ subject: "event", itemId: "t1", clientId: "c1", teamIds: ["rohan"], assigneeId: null, assignedBy: null });
    expect(await codeOf(ask(ROHAN, "event"))).toBeNull();
    expect(await codeOf(ask(ADMIN, "event"))).toBeNull();
    expect(await codeOf(ask(SARA, "event"))).toBe("EVENT_NOT_FOUND");
    expect(await codeOf(ask(MEERA, "event"))).toBe("EVENT_NOT_FOUND");
  });

  it("refuses a stage with no approvers, an approved one, a pending one, a done task, an inactive event and an archived client", async () => {
    repo.item = facts({ approvers: [] });
    expect(await codeOf(ask(MEERA))).toBe("STAGE_APPROVAL_NOT_NEEDED");
    repo.item = facts({ approved: true });
    expect(await codeOf(ask(MEERA))).toBe("STAGE_APPROVAL_ALREADY_APPROVED");
    repo.item = facts({ pending: true });
    expect(await codeOf(ask(MEERA))).toBe("STAGE_APPROVAL_PENDING");
    repo.item = facts({ inactive: "task_done" });
    expect(await codeOf(ask(MEERA))).toBe("STAFF_TASK_DONE");
    repo.item = facts({ subject: "event", clientId: "c1", teamIds: ["rohan"], assigneeId: null, assignedBy: null, inactive: "event_not_active" });
    expect(await codeOf(ask(ROHAN, "event"))).toBe("EVENT_NOT_ACTIVE");
    repo.item = facts({ clientArchived: true });
    expect(await codeOf(ask(MEERA))).toBe("CLIENT_ARCHIVED");
    expect(repo.inserted).toEqual([]);
  });

  it("a failing notification never fails the request", async () => {
    repo.deciders = [];
    expect(await codeOf(ask(MEERA))).toBeNull();
    expect(notifier.requests).toEqual([]);
  });
});

describe("decide", () => {
  it("a role approver approves: the row is written as a staff decision, audited, and the requester and the task's people hear about it", async () => {
    const a = await decide(ROHAN);
    expect(repo.writes).toEqual([{ status: "approved", decidedBy: "rohan", decidedVia: "staff", comment: null, stampTime: true }]);
    expect(a.status).toBe("approved");
    expect(audit[0]).toMatchObject({ action: "approval.decided", entityId: "a1", metadata: { decision: "approve", subject: "task", subjectId: "t1" } });
    expect(notifier.decisions[0]).toMatchObject({ decision: "approve", via: "staff", actorId: "rohan", recipientIds: ["meera", "rohan"] });
  });

  it("the Admin may approve, and may approve their own request; anyone else may not approve their own", async () => {
    repo.rows.set("a1", row({ requestedById: "admin" }));
    expect(await codeOf(decide(ADMIN))).toBeNull();
    repo.rows.set("a1", row({ requestedById: "rohan" }, { assignedBy: "rohan" }));
    expect(await codeOf(decide(ROHAN))).toBe("STAGE_APPROVAL_SELF");
  });

  it("someone who isn't an approver for the stage gets 403; someone who can't see the item gets 404", async () => {
    repo.rows.set("a1", row({ approvers: ["admin"] }));
    expect(await codeOf(decide(ROHAN))).toBe("STAGE_APPROVAL_NOT_APPROVER");
    expect(await codeOf(decide(MEERA))).toBe("STAGE_APPROVAL_NOT_APPROVER");
    expect(await codeOf(decide(ARJUN))).toBe("STAGE_APPROVAL_NOT_FOUND");
    expect(await codeOf(service.decide(ADMIN, "nope", { version: 1, decision: "approve" }))).toBe("STAGE_APPROVAL_NOT_FOUND");
  });

  it("a role token still needs the person to SEE the item (an SMM who is neither assignee, creator nor on the team)", async () => {
    repo.rows.set("a1", row({}, { assignedBy: "admin" }));
    expect(await codeOf(decide(ROHAN))).toBe("STAGE_APPROVAL_NOT_FOUND");
  });

  it("team_managers: only a manager on the client's team; the client token matches no staff member", async () => {
    repo.rows.set("a1", row({ approvers: ["team_managers"] }, { teamIds: ["sara"] }));
    expect(await codeOf(decide(SARA))).toBeNull();
    repo.rows.set("a1", row({ approvers: ["team_managers"] }, { teamIds: ["sara"] }));
    expect(await codeOf(decide(ROHAN))).toBe("STAGE_APPROVAL_NOT_APPROVER");
    repo.rows.set("a1", row({ approvers: ["client"] }));
    expect(await codeOf(decide(ROHAN))).toBe("STAGE_APPROVAL_NOT_APPROVER");
    expect(await codeOf(decide(ADMIN))).toBe("STAGE_APPROVAL_NOT_APPROVER");
  });

  it("a task with no client has no team managers: nobody matches team_managers", async () => {
    repo.rows.set("a1", row({ approvers: ["team_managers"] }, { teamIds: [] }));
    expect(await codeOf(decide(ROHAN))).toBe("STAGE_APPROVAL_NOT_APPROVER");
    expect(await codeOf(decide(ADMIN))).toBe("STAGE_APPROVAL_NOT_APPROVER");
  });

  it("changes need a comment (400); with one it is recorded", async () => {
    expect(await codeOf(decide(ROHAN, { decision: "changes" }))).toBe("STAGE_APPROVAL_COMMENT_REQUIRED");
    expect(await codeOf(decide(ROHAN, { decision: "changes", comment: "  " }))).toBe("STAGE_APPROVAL_COMMENT_REQUIRED");
    await decide(ROHAN, { decision: "changes", comment: "Cut the intro" });
    expect(repo.writes).toEqual([{ status: "changes_requested", decidedBy: "rohan", decidedVia: "staff", comment: "Cut the intro", stampTime: true }]);
  });

  it("a decided or cancelled request is 409 NOT_PENDING; a stale version is 409 MODIFIED", async () => {
    expect(await codeOf(decide(ROHAN, { version: 9 }))).toBe("STAGE_APPROVAL_MODIFIED");
    repo.rows.set("a1", row({ status: "approved" }));
    expect(await codeOf(decide(ROHAN))).toBe("STAGE_APPROVAL_NOT_PENDING");
    repo.rows.set("a1", row({ status: "cancelled" }));
    expect(await codeOf(decide(ROHAN))).toBe("STAGE_APPROVAL_NOT_PENDING");
    expect(repo.writes).toEqual([]);
  });

  it("an event decision notifies the requester and the event's team", async () => {
    repo.rows.set("a1", row({ subject: "event", subjectId: "e1", approvers: ["team_managers"], requestedById: "rohan" }, { teamIds: ["sara"], assigneeId: null, assignedBy: null }));
    await decide(SARA);
    expect(notifier.decisions[0]!.recipientIds.sort()).toEqual(["rohan", "sara"]);
  });

  it("round 4: approving an event asks the work-tree notifier to look at it (it may have finished a part); changes and tasks do not", async () => {
    repo.rows.set("a1", row({ subject: "event", subjectId: "e1", approvers: ["team_managers"], requestedById: "rohan" }, { teamIds: ["sara"], assigneeId: null, assignedBy: null }));
    await decide(SARA);
    expect(changedChildren).toEqual([{ kind: "event", id: "e1", actorId: "sara" }]);

    changedChildren.length = 0;
    repo.rows.set("a1", row({ subject: "event", subjectId: "e1", approvers: ["team_managers"], requestedById: "rohan" }, { teamIds: ["sara"], assigneeId: null, assignedBy: null }));
    await decide(SARA, { decision: "changes", comment: "Recut it" });
    expect(changedChildren).toEqual([]);

    repo.rows.set("a1", row()); // a task approval (the default row)
    await decide(ROHAN);
    expect(changedChildren).toEqual([]);
  });
});

describe("cancel", () => {
  const cancel = (caller: ApprovalsCaller, version = 1) => service.cancel(caller, "a1", { version });

  it("the requester cancels their own request; nothing is stamped as decided", async () => {
    const a = await cancel(MEERA);
    expect(repo.writes).toEqual([{ status: "cancelled", decidedBy: null, decidedVia: null, comment: null, stampTime: false }]);
    expect(a.status).toBe("cancelled");
    expect(audit.map((e) => e.action)).toEqual(["approval.cancelled"]);
  });

  it("a manager of the item (the task's creator, the Admin) may cancel; another visible person gets 403; a stranger 404", async () => {
    expect(await codeOf(cancel(ROHAN))).toBeNull();
    repo.rows.set("a1", row());
    expect(await codeOf(cancel(ADMIN))).toBeNull();
    repo.rows.set("a1", row({}, { teamIds: ["sara"] }));
    expect(await codeOf(cancel(SARA))).toBe("FORBIDDEN");
    expect(await codeOf(cancel(ARJUN))).toBe("STAGE_APPROVAL_NOT_FOUND");
  });

  it("only a pending request, at the right version", async () => {
    expect(await codeOf(cancel(MEERA, 5))).toBe("STAGE_APPROVAL_MODIFIED");
    repo.rows.set("a1", row({ status: "approved" }));
    expect(await codeOf(cancel(MEERA))).toBe("STAGE_APPROVAL_NOT_PENDING");
  });
});

describe("list and count", () => {
  it("to_decide ignores a status filter; the other views pass it on; every row carries the caller's flags", async () => {
    const page = await service.list(ROHAN, { view: "to_decide", status: "approved", limit: 20, offset: 0 });
    expect(repo.lastFilters).toEqual({ view: "to_decide", status: undefined });
    expect(page).toMatchObject({ total: 7, limit: 20, offset: 0 });
    expect(page.approvals[0]).toMatchObject({ canDecide: true, canCancel: true });
    await service.list(ROHAN, { view: "all_visible", status: "approved", limit: 20, offset: 0 });
    expect(repo.lastFilters).toEqual({ view: "all_visible", status: "approved" });
  });

  it("count is the to_decide total", async () => {
    expect(await service.count(ROHAN)).toEqual({ toDecide: 7 });
  });
});

describe("the client's decision from the portal", () => {
  beforeEach(() => {
    repo.rows.set("a1", row({ subject: "event", subjectId: "e1", approvers: ["client"], requestedById: "rohan" }, { teamIds: ["rohan"], assigneeId: null, assignedBy: null }));
  });
  const portal = (o: { version?: number; decision?: "approve" | "changes"; comment?: string } = {}, id = "a1") =>
    service.decideFromPortal(PORTAL, id, { version: o.version ?? 1, decision: o.decision ?? "approve", comment: o.comment });

  it("approves: pinned to the link's client, decided_via portal with no staff id, audited with the link id and no actor, the team notified", async () => {
    expect(await portal()).toEqual({ ok: true });
    expect(repo.lastPin).toBe("c1");
    expect(repo.writes).toEqual([{ status: "approved", decidedBy: null, decidedVia: "portal", comment: null, stampTime: true }]);
    expect(audit[0]).toMatchObject({ action: "approval.decided", entityId: "a1", metadata: { decision: "approve", via: "portal", linkId: "link1" } });
    expect(audit[0]!.actorId).toBeUndefined();
    expect(notifier.decisions[0]).toMatchObject({ via: "portal", actorId: null });
    expect(notifier.decisions[0]!.recipientIds.sort()).toEqual(["rohan", "sara"]);
    // Round 4: the client's approval may have finished a part (the actor is null: no staff user).
    expect(changedChildren).toEqual([{ kind: "event", id: "e1", actorId: null }]);
  });

  it("changes need a comment (400); with one it is stored as given", async () => {
    expect(await codeOf(portal({ decision: "changes" }))).toBe("STAGE_APPROVAL_COMMENT_REQUIRED");
    await portal({ decision: "changes", comment: "<b>Logo</b> is too small" });
    expect(repo.writes[0]).toMatchObject({ status: "changes_requested", comment: "<b>Logo</b> is too small" });
  });

  it("every refusal is the same 404: no such approval (or another client's), a staff-only stage, already decided, a task approval", async () => {
    expect(await codeOf(portal({}, "nope"))).toBe("PORTAL_APPROVAL_NOT_FOUND");
    repo.rows.set("a1", row({ subject: "event", approvers: ["admin"] }));
    expect(await codeOf(portal())).toBe("PORTAL_APPROVAL_NOT_FOUND");
    repo.rows.set("a1", row({ subject: "event", approvers: ["client"], status: "approved" }));
    expect(await codeOf(portal())).toBe("PORTAL_APPROVAL_NOT_FOUND");
    repo.rows.set("a1", row({ subject: "task", approvers: ["client"] }));
    expect(await codeOf(portal())).toBe("PORTAL_APPROVAL_NOT_FOUND");
    expect(repo.writes).toEqual([]);
  });

  it("a stale version is 409 MODIFIED", async () => {
    expect(await codeOf(portal({ version: 4 }))).toBe("STAGE_APPROVAL_MODIFIED");
  });
});
