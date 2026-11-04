import { beforeEach, describe, expect, it } from "vitest";
import { EventsService, type EventsCaller } from "./events.service";
import { AppError } from "../../../common/errors/app-error";
import type { AuditEvent } from "../../../common/audit/audit-logger";
import type { EventDetailRecord, EventEntity, EventStage } from "../domain/event.entity";
import type { ApprovalRecord, ParentFacts, ParentRef, WorkChildRow, WorkKind, WorkParentRecord, WorkTreeNotifier } from "../../../domain";
import type { EventClient, EventTemplate } from "../domain/event.rules";
import type { EventChanges, EventListFilters, EventsRepositoryPort, NewEventRecord, StageMoveEntry } from "./ports/events-repository.port";
import type { EventQueryDto } from "../api/dto/event.dto";

/** EventsService against an in-memory fake: row scope via the client's owner, template copy, guarded edits and stage moves. */

const ADMIN: EventsCaller = { userId: "admin", role: "admin" };
const ROHAN: EventsCaller = { userId: "rohan", role: "social_media_manager" };
const SARA: EventsCaller = { userId: "sara", role: "marketing_manager" };

const STAGES: EventStage[] = [
  { id: "s1", position: 1, name: "Planned", approvers: [] },
  { id: "s2", position: 2, name: "Shoot", approvers: [] },
  { id: "s3", position: 3, name: "Editing", approvers: [] },
];

/** Stage 2 needs the Admin or the client's team managers, stage 3 the client. */
const GATED_STAGES: EventStage[] = [STAGES[0]!, { ...STAGES[1]!, approvers: ["admin", "team_managers"] }, { ...STAGES[2]!, approvers: ["client"] }];

function round(o: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    id: "a1",
    subject: "event",
    subjectId: "e1",
    subjectTitle: "Diwali shoot",
    clientName: "Acme",
    stageId: "s2",
    stageName: "Shoot",
    stagePosition: 2,
    approvers: ["admin", "team_managers"],
    status: "pending",
    requestNote: null,
    requestLink: null,
    requestedById: "rohan",
    requestedByName: "Rohan",
    requestedAt: "2026-10-14T00:00:00.000Z",
    decidedById: null,
    decidedByName: null,
    decidedVia: null,
    decidedAt: null,
    decisionComment: null,
    version: 1,
    ...o,
  };
}

function event(o: Partial<EventEntity> = {}): EventEntity {
  return {
    id: "e1",
    clientId: "c1",
    clientName: "Acme",
    ownerId: "rohan",
    teamIds: ["rohan"],
    clientStatus: "active",
    title: "Diwali shoot",
    type: "shoot",
    startsAt: "2026-10-20T04:30:00.000Z",
    endsAt: "2026-10-20T10:30:00.000Z",
    timeZone: "Asia/Kolkata",
    location: null,
    description: null,
    assignedTeam: [],
    templateId: "t1",
    templateName: "Photo Shoot",
    currentStageId: "s1",
    stageCount: 3,
    state: "active",
    parentRef: null,
    depth: 1,
    version: 1,
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
    ...o,
  };
}

/** The parent an event or task part is created under (round 4). */
function parentFacts(o: Partial<ParentFacts> = {}): ParentFacts {
  return {
    kind: "event",
    id: "p1",
    title: "10 reels",
    depth: 1,
    state: "active",
    clientId: "c1",
    clientStatus: "active",
    teamIds: ["rohan"],
    assigneeId: null,
    assignedBy: null,
    stageIds: ["ps1", "ps2"],
    parent: null,
    ...o,
  };
}

class FakeRepo implements EventsRepositoryPort {
  events = new Map<string, EventEntity>([["e1", event()]]);
  history: (StageMoveEntry & { from: string; to: string })[] = [];
  clients = new Map<string, EventClient>([
    ["c1", { id: "c1", teamIds: ["rohan"], status: "active", timeZone: "Asia/Kolkata" }],
    ["c2", { id: "c2", teamIds: ["sara"], status: "active", timeZone: "Asia/Dubai" }],
    ["c3", { id: "c3", teamIds: ["rohan"], status: "archived", timeZone: "UTC" }],
  ]);
  templates = new Map<string, EventTemplate>([
    ["t1", { id: "t1", name: "Photo Shoot", active: true, kind: "event", stageNames: ["Planned", "Shoot", "Editing"] }],
    ["t2", { id: "t2", name: "Old", active: false, kind: "event", stageNames: ["A"] }],
    ["t3", { id: "t3", name: "Reel edit", active: true, kind: "task", stageNames: ["Cut", "Done"] }],
  ]);
  activeProfiles = new Set(["rohan", "neha"]);
  stages: EventStage[] = STAGES;
  /** Stage ids holding an approved approval, and the rounds the detail lists. */
  approved = new Set<string>();
  rounds: ApprovalRecord[] = [];
  /** Round 4: unfinished children per stage id, the parents a part can be created under, and what the detail lists. */
  open = new Map<string, number>();
  parents = new Map<string, ParentFacts>();
  parentRecord: WorkParentRecord | null = null;
  childRows: WorkChildRow[] = [];
  childTotal = 0;
  created: NewEventRecord[] = [];
  lastFilters: EventListFilters | null = null;

  findMany(filters: EventListFilters) {
    this.lastFilters = filters;
    return Promise.resolve([]);
  }
  countMany() {
    return Promise.resolve(0);
  }
  findDetail(id: string): Promise<EventDetailRecord | null> {
    const e = this.events.get(id);
    return Promise.resolve(
      e
        ? {
            ...e,
            stages: this.stages.map((s) => ({ ...s, openChildren: this.open.get(s.id) ?? 0 })),
            history: [],
            team: [],
            approvalRecords: this.rounds,
            parentRecord: this.parentRecord,
            childRows: this.childRows,
            childTotal: this.childTotal,
          }
        : null,
    );
  }
  findParent(kind: WorkKind, id: string) {
    return Promise.resolve(this.parents.get(`${kind}:${id}`) ?? null);
  }
  findClient(id: string) {
    return Promise.resolve(this.clients.get(id) ?? null);
  }
  findTemplate(id: string) {
    return Promise.resolve(this.templates.get(id) ?? null);
  }
  findActiveProfileIds(ids: readonly string[]) {
    return Promise.resolve(new Set(ids.filter((i) => this.activeProfiles.has(i))));
  }
  create(record: NewEventRecord, guard: (client: EventClient) => void, guardParent?: (parent: ParentFacts) => void) {
    guard(this.clients.get(record.clientId)!);
    // The repository re-reads the parent under its lock and runs the guard on that row.
    if (record.parent) guardParent?.(this.parents.get(`${record.parent.kind}:${record.parent.id}`)!);
    this.created.push(record);
    const client = this.clients.get(record.clientId)!;
    this.events.set("new", event({ id: "new", clientId: record.clientId, teamIds: client.teamIds, timeZone: record.timeZone, title: record.title }));
    return Promise.resolve("new");
  }
  update(id: string, decide: (current: EventEntity) => EventChanges) {
    const current = this.events.get(id);
    if (!current) return Promise.reject(new AppError(404, "nf", "EVENT_NOT_FOUND"));
    this.events.set(id, { ...current, ...(decide(current) as Partial<EventEntity>), version: current.version + 1 });
    return Promise.resolve();
  }
  moveStage(
    id: string,
    decide: (current: EventEntity, stages: EventStage[], approved: ReadonlySet<string>, openChildren: ReadonlyMap<string, number>) => EventStage,
    entry: StageMoveEntry,
  ) {
    const current = this.events.get(id)!;
    const target = decide(current, this.stages, this.approved, this.open);
    this.history.push({ ...entry, from: current.currentStageId, to: target.id });
    this.events.set(id, { ...current, currentStageId: target.id, version: current.version + 1 });
    // A back move drops the approvals of the stages from the target on (the repository does this in SQL).
    const from = this.stages.find((s) => s.id === current.currentStageId)!;
    const dropped = target.position < from.position ? this.stages.filter((s) => s.position >= target.position && this.approved.delete(s.id)).length : 0;
    return Promise.resolve({ superseded: dropped, cancelled: 0 });
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

const query = (q: Partial<EventQueryDto> = {}): EventQueryDto => ({
  limit: 50,
  offset: 0,
  clientId: undefined,
  ownerId: undefined,
  from: undefined,
  to: undefined,
  state: undefined,
  type: undefined,
  search: undefined,
  ...q,
});

const newEvent = {
  clientId: "c1",
  templateId: "t1",
  title: "Launch",
  type: "campaign" as const,
  startsAt: "2026-11-01T09:00:00+05:30",
  endsAt: "2026-11-01T12:00:00+05:30",
};

describe("EventsService", () => {
  let repo: FakeRepo;
  let audit: AuditEvent[];
  let service: EventsService;
  /** Parents whose stage the service asked the work-tree notifier to re-check. */
  let cleared: { parent: ParentRef; actorId: string | null }[];

  beforeEach(() => {
    repo = new FakeRepo();
    audit = [];
    cleared = [];
    const workTree: WorkTreeNotifier = {
      stageMayBeClear: (parent, actorId) => (cleared.push({ parent, actorId }), Promise.resolve()),
      childChanged: () => Promise.resolve(),
    };
    service = new EventsService(repo, { record: (e) => (audit.push(e), Promise.resolve()) }, workTree);
  });

  describe("list", () => {
    it("pins a manager to their own clients' events; the Admin may filter by owner; the range is validated", async () => {
      await service.list(ROHAN, query({ ownerId: "sara" }));
      expect(repo.lastFilters?.ownerId).toBe("rohan");
      await service.list(ADMIN, query({ ownerId: "sara", from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" }));
      expect(repo.lastFilters).toMatchObject({ ownerId: "sara", range: { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" } });
      expect(await codeOf(service.list(ADMIN, query({ from: "2026-10-01T00:00:00Z" })))).toBe("EVENT_RANGE_INVALID");
    });
  });

  describe("get", () => {
    it("is a 404 for another manager's event", async () => {
      expect((await service.get(ROHAN, "e1")).id).toBe("e1");
      expect(await codeOf(service.get(SARA, "e1"))).toBe("EVENT_NOT_FOUND");
      expect((await service.get(ADMIN, "e1")).stages).toHaveLength(3);
    });
  });

  describe("create", () => {
    it("copies the template's stages in order, defaults to the client's time zone, and audits", async () => {
      await service.create(ROHAN, newEvent);
      expect(repo.created[0]).toMatchObject({ stageNames: ["Planned", "Shoot", "Editing"], templateName: "Photo Shoot", timeZone: "Asia/Kolkata", createdBy: "rohan" });
      expect(audit[0]).toMatchObject({ action: "event.created", entityId: "new" });
    });

    it("round 3: copies each template stage's approvers onto the event (a snapshot, in the same order)", async () => {
      repo.templates.set("t4", { id: "t4", name: "Sign-off", active: true, kind: "event", stageNames: ["Plan", "Client review"], stageApprovers: [[], ["client", "team_managers"]] });
      await service.create(ROHAN, { ...newEvent, templateId: "t4" });
      expect(repo.created[0]).toMatchObject({ stageNames: ["Plan", "Client review"], stageApprovers: [[], ["client", "team_managers"]] });
    });

    it("refuses another manager's client (404), an archived client (409), an inactive or task template, bad times and an unknown team member", async () => {
      expect(await codeOf(service.create(ROHAN, { ...newEvent, clientId: "c2" }))).toBe("CLIENT_NOT_FOUND");
      expect(await codeOf(service.create(ROHAN, { ...newEvent, clientId: "c3" }))).toBe("CLIENT_ARCHIVED");
      expect(await codeOf(service.create(ROHAN, { ...newEvent, templateId: "t2" }))).toBe("EVENT_TEMPLATE_INVALID");
      expect(await codeOf(service.create(ROHAN, { ...newEvent, templateId: "t3" }))).toBe("EVENT_TEMPLATE_INVALID"); // a task template
      expect(await codeOf(service.create(ROHAN, { ...newEvent, endsAt: "2026-11-01T08:00:00+05:30" }))).toBe("EVENT_TIMES_INVALID");
      expect(await codeOf(service.create(ROHAN, { ...newEvent, assignedTeam: ["neha", "ghost"] }))).toBe("EVENT_TEAM_INVALID");
    });

    it("lets the Admin create under any client", async () => {
      await service.create(ADMIN, { ...newEvent, clientId: "c2" });
      expect(repo.created[0]?.timeZone).toBe("Asia/Dubai");
    });
  });

  describe("update", () => {
    it("reschedules, cancels and checks times against the stored ones", async () => {
      const updated = await service.update(ROHAN, "e1", { state: "cancelled", endsAt: "2026-10-20T12:00:00Z", version: 1 });
      expect(updated).toMatchObject({ state: "cancelled", version: 2 });
      expect(audit[0]).toMatchObject({ action: "event.updated", metadata: { fields: ["endsAt", "state"] } });
      expect(await codeOf(service.update(ROHAN, "e1", { endsAt: "2026-10-19T00:00:00Z", version: 2 }))).toBe("EVENT_TIMES_INVALID");
    });

    it("404 for another manager (even with a stale version), 409 when stale, 409 when the client is archived", async () => {
      expect(await codeOf(service.update(SARA, "e1", { title: "x", version: 9 }))).toBe("EVENT_NOT_FOUND");
      expect(await codeOf(service.update(ROHAN, "e1", { title: "x", version: 9 }))).toBe("EVENT_MODIFIED");
      repo.events.set("e1", event({ clientStatus: "archived" }));
      expect(await codeOf(service.update(ROHAN, "e1", { title: "x", version: 1 }))).toBe("CLIENT_ARCHIVED");
      expect(await codeOf(service.update(ROHAN, "e1", { version: 1 }))).toBe("VALIDATION_NO_FIELDS");
    });
  });

  describe("moveStage", () => {
    it("moves forward and back, recording each move with its note and visibility", async () => {
      await service.moveStage(ROHAN, "e1", { stageId: "s3", note: "Editing now", visibleToClient: true, version: 1 });
      await service.moveStage(ROHAN, "e1", { stageId: "s2", note: null, visibleToClient: false, version: 2 });
      expect(repo.history).toEqual([
        { note: "Editing now", visibleToClient: true, changedBy: "rohan", from: "s1", to: "s3" },
        { note: null, visibleToClient: false, changedBy: "rohan", from: "s3", to: "s2" },
      ]);
    });

    it("refuses the same stage, a foreign stage, a cancelled event, a stale version and another manager", async () => {
      expect(await codeOf(service.moveStage(ROHAN, "e1", { stageId: "s1", note: null, visibleToClient: false, version: 1 }))).toBe("EVENT_STAGE_UNCHANGED");
      expect(await codeOf(service.moveStage(ROHAN, "e1", { stageId: "zz", note: null, visibleToClient: false, version: 1 }))).toBe("EVENT_STAGE_INVALID");
      expect(await codeOf(service.moveStage(ROHAN, "e1", { stageId: "s2", note: null, visibleToClient: false, version: 7 }))).toBe("EVENT_MODIFIED");
      expect(await codeOf(service.moveStage(SARA, "e1", { stageId: "s2", note: null, visibleToClient: false, version: 1 }))).toBe("EVENT_NOT_FOUND");
      repo.events.set("e1", event({ state: "postponed" }));
      expect(await codeOf(service.moveStage(ROHAN, "e1", { stageId: "s2", note: null, visibleToClient: false, version: 1 }))).toBe("EVENT_NOT_ACTIVE");
    });

    const move = (stageId: string, version: number) => service.moveStage(ROHAN, "e1", { stageId, note: null, visibleToClient: false, version });

    it("round 3: enters an approval stage but can't pass it until it is approved", async () => {
      repo.stages = GATED_STAGES;
      await move("s2", 1);
      expect(await codeOf(move("s3", 2))).toBe("STAGE_APPROVAL_REQUIRED");
      repo.approved.add("s2");
      await move("s3", 2);
      expect(repo.events.get("e1")!.currentStageId).toBe("s3");
    });

    it("round 3: a jump over an unapproved approval stage is refused, a jump onto it is allowed", async () => {
      repo.stages = GATED_STAGES;
      expect(await codeOf(move("s3", 1))).toBe("STAGE_APPROVAL_REQUIRED");
      expect(await codeOf(move("s2", 1))).toBeNull();
    });

    it("round 3: a back move is always allowed, and one that drops approvals leaves one audit entry with the count", async () => {
      repo.stages = GATED_STAGES;
      repo.approved = new Set(["s2", "s3"]);
      repo.events.set("e1", event({ currentStageId: "s3" }));
      await move("s1", 1);
      expect(repo.approved.size).toBe(0);
      expect(audit.filter((a) => a.action === "approval.superseded").map((a) => a.metadata)).toEqual([{ superseded: 2, cancelled: 0 }]);
    });

    it("round 3: a move that drops nothing writes no superseded audit entry", async () => {
      await move("s3", 1);
      await move("s1", 2);
      expect(audit.some((a) => a.action === "approval.superseded")).toBe(false);
    });
  });

  describe("approvals in the detail", () => {
    it("gives each round the caller's flags and names the stage that blocks forward moves", async () => {
      repo.stages = GATED_STAGES;
      repo.rounds = [round()];
      const asAdmin = await service.get(ADMIN, "e1");
      expect(asAdmin.stages.map((s) => s.approvers)).toEqual([[], ["admin", "team_managers"], ["client"]]);
      expect(asAdmin.nextBlockedBy).toEqual({ stageId: "s2", stageName: "Shoot", reason: "approval", openChildren: 0 });
      expect(asAdmin.approvals[0]).toMatchObject({ canDecide: true, canCancel: true });
      // Rohan is on the team and could decide as a team manager, but it is his own request.
      const asRequester = await service.get(ROHAN, "e1");
      expect(asRequester.approvals[0]).toMatchObject({ canDecide: false, canCancel: true });
    });

    it("an approved stage no longer blocks, and a plain event has nothing to show", async () => {
      repo.stages = GATED_STAGES;
      repo.rounds = [round({ status: "approved" })];
      const approvedView = await service.get(ADMIN, "e1");
      expect(approvedView.nextBlockedBy).toEqual({ stageId: "s3", stageName: "Editing", reason: "approval", openChildren: 0 });
      expect(approvedView.approvals[0]).toMatchObject({ canDecide: false, canCancel: false });
      repo.stages = STAGES;
      repo.rounds = [];
      expect(await service.get(ADMIN, "e1")).toMatchObject({ approvals: [], nextBlockedBy: null });
    });
  });

  // -- round 4: parent and child work -------------------------------------------------------

  describe("the move gate with parts", () => {
    const move = (caller: EventsCaller, stageId: string, version: number) =>
      service.moveStage(caller, "e1", { stageId, note: null, visibleToClient: false, version });

    it("the user's example: can enter the stage with open parts, not pass it or jump over it", async () => {
      repo.open.set("s2", 10);
      expect(await codeOf(move(ROHAN, "s2", 1))).toBeNull();
      expect(await codeOf(move(ROHAN, "s3", 2))).toBe("STAGE_CHILDREN_OPEN");
      repo.events.set("e1", event({ currentStageId: "s1", version: 3 }));
      expect(await codeOf(move(ROHAN, "s3", 3))).toBe("STAGE_CHILDREN_OPEN"); // a jump over it
      expect(repo.events.get("e1")!.currentStageId).toBe("s1");
    });

    it("moves on once the last open part is finished, and back moves are never blocked", async () => {
      repo.open.set("s2", 1);
      await move(ROHAN, "s2", 1);
      expect(await codeOf(move(ROHAN, "s3", 2))).toBe("STAGE_CHILDREN_OPEN");
      repo.open.clear();
      expect(await codeOf(move(ROHAN, "s3", 2))).toBeNull();
      repo.open.set("s2", 4);
      expect(await codeOf(move(ROHAN, "s1", 3))).toBeNull();
    });

    it("the Admin is gated too", async () => {
      repo.open.set("s2", 2);
      repo.events.set("e1", event({ currentStageId: "s2", version: 1 }));
      expect(await codeOf(move(ADMIN, "s3", 1))).toBe("STAGE_CHILDREN_OPEN");
    });

    it("with an unapproved approval AND open parts on one stage the approval error comes first", async () => {
      repo.stages = GATED_STAGES;
      repo.open.set("s2", 3);
      await move(ROHAN, "s2", 1);
      expect(await codeOf(move(ROHAN, "s3", 2))).toBe("STAGE_APPROVAL_REQUIRED");
      repo.approved.add("s2");
      expect(await codeOf(move(ROHAN, "s3", 2))).toBe("STAGE_CHILDREN_OPEN");
    });

    it("the detail reports the stage's count and why it blocks", async () => {
      repo.open.set("s2", 3);
      const view = await service.get(ROHAN, "e1");
      expect(view.stages.map((s) => s.openChildren)).toEqual([0, 3, 0]);
      expect(view.nextBlockedBy).toEqual({ stageId: "s2", stageName: "Shoot", reason: "children", openChildren: 3 });
    });
  });

  describe("creating a part", () => {
    const parent = { kind: "event" as const, id: "p1", stageId: "ps1" };

    it("takes the parent's client, writes the parent pointer and audits it", async () => {
      repo.parents.set("event:p1", parentFacts());
      await service.create(ROHAN, { ...newEvent, parent });
      expect(repo.created[0]).toMatchObject({ clientId: "c1", parent });
      expect(audit[0]).toMatchObject({ action: "event.created", metadata: { clientId: "c1", parent } });
    });

    it("a task parent works the same, with the task's client", async () => {
      repo.parents.set("task:t9", parentFacts({ kind: "task", id: "t9", state: "in_progress", assigneeId: "rohan", assignedBy: "rohan", stageIds: ["k1"] }));
      await service.create(ROHAN, { ...newEvent, parent: { kind: "task", id: "t9", stageId: "k1" } });
      expect(repo.created[0]?.parent).toEqual({ kind: "task", id: "t9", stageId: "k1" });
    });

    it("a task without a client can't have child events (400), a different client is a 400", async () => {
      repo.parents.set("task:t9", parentFacts({ kind: "task", id: "t9", clientId: null, teamIds: [], state: "todo", assigneeId: "rohan", assignedBy: "rohan", stageIds: ["k1"] }));
      expect(await codeOf(service.create(ROHAN, { ...newEvent, parent: { kind: "task", id: "t9", stageId: "k1" } }))).toBe("WORK_CHILD_EVENT_NEEDS_CLIENT");
      repo.parents.set("event:p1", parentFacts());
      expect(await codeOf(service.create(ROHAN, { ...newEvent, clientId: "c3", parent }))).toBe("WORK_CHILD_CLIENT_MISMATCH");
      expect(repo.created).toHaveLength(0);
    });

    it("refuses an unseen parent (404, same as missing), a wrong stage, too deep, a cancelled or postponed parent", async () => {
      repo.parents.set("event:p1", parentFacts({ teamIds: ["sara"] }));
      expect(await codeOf(service.create(ROHAN, { ...newEvent, parent }))).toBe("EVENT_NOT_FOUND");
      expect(await codeOf(service.create(ROHAN, { ...newEvent, parent: { kind: "event", id: "nobody", stageId: "ps1" } }))).toBe("EVENT_NOT_FOUND");
      repo.parents.set("event:p1", parentFacts());
      expect(await codeOf(service.create(ROHAN, { ...newEvent, parent: { ...parent, stageId: "elsewhere" } }))).toBe("WORK_PARENT_STAGE_INVALID");
      repo.parents.set("event:p1", parentFacts({ depth: 3 }));
      expect(await codeOf(service.create(ROHAN, { ...newEvent, parent }))).toBe("WORK_TOO_DEEP");
      repo.parents.set("event:p1", parentFacts({ state: "cancelled" }));
      expect(await codeOf(service.create(ROHAN, { ...newEvent, parent }))).toBe("EVENT_NOT_ACTIVE");
      repo.parents.set("event:p1", parentFacts({ state: "postponed" }));
      expect(await codeOf(service.create(ROHAN, { ...newEvent, parent }))).toBe("EVENT_NOT_ACTIVE");
      expect(repo.created).toHaveLength(0);
    });

    it("a task parent the caller sees but can't move is a 403", async () => {
      repo.parents.set("task:t9", parentFacts({ kind: "task", id: "t9", state: "todo", assigneeId: "ed", assignedBy: "admin", stageIds: ["k1"] }));
      expect(await codeOf(service.create(ROHAN, { ...newEvent, parent: { kind: "task", id: "t9", stageId: "k1" } }))).toBe("STAFF_TASK_FORBIDDEN");
    });

    it("the parent is checked again on the locked row (it may have been cancelled meanwhile)", async () => {
      repo.parents.set("event:p1", parentFacts());
      // The earlier read sees an active parent; the locked row (what the guard receives) is cancelled.
      const origCreate = repo.create.bind(repo);
      repo.create = (record, guard, guardParent) => {
        repo.parents.set("event:p1", parentFacts({ state: "cancelled" }));
        return origCreate(record, guard, guardParent);
      };
      expect(await codeOf(service.create(ROHAN, { ...newEvent, parent }))).toBe("EVENT_NOT_ACTIVE");
    });
  });

  describe("telling the parent's people", () => {
    const part = { kind: "event" as const, id: "p1", stageId: "ps2" };

    it("a part moved onto its last stage asks the work-tree notifier to re-check its parent's stage", async () => {
      repo.events.set("e1", event({ parentRef: part }));
      await service.moveStage(ROHAN, "e1", { stageId: "s2", note: null, visibleToClient: false, version: 1 });
      expect(cleared).toEqual([]); // not the last stage yet
      await service.moveStage(ROHAN, "e1", { stageId: "s3", note: null, visibleToClient: false, version: 2 });
      expect(cleared).toEqual([{ parent: part, actorId: "rohan" }]);
    });

    it("cancelling a part (or reactivating a postponed one) asks for the re-check; other edits do not", async () => {
      repo.events.set("e1", event({ parentRef: part }));
      await service.update(ROHAN, "e1", { title: "New title", version: 1 });
      expect(cleared).toEqual([]);
      await service.update(ROHAN, "e1", { state: "cancelled", version: 2 });
      expect(cleared).toHaveLength(1);
      await service.update(ROHAN, "e1", { state: "cancelled", version: 3 }); // no change of state
      expect(cleared).toHaveLength(1);
    });

    it("a top-level event never asks", async () => {
      await service.moveStage(ROHAN, "e1", { stageId: "s3", note: null, visibleToClient: false, version: 1 });
      await service.update(ROHAN, "e1", { state: "cancelled", version: 2 });
      expect(cleared).toEqual([]);
    });
  });

  describe("parts in the detail", () => {
    const childRow = (o: Partial<WorkChildRow>): WorkChildRow => ({
      kind: "event",
      id: "c-1",
      title: "Reel 1",
      stageId: "s2",
      stageName: "Shoot",
      stagePosition: 2,
      currentStageName: "Rough cut",
      currentPosition: 1,
      stageCount: 3,
      status: null,
      state: "active",
      finished: false,
      assigneeName: null,
      createdAt: "2026-11-05T10:00:00.000Z",
      teamIds: ["rohan"],
      assigneeId: null,
      assignedBy: null,
      ...o,
    });

    it("lists the parts the caller sees, counts the others, and leaks no internal field", async () => {
      repo.childRows = [childRow({}), childRow({ id: "c-2", title: "Hidden reel", teamIds: ["sara"] })];
      repo.childTotal = 2;
      const view = await service.get(ROHAN, "e1");
      expect(view.children.map((c) => c.id)).toEqual(["c-1"]);
      expect(view.hiddenChildren).toBe(1);
      expect(JSON.stringify(view)).not.toContain("Hidden reel");
      expect(view).not.toHaveProperty("childRows");
      expect(view).not.toHaveProperty("parentRef");
      expect(view).not.toHaveProperty("depth");
    });

    it("the parent stub shows only to someone who can see the parent", async () => {
      repo.parentRecord = { kind: "event", id: "p1", title: "10 reels", stageId: "ps1", stageName: "Production", teamIds: ["sara"], assigneeId: null, assignedBy: null };
      expect((await service.get(ADMIN, "e1")).parent).toEqual({ kind: "event", id: "p1", title: "10 reels", stageId: "ps1", stageName: "Production" });
      expect((await service.get(ROHAN, "e1")).parent).toBeNull(); // Rohan isn't on the parent's client team
    });
  });
});
