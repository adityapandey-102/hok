import { beforeEach, describe, expect, it } from "vitest";
import { StaffTasksService, type StaffTasksCaller } from "./staff-tasks.service";
import { AppError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import type { AuditEvent } from "../../../common/audit/audit-logger";
import type { ApprovalRecord, ParentFacts, ParentRef, Role, WorkChildRow, WorkKind, WorkParentRecord, WorkTreeNotifier } from "../../../domain";
import type { StaffTaskDetail, StaffTaskEntity, StaffTaskLink, TaskStageFull } from "../domain/staff-task.entity";
import type { AssigneeCandidate, TaskEventRef, TaskTemplate } from "../domain/staff-task.rules";
import type {
  LinkTargetContext,
  LinkWriteContext,
  NewStaffTaskRecord,
  NewTaskLink,
  ShareEventContext,
  ShareInput,
  StaffTaskChangeDecision,
  StaffTaskListFilters,
  StaffTasksRepositoryPort,
  StaffTaskUpdateEntry,
} from "./ports/staff-tasks-repository.port";
import type { StaffTaskNotifier, TaskChangeAction } from "./ports/staff-task-notifier.port";
import type { StaffTaskQueryDto } from "../api/dto/staff-task.dto";

/**
 * StaffTasksService against an in-memory fake: management by the Admin and creators, the visibility scope, the
 * assignment ladder, templates and stages, the derived status, blocking, links, sharing with the client and the
 * notification hooks. SQL is covered by the integration suite.
 */

const ADMIN: StaffTasksCaller = { userId: "admin", role: "admin" };
const MEERA: StaffTasksCaller = { userId: "meera", role: "editor" };
const ARJUN: StaffTasksCaller = { userId: "arjun", role: "developer" };
const ROHAN: StaffTasksCaller = { userId: "rohan", role: "social_media_manager" };
/** A second manager, on client c2's team only. */
const PIA: StaffTasksCaller = { userId: "pia", role: "marketing_manager" };
const DRIVE = "https://drive.google.com/drive/folders/raw";

/** The three stages every fake task has. */
const STAGES: TaskStageFull[] = [
  { id: "s1", position: 1, name: "Brief", approvers: [] },
  { id: "s2", position: 2, name: "Cut", approvers: [] },
  { id: "s3", position: 3, name: "Review", approvers: [] },
];

/** The user's example, scaled down: stage 2 is approved by a Social Media Manager or the Admin, stage 3 by the Admin only. */
const GATED_STAGES: TaskStageFull[] = [STAGES[0]!, { ...STAGES[1]!, approvers: ["social_media_manager", "admin"] }, { ...STAGES[2]!, approvers: ["admin"] }];

function round(o: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    id: "a1",
    subject: "task",
    subjectId: "t1",
    subjectTitle: "Edit the Diwali reel",
    clientName: null,
    stageId: "s2",
    stageName: "Cut",
    stagePosition: 2,
    approvers: ["social_media_manager", "admin"],
    status: "pending",
    requestNote: null,
    requestLink: null,
    requestedById: "meera",
    requestedByName: "Meera",
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

function task(o: Partial<StaffTaskEntity> = {}): StaffTaskEntity {
  return {
    id: "t1",
    title: "Edit the Diwali reel",
    description: null,
    brief: null,
    assigneeId: "meera",
    assigneeName: "Meera",
    assigneeRole: "editor",
    assignedBy: "admin",
    assignedByName: "Aisha",
    clientId: null,
    clientName: null,
    teamIds: [],
    eventId: null,
    dueAt: null,
    priority: "medium",
    status: "todo",
    templateName: "Reel edit",
    stageCount: 3,
    currentStage: STAGES[0]!,
    blockedReason: null,
    completedAt: null,
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
    kind: "task",
    id: "t1",
    title: "Edit the Diwali reel",
    depth: 1,
    state: "in_progress",
    clientId: null,
    clientStatus: null,
    teamIds: [],
    assigneeId: "meera",
    assignedBy: "rohan",
    stageIds: ["s1", "s2", "s3"],
    parent: null,
    ...o,
  };
}

function link(o: Partial<StaffTaskLink> = {}): StaffTaskLink {
  return { id: "l1", kind: "delivered", url: DRIVE, label: "First cut", stageId: null, stageName: null, addedById: "meera", addedByName: "Meera", createdAt: "2026-10-14T00:00:00.000Z", sharedAssetId: null, ...o };
}

type Entry = StaffTaskUpdateEntry & { taskId: string; from: string; to?: string };

class FakeRepo implements StaffTasksRepositoryPort {
  tasks = new Map<string, StaffTaskEntity>([
    ["t1", task()],
    ["t2", task({ id: "t2", title: "Fix the site", assigneeId: "arjun", assigneeName: "Arjun", assigneeRole: "developer" })],
  ]);
  links = new Map<string, StaffTaskLink[]>();
  /** Round 3: the stages every fake task has, the stage ids holding an approved approval, and the rounds a detail lists. */
  stages: TaskStageFull[] = STAGES;
  approved = new Set<string>();
  rounds: ApprovalRecord[] = [];
  /** Round 4: unfinished children per stage id, the parents a part can be created under, and what the detail lists. */
  open = new Map<string, number>();
  parents = new Map<string, ParentFacts>();
  parentRecord: WorkParentRecord | null = null;
  childRows: WorkChildRow[] = [];
  childTotal = 0;
  people = new Map<string, AssigneeCandidate>(
    (
      [
        ["admin", "admin", true],
        ["meera", "editor", true],
        ["arjun", "developer", true],
        ["rohan", "social_media_manager", true],
        ["pia", "marketing_manager", true],
        ["gone", "editor", false],
      ] as [string, Role, boolean][]
    ).map(([id, role, active]) => [id, { id, role, active }]),
  );
  /** client id -> team (profile ids). */
  clients = new Map<string, string[]>([
    ["c1", ["rohan"]],
    ["c2", ["pia"]],
  ]);
  events = new Map<string, TaskEventRef>([["e1", { id: "e1", clientId: "c1", title: "Shoot", teamIds: ["rohan"] }]]);
  templates = new Map<string, TaskTemplate>([
    ["tpl-reel", { id: "tpl-reel", name: "Reel edit", active: true, kind: "task", roles: ["editor"], stageNames: ["Brief", "Cut", "Review"] }],
    ["tpl-any", { id: "tpl-any", name: "General", active: true, kind: "task", roles: [], stageNames: ["To do", "Done"] }],
    ["tpl-old", { id: "tpl-old", name: "Old", active: false, kind: "task", roles: [], stageNames: ["A"] }],
    ["tpl-event", { id: "tpl-event", name: "Photo shoot", active: true, kind: "event", roles: [], stageNames: ["Planned", "Done"] }],
  ]);
  entries: Entry[] = [];
  comments: { taskId: string; authorId: string; comment: string }[] = [];
  created: NewStaffTaskRecord[] = [];
  shared: { taskId: string; linkId: string; input: ShareInput }[] = [];
  lastFilters: StaffTaskListFilters | null = null;

  findMany(filters: StaffTaskListFilters) {
    this.lastFilters = filters;
    return Promise.resolve([]);
  }
  countMany() {
    return Promise.resolve(0);
  }
  findById(id: string) {
    return Promise.resolve(this.tasks.get(id) ?? null);
  }
  findDetail(id: string): Promise<StaffTaskDetail | null> {
    const t = this.tasks.get(id);
    return Promise.resolve(
      t
        ? {
            ...t,
            eventTitle: null,
            stages: this.stages.map((s) => ({ ...s, openChildren: this.open.get(s.id) ?? 0 })),
            links: this.links.get(id) ?? [],
            approvalRecords: this.rounds,
            parentRecord: this.parentRecord,
            childRows: this.childRows,
            childTotal: this.childTotal,
            updates: [],
          }
        : null,
    );
  }
  findParent(kind: WorkKind, id: string) {
    return Promise.resolve(this.parents.get(`${kind}:${id}`) ?? null);
  }
  findAssigneeCandidate(id: string) {
    return Promise.resolve(this.people.get(id) ?? null);
  }
  findClient(id: string) {
    const teamIds = this.clients.get(id);
    return Promise.resolve(teamIds ? { id, teamIds } : null);
  }
  findEvent(id: string) {
    return Promise.resolve(this.events.get(id) ?? null);
  }
  findTemplate(id: string) {
    return Promise.resolve(this.templates.get(id) ?? null);
  }
  create(record: NewStaffTaskRecord, guardParent?: (parent: ParentFacts) => void) {
    // The repository re-reads the parent under its lock and runs the guard on that row.
    if (record.parent) guardParent?.(this.parents.get(`${record.parent.kind}:${record.parent.id}`)!);
    this.created.push(record);
    const p = this.people.get(record.assigneeId)!;
    const { links, stageNames, templateId: _templateId, parent, ...rest } = record;
    this.tasks.set(
      "new",
      task({ ...rest, parentRef: parent ?? null, id: "new", assigneeRole: p.role, assigneeName: p.id, stageCount: stageNames.length, currentStage: { id: "n1", position: 1, name: stageNames[0]! } }),
    );
    this.links.set(
      "new",
      links.map((l, i) => link({ id: `nl${i}`, kind: "brief", url: l.url, label: l.label, addedById: record.assignedBy })),
    );
    return Promise.resolve("new");
  }
  update(id: string, decide: StaffTaskChangeDecision, options: { openChildrenGate?: boolean } = {}) {
    const current = this.tasks.get(id);
    if (!current) return Promise.reject(new AppError(404, "nf", "STAFF_TASK_NOT_FOUND"));
    let c;
    try {
      c = decide(current, this.stages, this.approved, options.openChildrenGate ? this.open : new Map());
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
    if (c.entry) this.entries.push({ ...c.entry, taskId: id, from: current.status, to: c.status });
    const assigneeRole = c.assigneeId ? this.people.get(c.assigneeId)!.role : current.assigneeRole;
    this.tasks.set(id, {
      ...current,
      ...c.fields,
      ...(c.assigneeId ? { assigneeId: c.assigneeId, assigneeRole } : {}),
      ...(c.status ? { status: c.status, completedAt: c.status === "done" ? "now" : null } : {}),
      ...(c.stageId ? { currentStage: this.stages.find((s) => s.id === c.stageId)! } : {}),
      ...(c.blockedReason !== undefined ? { blockedReason: c.blockedReason } : {}),
      version: current.version + 1,
    });
    // A back move or reopen drops the approvals of the stages from the target on (the repository does this in SQL).
    const from = c.supersedeFromPosition;
    const dropped = from === undefined ? 0 : this.stages.filter((s) => s.position >= from && this.approved.delete(s.id)).length;
    return Promise.resolve({ superseded: dropped, cancelled: 0 });
  }
  addComment(id: string, guard: (t: StaffTaskEntity) => void, authorId: string, comment: string) {
    const current = this.tasks.get(id);
    if (!current) return Promise.reject(new AppError(404, "nf", "STAFF_TASK_NOT_FOUND"));
    guard(current);
    this.comments.push({ taskId: id, authorId, comment });
    return Promise.resolve();
  }
  delete(id: string, guard: (t: StaffTaskEntity) => void) {
    const current = this.tasks.get(id)!;
    guard(current);
    this.tasks.delete(id);
    return Promise.resolve(current);
  }
  addLink(taskId: string, guard: (ctx: LinkWriteContext) => void, l: NewTaskLink) {
    const current = this.tasks.get(taskId);
    if (!current) return Promise.reject(new AppError(404, "nf", "STAFF_TASK_NOT_FOUND"));
    const list = this.links.get(taskId) ?? [];
    try {
      guard({ task: current, stages: STAGES, linkCount: list.length });
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
    const id = `l${list.length + 1}`;
    this.links.set(taskId, [...list, link({ id, kind: l.kind, url: l.url, label: l.label, stageId: l.stageId, addedById: l.addedBy })]);
    return Promise.resolve(id);
  }
  removeLink(taskId: string, linkId: string, guard: (ctx: LinkTargetContext) => void) {
    const current = this.tasks.get(taskId);
    const found = (this.links.get(taskId) ?? []).find((l) => l.id === linkId);
    if (!current) return Promise.reject(new AppError(404, "nf", "STAFF_TASK_NOT_FOUND"));
    if (!found) return Promise.reject(new NotFoundError("Link not found", ERROR_CODES.STAFF_TASK_LINK_NOT_FOUND));
    try {
      guard({ task: current, link: found });
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
    this.links.set(taskId, (this.links.get(taskId) ?? []).filter((l) => l.id !== linkId));
    return Promise.resolve(found);
  }
  shareLink(taskId: string, linkId: string, input: ShareInput, guard: (ctx: LinkTargetContext, event: ShareEventContext | null) => void) {
    const current = this.tasks.get(taskId);
    const found = (this.links.get(taskId) ?? []).find((l) => l.id === linkId);
    if (!current) return Promise.reject(new AppError(404, "nf", "STAFF_TASK_NOT_FOUND"));
    if (!found) return Promise.reject(new NotFoundError("Link not found", ERROR_CODES.STAFF_TASK_LINK_NOT_FOUND));
    const ev = current.eventId ? this.events.get(current.eventId) : undefined;
    const event: ShareEventContext | null = ev
      ? { eventId: ev.id, clientId: ev.clientId, teamIds: this.clients.get(ev.clientId) ?? [], clientStatus: "active", stageIds: ["es1", "es2"] }
      : null;
    try {
      guard({ task: current, link: found }, event);
      if (!event) throw new ConflictError("no event", ERROR_CODES.STAFF_TASK_NO_EVENT);
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
    this.shared.push({ taskId, linkId, input });
    this.links.set(
      taskId,
      (this.links.get(taskId) ?? []).map((l) => (l.id === linkId ? { ...l, sharedAssetId: "asset1" } : l)),
    );
    return Promise.resolve({ assetId: "asset1", url: found.url });
  }
}

class RecordingNotifier implements StaffTaskNotifier {
  calls: string[] = [];
  taskAssigned(e: { assigneeId: string }) {
    this.calls.push(`assigned:${e.assigneeId}`);
    return Promise.resolve();
  }
  statusChanged(e: { action: TaskChangeAction; stageName: string | null; reason: string | null; actorId: string }) {
    this.calls.push(`${e.action}:${e.stageName ?? "-"}${e.reason ? `:${e.reason}` : ""} by ${e.actorId}`);
    return Promise.resolve();
  }
  commentAdded(e: { actorId: string }) {
    this.calls.push(`comment by ${e.actorId}`);
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

const query = (q: Partial<StaffTaskQueryDto> = {}): StaffTaskQueryDto => ({
  status: undefined,
  open: false,
  relation: undefined,
  priority: undefined,
  assigneeId: undefined,
  role: undefined,
  clientId: undefined,
  overdue: false,
  dueFrom: undefined,
  dueTo: undefined,
  search: undefined,
  limit: 20,
  offset: 0,
  ...q,
});

let repo: FakeRepo;
let audits: AuditEvent[];
let notifier: RecordingNotifier;
let previews: [string, string][];
let service: StaffTasksService;
/** Parents whose stage the service asked the work-tree notifier to re-check. */
let cleared: { parent: ParentRef; actorId: string | null }[];
const NOW = new Date("2026-10-14T12:00:00Z");

beforeEach(() => {
  repo = new FakeRepo();
  audits = [];
  previews = [];
  cleared = [];
  notifier = new RecordingNotifier();
  const workTree: WorkTreeNotifier = {
    stageMayBeClear: (parent, actorId) => (cleared.push({ parent, actorId }), Promise.resolve()),
    childChanged: () => Promise.resolve(),
  };
  service = new StaffTasksService(
    repo,
    { record: (e) => (audits.push(e), Promise.resolve()) },
    notifier,
    () => NOW,
    { refresh: (id, url) => void previews.push([id, url]) },
    workTree,
  );
});

describe("list (row scope)", () => {
  it("a task-only person's list is scoped to them (assignee or creator, no team); filters are theirs to use, ANDed with the scope", async () => {
    await service.list(MEERA, query({ assigneeId: "arjun", role: "developer", clientId: "c1", status: "todo" }));
    expect(repo.lastFilters).toMatchObject({
      scope: { kind: "own", userId: "meera", viaTeam: false },
      callerId: "meera",
      assigneeId: "arjun",
      role: "developer",
      clientId: "c1",
      status: "todo",
      now: NOW.toISOString(),
    });
  });

  it("a client manager's scope includes their teams", async () => {
    await service.list(ROHAN, query({ relation: "team" }));
    expect(repo.lastFilters).toMatchObject({ scope: { kind: "own", userId: "rohan", viaTeam: true }, relation: "team" });
  });

  it("the Admin's scope is everything, and the filters are free", async () => {
    await service.list(ADMIN, query({ assigneeId: "arjun", role: "developer", overdue: true, relation: "created" }));
    expect(repo.lastFilters).toMatchObject({ scope: { kind: "all" }, assigneeId: "arjun", role: "developer", overdue: true, relation: "created" });
  });

  it("the team filter is for client managers: a task-only role gets a 400", async () => {
    expect(await codeOf(service.list(MEERA, query({ relation: "team" })))).toBe("VALIDATION_ERROR");
    expect(await codeOf(service.list(MEERA, query({ relation: "assigned" })))).toBeNull();
  });
});

describe("get (visibility)", () => {
  it("the assignee and the Admin see a task; anyone else gets 404", async () => {
    expect((await service.get(MEERA, "t1")).id).toBe("t1");
    expect((await service.get(ADMIN, "t1")).id).toBe("t1");
    expect(await codeOf(service.get(ARJUN, "t1"))).toBe("STAFF_TASK_NOT_FOUND");
    expect(await codeOf(service.get(ROHAN, "t1"))).toBe("STAFF_TASK_NOT_FOUND");
  });

  it("the creator sees what they created; a client manager sees their clients' tasks, another team's are 404", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer" }));
    repo.tasks.set("t4", task({ id: "t4", assignedBy: "admin", assigneeId: "arjun", assigneeRole: "developer", clientId: "c1", teamIds: ["rohan"] }));
    expect((await service.get(ROHAN, "t3")).id).toBe("t3");
    expect((await service.get(ROHAN, "t4")).id).toBe("t4");
    expect(await codeOf(service.get(PIA, "t3"))).toBe("STAFF_TASK_NOT_FOUND");
    expect(await codeOf(service.get(PIA, "t4"))).toBe("STAFF_TASK_NOT_FOUND");
  });

  it("a person moved to a task-only role keeps no team visibility", async () => {
    repo.tasks.set("t4", task({ id: "t4", assigneeId: "arjun", assigneeRole: "developer", clientId: "c1", teamIds: ["rohan"] }));
    expect(await codeOf(service.get({ userId: "rohan", role: "editor" }, "t4"))).toBe("STAFF_TASK_NOT_FOUND");
  });

  it("canManage: the Admin and the creator", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer" }));
    expect((await service.get(ADMIN, "t3")).canManage).toBe(true);
    expect((await service.get(ROHAN, "t3")).canManage).toBe(true);
    expect((await service.get(ARJUN, "t3")).canManage).toBe(false);
    expect((await service.get(MEERA, "t1")).canManage).toBe(false);
  });

  it("canShare: the task has an event and the viewer is the Admin or a manager on the client's team", async () => {
    repo.tasks.set("t5", task({ id: "t5", assignedBy: "rohan", clientId: "c1", eventId: "e1", teamIds: ["rohan"] }));
    expect((await service.get(ROHAN, "t5")).canShare).toBe(true);
    expect((await service.get(ADMIN, "t5")).canShare).toBe(true);
    expect((await service.get(MEERA, "t5")).canShare).toBe(false);
    expect((await service.get(ADMIN, "t1")).canShare).toBe(false);
  });
});

describe("create (Admin and client managers)", () => {
  const base = { title: "Cut the reel", assigneeId: "meera", templateId: "tpl-reel" };

  it("snapshots the template's stages and name, takes the brief and brief links, audits it, and fires the 'assigned' hook", async () => {
    await service.create(ADMIN, { ...base, brief: "Open on the product.", links: [{ url: DRIVE, label: "Raw files" }, { url: "https://youtu.be/x", label: null }] });
    expect(repo.created[0]).toMatchObject({
      assigneeId: "meera",
      assignedBy: "admin",
      brief: "Open on the product.",
      priority: "medium",
      templateId: "tpl-reel",
      templateName: "Reel edit",
      stageNames: ["Brief", "Cut", "Review"],
      links: [{ url: DRIVE, label: "Raw files" }, { url: "https://youtu.be/x", label: null }],
    });
    expect(audits.map((a) => a.action)).toEqual(["staff_task.created"]);
    expect(notifier.calls).toEqual(["assigned:meera"]);
  });

  it("round 3: copies each template stage's approvers onto the task (a snapshot, in the same order)", async () => {
    repo.templates.set("tpl-reel", { id: "tpl-reel", name: "Reel edit", active: true, kind: "task", roles: ["editor"], stageNames: ["Brief", "Cut", "Review"], stageApprovers: [[], [], ["social_media_manager", "admin"]] });
    await service.create(ADMIN, base);
    expect(repo.created[0]).toMatchObject({ stageNames: ["Brief", "Cut", "Review"], stageApprovers: [[], [], ["social_media_manager", "admin"]] });
  });

  it("the template must be an active task template offered for the assignee's role (400 STAFF_TASK_TEMPLATE_INVALID)", async () => {
    expect(await codeOf(service.create(ADMIN, { ...base, templateId: "tpl-event" }))).toBe("STAFF_TASK_TEMPLATE_INVALID");
    expect(await codeOf(service.create(ADMIN, { ...base, templateId: "tpl-old" }))).toBe("STAFF_TASK_TEMPLATE_INVALID");
    expect(await codeOf(service.create(ADMIN, { ...base, templateId: "nope" }))).toBe("STAFF_TASK_TEMPLATE_INVALID");
    // Reel edit is for editors only.
    expect(await codeOf(service.create(ADMIN, { ...base, assigneeId: "arjun" }))).toBe("STAFF_TASK_TEMPLATE_INVALID");
    // A template with no roles suits anyone.
    expect(await codeOf(service.create(ADMIN, { ...base, assigneeId: "arjun", templateId: "tpl-any" }))).toBeNull();
    expect(repo.created).toHaveLength(1);
  });

  it("refuses an inactive or unknown assignee and bad links", async () => {
    expect(await codeOf(service.create(ADMIN, { ...base, assigneeId: "gone" }))).toBe("STAFF_TASK_ASSIGNEE_INVALID");
    expect(await codeOf(service.create(ADMIN, { ...base, assigneeId: "nobody" }))).toBe("STAFF_TASK_ASSIGNEE_INVALID");
    expect(await codeOf(service.create(ADMIN, { ...base, clientId: "c9" }))).toBe("STAFF_TASK_CLIENT_INVALID");
    expect(await codeOf(service.create(ADMIN, { ...base, clientId: "c2", eventId: "e1" }))).toBe("STAFF_TASK_EVENT_INVALID");
  });

  it("an event alone links its client", async () => {
    await service.create(ADMIN, { ...base, eventId: "e1" });
    expect(repo.created[0]).toMatchObject({ clientId: "c1", eventId: "e1" });
  });

  it("task-only roles may not create, edit, reassign, reopen or delete (403 FORBIDDEN)", async () => {
    for (const caller of [MEERA, ARJUN]) {
      expect(await codeOf(service.create(caller, base))).toBe("FORBIDDEN");
      expect(await codeOf(service.update(caller, "t1", { title: "x", version: 1 }))).toBe("FORBIDDEN");
      expect(await codeOf(service.reopen(caller, "t1", { version: 1 }))).toBe("FORBIDDEN");
      expect(await codeOf(service.delete(caller, "t1"))).toBe("FORBIDDEN");
    }
  });

  it("the ladder: Admin -> a manager; a manager -> another manager or themselves (2026-11-20); Admin -> Admin and manager -> Admin are 400", async () => {
    await service.create(ADMIN, { ...base, assigneeId: "rohan", templateId: "tpl-any" });
    expect(repo.created[0]).toMatchObject({ assigneeId: "rohan" });
    await service.create(ROHAN, { ...base, assigneeId: "pia", templateId: "tpl-any" }); // SMM -> MM, sideways
    expect(repo.created[1]).toMatchObject({ assigneeId: "pia", assignedBy: "rohan" });
    await service.create(ROHAN, { ...base, assigneeId: "rohan", templateId: "tpl-any" }); // to themselves
    expect(repo.created[2]).toMatchObject({ assigneeId: "rohan", assignedBy: "rohan" });
    expect(await codeOf(service.create(ADMIN, { ...base, assigneeId: "admin", templateId: "tpl-any" }))).toBe("STAFF_TASK_ASSIGNEE_NOT_ALLOWED");
    expect(await codeOf(service.create(ROHAN, { ...base, assigneeId: "admin", templateId: "tpl-any" }))).toBe("STAFF_TASK_ASSIGNEE_NOT_ALLOWED");
  });

  it("a manager creates a task for a task-only person; they are the creator", async () => {
    await service.create(ROHAN, base);
    expect(repo.created[0]).toMatchObject({ assigneeId: "meera", assignedBy: "rohan" });
    expect(notifier.calls).toEqual(["assigned:meera"]);
  });

  it("a manager may link only their own clients and those clients' events; anything else is 400 STAFF_TASK_CLIENT_INVALID", async () => {
    const dev = { ...base, assigneeId: "arjun", templateId: "tpl-any" };
    await service.create(ROHAN, { ...dev, clientId: "c1", eventId: "e1" });
    expect(repo.created[0]).toMatchObject({ clientId: "c1", eventId: "e1" });
    expect(await codeOf(service.create(ROHAN, { ...dev, clientId: "c2" }))).toBe("STAFF_TASK_CLIENT_INVALID");
    expect(await codeOf(service.create(PIA, { ...dev, eventId: "e1" }))).toBe("STAFF_TASK_CLIENT_INVALID");
    expect(await codeOf(service.create(ROHAN, { ...dev, clientId: "c9" }))).toBe("STAFF_TASK_CLIENT_INVALID");
    // The Admin links any client.
    await service.create(ADMIN, { ...dev, clientId: "c2" });
    expect(repo.created.at(-1)).toMatchObject({ clientId: "c2" });
  });
});

describe("update / reassign (Admin or the creator)", () => {
  it("needs at least one field, and the current version; the brief is editable", async () => {
    expect(await codeOf(service.update(ADMIN, "t1", { version: 1 }))).toBe("VALIDATION_NO_FIELDS");
    expect(await codeOf(service.update(ADMIN, "t1", { title: "y", version: 9 }))).toBe("STAFF_TASK_MODIFIED");
    await service.update(ADMIN, "t1", { title: "New title", priority: "high", brief: "New script", version: 1 });
    expect(repo.tasks.get("t1")).toMatchObject({ title: "New title", priority: "high", brief: "New script", version: 2 });
    expect(audits[0]).toMatchObject({ action: "staff_task.updated", metadata: { fields: ["title", "brief", "priority"] } });
  });

  it("reassigning logs a timeline entry and fires 'assigned'; the task keeps its stages even if the new assignee's role wasn't in the template", async () => {
    await service.update(ADMIN, "t1", { assigneeId: "arjun", version: 1 });
    expect(repo.tasks.get("t1")).toMatchObject({ assigneeId: "arjun", templateName: "Reel edit", stageCount: 3 });
    expect(repo.entries).toEqual([expect.objectContaining({ kind: "reassigned", authorId: "admin" })]);
    expect(audits.map((a) => a.action)).toEqual(["staff_task.reassigned"]);
    expect(notifier.calls).toEqual(["assigned:arjun"]);
  });

  it("the ladder judges a reassignment against the caller: a manager can pick another manager but never the Admin", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "meera", assigneeRole: "editor" }));
    expect(await codeOf(service.update(ROHAN, "t3", { assigneeId: "admin", version: 1 }))).toBe("STAFF_TASK_ASSIGNEE_NOT_ALLOWED");
    await service.update(ROHAN, "t3", { assigneeId: "arjun", version: 1 });
    expect(repo.tasks.get("t3")).toMatchObject({ assigneeId: "arjun" });
    await service.update(ADMIN, "t3", { assigneeId: "pia", version: 2 });
    expect(repo.tasks.get("t3")).toMatchObject({ assigneeId: "pia" });
  });

  it("keeping the same (higher-level) assignee while editing other fields is not blocked by the ladder", async () => {
    repo.tasks.set("t5", task({ id: "t5", assignedBy: "admin", assigneeId: "pia", assigneeRole: "marketing_manager" }));
    await service.update(ADMIN, "t5", { assigneeId: "pia", title: "Renamed", version: 1 });
    expect(repo.tasks.get("t5")).toMatchObject({ title: "Renamed" });
  });

  it("the creator manages their own task; a team manager who only sees it gets 403; an outsider 404; task-only staff 403 on the capability", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer", clientId: "c1", teamIds: ["rohan", "pia"] }));
    await service.update(ROHAN, "t3", { title: "Mine", version: 1 });
    expect(repo.tasks.get("t3")).toMatchObject({ title: "Mine" });
    expect(await codeOf(service.update(PIA, "t3", { title: "Hers", version: 2 }))).toBe("STAFF_TASK_FORBIDDEN");
    expect(await codeOf(service.reopen(PIA, "t3", { version: 2 }))).toBe("STAFF_TASK_FORBIDDEN");
    expect(await codeOf(service.delete(PIA, "t3"))).toBe("STAFF_TASK_FORBIDDEN");
    repo.tasks.set("t6", task({ id: "t6", assignedBy: "admin", assigneeId: "arjun", assigneeRole: "developer" }));
    expect(await codeOf(service.update(ROHAN, "t6", { title: "x", version: 1 }))).toBe("STAFF_TASK_NOT_FOUND");
    expect(await codeOf(service.delete(ROHAN, "t6"))).toBe("STAFF_TASK_NOT_FOUND");
    expect(await codeOf(service.update(ARJUN, "t3", { title: "x", version: 1 }))).toBe("FORBIDDEN");
  });

  it("a manager editing a task keeps to their own clients: relinking to another team's client is 400", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer" }));
    expect(await codeOf(service.update(ROHAN, "t3", { clientId: "c2", version: 1 }))).toBe("STAFF_TASK_CLIENT_INVALID");
    await service.update(ROHAN, "t3", { clientId: "c1", version: 1 });
    expect(repo.tasks.get("t3")).toMatchObject({ clientId: "c1" });
  });

  it("reassigning to the current assignee writes no timeline entry", async () => {
    await service.update(ADMIN, "t1", { assigneeId: "meera", version: 1 });
    expect(repo.entries).toEqual([]);
    expect(notifier.calls).toEqual([]);
  });

  it("changing the client unlinks an event of the old client", async () => {
    repo.tasks.set("t2", { ...repo.tasks.get("t2")!, clientId: "c1", eventId: "e1" });
    await service.update(ADMIN, "t2", { clientId: "c2", version: 1 });
    expect(repo.tasks.get("t2")).toMatchObject({ clientId: "c2", eventId: null });
  });
});

describe("moving through the stages (assignee, creator, Admin)", () => {
  it("the status follows the stage: stage 1 todo, 2..N in progress; any stage, forward or back", async () => {
    await service.moveStage(MEERA, "t1", { stageId: "s2", comment: "Starting", version: 1 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "in_progress", currentStage: { id: "s2" }, blockedReason: null });
    await service.moveStage(MEERA, "t1", { stageId: "s3", version: 2 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "in_progress", currentStage: { id: "s3" } });
    await service.moveStage(MEERA, "t1", { stageId: "s1", version: 3 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "todo", currentStage: { id: "s1" } });
    expect(repo.entries.map((e) => [e.kind, e.toStageId, e.comment])).toEqual([
      ["stage", "s2", "Starting"],
      ["stage", "s3", null],
      ["stage", "s1", null],
    ]);
    expect(notifier.calls).toEqual(["stage:Cut by meera", "stage:Review by meera", "stage:Brief by meera"]);
  });

  it("refuses the current stage (409) and a stage of another task (400)", async () => {
    expect(await codeOf(service.moveStage(MEERA, "t1", { stageId: "s1", version: 1 }))).toBe("STAFF_TASK_STAGE_UNCHANGED");
    expect(await codeOf(service.moveStage(MEERA, "t1", { stageId: "elsewhere", version: 1 }))).toBe("STAFF_TASK_STAGE_INVALID");
  });

  it("completing only from the last stage; it sets done and completed_at, and a done task is closed", async () => {
    expect(await codeOf(service.moveStage(MEERA, "t1", { complete: true, version: 1 }))).toBe("STAFF_TASK_NOT_AT_LAST_STAGE");
    await service.moveStage(MEERA, "t1", { stageId: "s3", version: 1 });
    await service.moveStage(MEERA, "t1", { complete: true, comment: "Shipped", version: 2 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "done", completedAt: "now", currentStage: { id: "s3" } });
    expect(repo.entries.at(-1)).toMatchObject({ kind: "completed", comment: "Shipped" });
    expect(notifier.calls.at(-1)).toBe("completed:Review by meera");
    expect(await codeOf(service.moveStage(MEERA, "t1", { stageId: "s1", version: 3 }))).toBe("STAFF_TASK_DONE");
    expect(await codeOf(service.moveStage(ADMIN, "t1", { complete: true, version: 3 }))).toBe("STAFF_TASK_DONE");
  });

  it("the creator and the Admin may move it; a team manager who only sees it gets 403; a stranger 404; a stale version 409", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer", clientId: "c1", teamIds: ["rohan", "pia"] }));
    await service.moveStage(ROHAN, "t3", { stageId: "s2", version: 1 });
    await service.moveStage(ADMIN, "t3", { stageId: "s3", version: 2 });
    expect(await codeOf(service.moveStage(PIA, "t3", { stageId: "s1", version: 3 }))).toBe("STAFF_TASK_FORBIDDEN");
    expect(await codeOf(service.moveStage(ARJUN, "t3", { stageId: "s1", version: 99 }))).toBe("STAFF_TASK_MODIFIED");
    expect(await codeOf(service.moveStage(ARJUN, "t1", { stageId: "s2", version: 99 }))).toBe("STAFF_TASK_NOT_FOUND");
    expect(await codeOf(service.moveStage({ userId: "x", role: "social_media_manager" }, "t3", { stageId: "s1", version: 3 }))).toBe("STAFF_TASK_NOT_FOUND");
  });

  it("moving a blocked task clears the block", async () => {
    await service.block(MEERA, "t1", { reason: "No footage", version: 1 });
    await service.moveStage(MEERA, "t1", { stageId: "s2", version: 2 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "in_progress", blockedReason: null });
  });
});

describe("stage approvals (round 3)", () => {
  beforeEach(() => {
    repo.stages = GATED_STAGES;
  });

  it("enters an approval stage but can't pass it, forward or by jumping, until it is approved", async () => {
    expect(await codeOf(service.moveStage(MEERA, "t1", { stageId: "s3", version: 1 }))).toBe("STAGE_APPROVAL_REQUIRED");
    await service.moveStage(MEERA, "t1", { stageId: "s2", version: 1 });
    expect(await codeOf(service.moveStage(MEERA, "t1", { stageId: "s3", version: 2 }))).toBe("STAGE_APPROVAL_REQUIRED");
    repo.approved.add("s2");
    await service.moveStage(MEERA, "t1", { stageId: "s3", version: 2 });
    expect(repo.tasks.get("t1")).toMatchObject({ currentStage: { id: "s3" } });
  });

  it("completing is stopped at an unapproved last stage, and allowed once it is approved", async () => {
    repo.approved.add("s2");
    await service.moveStage(MEERA, "t1", { stageId: "s3", version: 1 });
    expect(await codeOf(service.moveStage(MEERA, "t1", { complete: true, version: 2 }))).toBe("STAGE_APPROVAL_REQUIRED");
    repo.approved.add("s3");
    await service.moveStage(MEERA, "t1", { complete: true, version: 2 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "done" });
  });

  it("a back move is always allowed; it drops the approvals from that stage on and audits the count once", async () => {
    repo.approved = new Set(["s2", "s3"]);
    repo.tasks.set("t1", task({ currentStage: GATED_STAGES[2]!, status: "in_progress" }));
    await service.moveStage(MEERA, "t1", { stageId: "s2", version: 1 });
    expect([...repo.approved]).toEqual([]);
    expect(audits.filter((a) => a.action === "approval.superseded").map((a) => a.metadata)).toEqual([{ superseded: 2, cancelled: 0 }]);
    // Moving back where nothing is approved writes no entry.
    await service.moveStage(MEERA, "t1", { stageId: "s1", version: 2 });
    expect(audits.filter((a) => a.action === "approval.superseded")).toHaveLength(1);
  });

  it("a reopen counts as a back move", async () => {
    repo.approved = new Set(["s2", "s3"]);
    repo.tasks.set("t1", task({ status: "done", completedAt: "x", currentStage: GATED_STAGES[2]! }));
    await service.reopen(ADMIN, "t1", { version: 1 });
    expect([...repo.approved]).toEqual(["s2"]);
    expect(audits.filter((a) => a.action === "approval.superseded").map((a) => a.metadata)).toEqual([{ superseded: 1, cancelled: 0 }]);
  });

  it("the detail carries the stages' approvers, each round with the caller's flags, and the stage that blocks", async () => {
    repo.rounds = [round()];
    const asAdmin = await service.get(ADMIN, "t1");
    expect(asAdmin.stages.map((s) => s.approvers)).toEqual([[], ["social_media_manager", "admin"], ["admin"]]);
    expect(asAdmin.nextBlockedBy).toEqual({ stageId: "s2", stageName: "Cut", reason: "approval", openChildren: 0 });
    expect(asAdmin.approvals[0]).toMatchObject({ canDecide: true, canCancel: true });
    // Meera asked for it herself: she can cancel, not decide.
    const asRequester = await service.get(MEERA, "t1");
    expect(asRequester.approvals[0]).toMatchObject({ canDecide: false, canCancel: true });
  });

  it("an approved stage stops blocking; the next unapproved approval stage does", async () => {
    repo.rounds = [round({ status: "approved" })];
    expect((await service.get(ADMIN, "t1")).nextBlockedBy).toEqual({ stageId: "s3", stageName: "Review", reason: "approval", openChildren: 0 });
    repo.rounds = [round({ status: "approved" }), round({ id: "a2", stageId: "s3", stageName: "Review", stagePosition: 3, approvers: ["admin"], status: "approved" })];
    expect((await service.get(ADMIN, "t1")).nextBlockedBy).toBeNull();
  });
});

describe("blocking", () => {
  it("the assignee or the Admin blocks with a reason; the stage stays; unblocking brings the status back from the stage", async () => {
    await service.moveStage(MEERA, "t1", { stageId: "s2", version: 1 });
    await service.block(MEERA, "t1", { reason: "Waiting for music", version: 2 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "blocked", blockedReason: "Waiting for music", currentStage: { id: "s2" } });
    expect(await codeOf(service.block(ADMIN, "t1", { reason: "again", version: 3 }))).toBe("STAFF_TASK_ALREADY_BLOCKED");
    await service.unblock(MEERA, "t1", { comment: "Music arrived", version: 3 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "in_progress", blockedReason: null, currentStage: { id: "s2" } });
    expect(repo.entries.slice(1).map((e) => [e.kind, e.comment])).toEqual([
      ["blocked", "Waiting for music"],
      ["unblocked", "Music arrived"],
    ]);
    expect(notifier.calls.slice(1)).toEqual(["blocked:Cut:Waiting for music by meera", "unblocked:Cut by meera"]);
  });

  it("at stage 1 the status after unblocking is todo; unblocking an unblocked task is 409", async () => {
    await service.block(MEERA, "t1", { reason: "x", version: 1 });
    await service.unblock(ADMIN, "t1", { version: 2 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "todo" });
    expect(await codeOf(service.unblock(MEERA, "t1", { version: 3 }))).toBe("STAFF_TASK_NOT_BLOCKED");
  });

  it("the creator may unblock but not block; a done task can't be blocked", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer" }));
    expect(await codeOf(service.block(ROHAN, "t3", { reason: "x", version: 1 }))).toBe("STAFF_TASK_FORBIDDEN");
    await service.block(ARJUN, "t3", { reason: "x", version: 1 });
    await service.unblock(ROHAN, "t3", { version: 2 });
    repo.tasks.set("t3", { ...repo.tasks.get("t3")!, status: "done" });
    expect(await codeOf(service.block(ARJUN, "t3", { reason: "y", version: 3 }))).toBe("STAFF_TASK_DONE");
  });
});

describe("reopen (Admin or the creator, done tasks only)", () => {
  const done = () => repo.tasks.set("t1", task({ status: "done", completedAt: "x", currentStage: STAGES[2]! }));

  it("goes to the named stage, status from it, completion cleared", async () => {
    done();
    await service.reopen(ADMIN, "t1", { stageId: "s2", comment: "One more cut", version: 1 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "in_progress", completedAt: null, currentStage: { id: "s2" } });
    expect(repo.entries.at(-1)).toMatchObject({ kind: "reopened", comment: "One more cut", toStageId: "s2" });
    expect(notifier.calls).toEqual(["reopened:Cut by admin"]);
  });

  it("defaults to the last stage; back to stage 1 is todo; a stage of another task is 400; an open task is 409", async () => {
    done();
    await service.reopen(ADMIN, "t1", { version: 1 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "in_progress", currentStage: { id: "s3" } });
    expect(await codeOf(service.reopen(ADMIN, "t1", { version: 2 }))).toBe("STAFF_TASK_NOT_DONE");
    done();
    expect(await codeOf(service.reopen(ADMIN, "t1", { stageId: "nope", version: 1 }))).toBe("STAFF_TASK_STAGE_INVALID");
    await service.reopen(ADMIN, "t1", { stageId: "s1", version: 1 });
    expect(repo.tasks.get("t1")).toMatchObject({ status: "todo" });
  });
});

describe("comments", () => {
  it("the creator comments; a team manager who only sees the task gets 403", async () => {
    repo.tasks.set("t3", task({ id: "t3", assignedBy: "rohan", assigneeId: "arjun", assigneeRole: "developer", clientId: "c1", teamIds: ["rohan", "pia"] }));
    await service.comment(ROHAN, "t3", { body: "Please prioritise" });
    expect(repo.comments.map((c) => c.authorId)).toEqual(["rohan"]);
    expect(await codeOf(service.comment(PIA, "t3", { body: "hi" }))).toBe("STAFF_TASK_FORBIDDEN");
    expect(await codeOf(service.comment({ userId: "x", role: "social_media_manager" }, "t3", { body: "hi" }))).toBe("STAFF_TASK_NOT_FOUND");
  });

  it("the assignee and the Admin comment; anyone else gets 404", async () => {
    await service.comment(MEERA, "t1", { body: "First cut uploaded" });
    await service.comment(ADMIN, "t1", { body: "Looks good" });
    expect(repo.comments.map((c) => c.authorId)).toEqual(["meera", "admin"]);
    expect(await codeOf(service.comment(ARJUN, "t1", { body: "hi" }))).toBe("STAFF_TASK_NOT_FOUND");
    expect(notifier.calls).toEqual(["comment by meera", "comment by admin"]);
  });
});

describe("delete (Admin or the creator)", () => {
  it("removes the task and audits it", async () => {
    await service.delete(ADMIN, "t2");
    expect(repo.tasks.has("t2")).toBe(false);
    expect(audits[0]).toMatchObject({ action: "staff_task.deleted", entityId: "t2", metadata: { assigneeId: "arjun", status: "todo" } });
  });
});

describe("links", () => {
  beforeEach(() => {
    repo.tasks.set("t1", task({ assignedBy: "rohan", clientId: "c1", eventId: "e1", teamIds: ["rohan"] }));
  });

  it("brief links: the creator or the Admin (assignee 403); delivered: the assignee or the Admin (creator 403)", async () => {
    await service.addLink(ROHAN, "t1", { kind: "brief", url: DRIVE, label: "Raw files" });
    await service.addLink(ADMIN, "t1", { kind: "brief", url: DRIVE, label: null });
    expect(await codeOf(service.addLink(MEERA, "t1", { kind: "brief", url: DRIVE, label: null }))).toBe("STAFF_TASK_FORBIDDEN");
    await service.addLink(MEERA, "t1", { kind: "delivered", url: DRIVE, label: "Cut 1", stageId: "s2" });
    expect(await codeOf(service.addLink(ROHAN, "t1", { kind: "delivered", url: DRIVE, label: null }))).toBe("STAFF_TASK_FORBIDDEN");
    expect(repo.links.get("t1")!.map((l) => [l.kind, l.addedById, l.stageId])).toEqual([
      ["brief", "rohan", null],
      ["brief", "admin", null],
      ["delivered", "meera", "s2"],
    ]);
    expect(audits.map((a) => a.action)).toEqual(["staff_task.link_added", "staff_task.link_added", "staff_task.link_added"]);
    expect(JSON.stringify(audits)).not.toContain("drive.google");
  });

  it("a stranger gets 404 before any role rule; the stage must be one of the task's (400); at most 50 links (409)", async () => {
    expect(await codeOf(service.addLink(ARJUN, "t1", { kind: "delivered", url: DRIVE, label: null }))).toBe("STAFF_TASK_NOT_FOUND");
    expect(await codeOf(service.addLink(MEERA, "t1", { kind: "delivered", url: DRIVE, label: null, stageId: "nope" }))).toBe("STAFF_TASK_STAGE_INVALID");
    repo.links.set("t1", Array.from({ length: 50 }, (_, i) => link({ id: `x${i}` })));
    expect(await codeOf(service.addLink(MEERA, "t1", { kind: "delivered", url: DRIVE, label: null }))).toBe("STAFF_TASK_LINKS_LIMIT");
  });

  it("remove: whoever added it or whoever manages the task; a stranger gets the task's 404, not the link's", async () => {
    repo.links.set("t1", [link({ id: "l1", kind: "brief", addedById: "rohan" }), link({ id: "l2", addedById: "meera" })]);
    expect(await codeOf(service.removeLink(MEERA, "t1", "l1"))).toBe("STAFF_TASK_FORBIDDEN");
    await service.removeLink(ROHAN, "t1", "l1");
    await service.removeLink(MEERA, "t1", "l2");
    expect(repo.links.get("t1")).toEqual([]);
    expect(await codeOf(service.removeLink(ROHAN, "t1", "l1"))).toBe("STAFF_TASK_LINK_NOT_FOUND");
    expect(await codeOf(service.removeLink(ARJUN, "t1", "missing"))).toBe("STAFF_TASK_NOT_FOUND");
    expect(audits.map((a) => a.action)).toEqual(["staff_task.link_removed", "staff_task.link_removed"]);
  });

  describe("share with the client", () => {
    beforeEach(() => {
      repo.links.set("t1", [link({ id: "d1" }), link({ id: "b1", kind: "brief", addedById: "rohan" })]);
    });

    it("a manager on the client's team shares a delivered link: one asset, the link marked, both audited, preview queued", async () => {
      const res = await service.shareLink(ROHAN, "t1", "d1", { title: "Final reel", stageId: "es2" });
      expect(res.assetId).toBe("asset1");
      expect(res.task.links.find((l) => l.id === "d1")?.sharedAssetId).toBe("asset1");
      expect(repo.shared[0]).toMatchObject({ linkId: "d1", input: { title: "Final reel", stageId: "es2", createdBy: "rohan" } });
      expect(audits.map((a) => a.action)).toEqual(["asset.created", "staff_task.link_shared"]);
      expect(previews).toEqual([["asset1", DRIVE]]);
    });

    it("the Admin may too; an assignee (editor) cannot (403); a team manager of another client or a stranger can't (403 / 404)", async () => {
      await service.shareLink(ADMIN, "t1", "d1", { title: null });
      expect(await codeOf(service.shareLink(MEERA, "t1", "d1", { title: null }))).toBe("STAFF_TASK_FORBIDDEN");
      expect(await codeOf(service.shareLink(ARJUN, "t1", "d1", { title: null }))).toBe("STAFF_TASK_NOT_FOUND");
    });

    it("refuses a second share (409), a brief link (404), a missing link (404), a task without an event (409) and a stage of another event (400)", async () => {
      await service.shareLink(ROHAN, "t1", "d1", { title: null });
      expect(await codeOf(service.shareLink(ROHAN, "t1", "d1", { title: null }))).toBe("STAFF_TASK_LINK_ALREADY_SHARED");
      expect(await codeOf(service.shareLink(ROHAN, "t1", "b1", { title: null }))).toBe("STAFF_TASK_LINK_NOT_FOUND");
      expect(await codeOf(service.shareLink(ROHAN, "t1", "zzz", { title: null }))).toBe("STAFF_TASK_LINK_NOT_FOUND");
      repo.links.set("t1", [link({ id: "d2" })]);
      expect(await codeOf(service.shareLink(ROHAN, "t1", "d2", { title: null, stageId: "other-event-stage" }))).toBe("ASSET_STAGE_INVALID");
      repo.tasks.set("t1", { ...repo.tasks.get("t1")!, eventId: null });
      expect(await codeOf(service.shareLink(ROHAN, "t1", "d2", { title: null }))).toBe("STAFF_TASK_NO_EVENT");
      expect(repo.shared).toHaveLength(1);
    });
  });
});

// -- round 4: parent and child work -----------------------------------------------------------

describe("the move gate with parts (round 4)", () => {
  it("can enter a stage with unfinished parts, not pass it or jump over it", async () => {
    repo.open.set("s2", 2);
    await service.moveStage(MEERA, "t1", { stageId: "s2", version: 1 });
    expect(await codeOf(service.moveStage(MEERA, "t1", { stageId: "s3", version: 2 }))).toBe("STAGE_CHILDREN_OPEN");
    repo.tasks.set("t1", task({ version: 3 }));
    expect(await codeOf(service.moveStage(MEERA, "t1", { stageId: "s3", version: 3 }))).toBe("STAGE_CHILDREN_OPEN"); // a jump from stage 1
    expect(repo.tasks.get("t1")?.currentStage.id).toBe("s1");
  });

  it("moves on once the last part is finished; a back move is never blocked", async () => {
    repo.open.set("s2", 1);
    await service.moveStage(MEERA, "t1", { stageId: "s2", version: 1 });
    repo.open.clear();
    await service.moveStage(MEERA, "t1", { stageId: "s3", version: 2 });
    repo.open.set("s3", 5);
    expect(await codeOf(service.moveStage(MEERA, "t1", { stageId: "s1", version: 3 }))).toBeNull();
  });

  it("completing is stopped by unfinished parts on the last stage, for the Admin too", async () => {
    repo.tasks.set("t1", task({ currentStage: STAGES[2]!, status: "in_progress" }));
    repo.open.set("s3", 3);
    expect(await codeOf(service.moveStage(MEERA, "t1", { complete: true, version: 1 }))).toBe("STAGE_CHILDREN_OPEN");
    expect(await codeOf(service.moveStage(ADMIN, "t1", { complete: true, version: 1 }))).toBe("STAGE_CHILDREN_OPEN");
    repo.open.clear();
    await service.moveStage(MEERA, "t1", { complete: true, version: 1 });
    expect(repo.tasks.get("t1")?.status).toBe("done");
  });

  it("with an unapproved approval AND open parts on one stage the approval error comes first", async () => {
    repo.stages = GATED_STAGES;
    repo.open.set("s2", 2);
    await service.moveStage(MEERA, "t1", { stageId: "s2", version: 1 });
    expect(await codeOf(service.moveStage(MEERA, "t1", { stageId: "s3", version: 2 }))).toBe("STAGE_APPROVAL_REQUIRED");
    repo.approved.add("s2");
    expect(await codeOf(service.moveStage(MEERA, "t1", { stageId: "s3", version: 2 }))).toBe("STAGE_CHILDREN_OPEN");
  });

  it("the detail reports each stage's count and why the next stop blocks", async () => {
    repo.open.set("s2", 4);
    const view = await service.get(MEERA, "t1");
    expect(view.stages.map((s) => s.openChildren)).toEqual([0, 4, 0]);
    expect(view.nextBlockedBy).toEqual({ stageId: "s2", stageName: "Cut", reason: "children", openChildren: 4 });
  });

  it("blocking is not gated by parts", async () => {
    repo.open.set("s1", 2);
    await service.block(MEERA, "t1", { reason: "Waiting for footage", version: 1 });
    expect(repo.tasks.get("t1")?.status).toBe("blocked");
  });
});

describe("creating a part of a task or an event (round 4)", () => {
  const base = { title: "Cut the reel", assigneeId: "meera", templateId: "tpl-reel" };
  const underTask = { kind: "task" as const, id: "t1", stageId: "s2" };
  const underEvent = { kind: "event" as const, id: "e1", stageId: "es1" };

  beforeEach(() => {
    repo.parents.set("task:t1", parentFacts({ assigneeId: "arjun", assignedBy: "rohan" }));
    repo.parents.set(
      "event:e1",
      parentFacts({ kind: "event", id: "e1", title: "Shoot", state: "active", clientId: "c1", clientStatus: "active", teamIds: ["rohan"], assigneeId: null, assignedBy: null, stageIds: ["es1", "es2"] }),
    );
  });

  it("a part of an event links to that event and its client by default, and audits the parent", async () => {
    await service.create(ROHAN, { ...base, parent: underEvent });
    expect(repo.created[0]).toMatchObject({ clientId: "c1", eventId: "e1", parent: underEvent });
    expect(audits[0]).toMatchObject({ action: "staff_task.created", metadata: { parent: underEvent } });
  });

  it("a part of an event keeps a client the body names itself", async () => {
    await service.create(ADMIN, { ...base, clientId: "c2", parent: underEvent });
    expect(repo.created[0]).toMatchObject({ clientId: "c2", eventId: null });
  });

  it("a part of a task: the creator and the Admin may, and the template-role check and the ladder still apply", async () => {
    await service.create(ROHAN, { ...base, parent: underTask });
    await service.create(ADMIN, { ...base, parent: underTask });
    expect(repo.created.map((c) => c.parent)).toEqual([underTask, underTask]);
    expect(await codeOf(service.create(ROHAN, { ...base, assigneeId: "admin", templateId: "tpl-any", parent: underTask }))).toBe("STAFF_TASK_ASSIGNEE_NOT_ALLOWED");
    expect(await codeOf(service.create(ROHAN, { ...base, assigneeId: "arjun", parent: underTask }))).toBe("STAFF_TASK_TEMPLATE_INVALID"); // the editor-only template
  });

  it("a manager who sees the parent task but can't move it gets 403; one who can't see it gets 404", async () => {
    expect(await codeOf(service.create(PIA, { ...base, parent: underTask }))).toBe("STAFF_TASK_NOT_FOUND");
    repo.parents.set("task:t1", parentFacts({ assigneeId: "arjun", assignedBy: "admin", clientId: "c1", teamIds: ["rohan"] }));
    expect(await codeOf(service.create(ROHAN, { ...base, parent: underTask }))).toBe("STAFF_TASK_FORBIDDEN");
    expect(repo.created).toHaveLength(0);
  });

  it("refuses a done task, a cancelled event, a wrong stage, a missing parent and a parent that is already 3 levels deep", async () => {
    repo.parents.set("task:t1", parentFacts({ state: "done", assignedBy: "rohan" }));
    expect(await codeOf(service.create(ROHAN, { ...base, parent: underTask }))).toBe("STAFF_TASK_DONE");
    repo.parents.set("task:t1", parentFacts({ assignedBy: "rohan" }));
    expect(await codeOf(service.create(ROHAN, { ...base, parent: { ...underTask, stageId: "elsewhere" } }))).toBe("WORK_PARENT_STAGE_INVALID");
    repo.parents.set("task:t1", parentFacts({ assignedBy: "rohan", depth: 3 }));
    expect(await codeOf(service.create(ROHAN, { ...base, parent: underTask }))).toBe("WORK_TOO_DEEP");
    repo.parents.set(
      "event:e1",
      parentFacts({ kind: "event", id: "e1", state: "cancelled", clientId: "c1", teamIds: ["rohan"], assigneeId: null, assignedBy: null, stageIds: ["es1"] }),
    );
    expect(await codeOf(service.create(ROHAN, { ...base, parent: underEvent }))).toBe("EVENT_NOT_ACTIVE");
    expect(await codeOf(service.create(ROHAN, { ...base, parent: { kind: "event", id: "gone", stageId: "es1" } }))).toBe("EVENT_NOT_FOUND");
    expect(repo.created).toHaveLength(0);
  });

  it("the parent is checked again on the locked row (it may have been completed meanwhile)", async () => {
    const orig = repo.create.bind(repo);
    repo.create = (record, guardParent) => {
      repo.parents.set("task:t1", parentFacts({ state: "done", assignedBy: "rohan" }));
      return orig(record, guardParent);
    };
    expect(await codeOf(service.create(ROHAN, { ...base, parent: underTask }))).toBe("STAFF_TASK_DONE");
  });
});

describe("telling the parent's people (round 4)", () => {
  const part = { kind: "event" as const, id: "e9", stageId: "es2" };

  it("completing a part asks the work-tree notifier to re-check its parent's stage; a plain stage move does not", async () => {
    repo.tasks.set("t1", task({ parentRef: part }));
    await service.moveStage(MEERA, "t1", { stageId: "s2", version: 1 });
    await service.moveStage(MEERA, "t1", { stageId: "s3", version: 2 });
    expect(cleared).toEqual([]);
    await service.moveStage(MEERA, "t1", { complete: true, version: 3 });
    expect(cleared).toEqual([{ parent: part, actorId: "meera" }]);
  });

  it("deleting a part asks too (an unfinished part that is deleted no longer blocks)", async () => {
    repo.tasks.set("t1", task({ parentRef: part }));
    await service.delete(ADMIN, "t1");
    expect(cleared).toEqual([{ parent: part, actorId: "admin" }]);
  });

  it("a top-level task never asks", async () => {
    await service.moveStage(MEERA, "t1", { stageId: "s3", version: 1 });
    await service.moveStage(MEERA, "t1", { complete: true, version: 2 });
    await service.delete(ADMIN, "t2");
    expect(cleared).toEqual([]);
  });
});

describe("parts in the detail (round 4)", () => {
  const childRow = (o: Partial<WorkChildRow>): WorkChildRow => ({
    kind: "task",
    id: "k-1",
    title: "Cut it",
    stageId: "s2",
    stageName: "Cut",
    stagePosition: 2,
    currentStageName: "Brief",
    currentPosition: 1,
    stageCount: 3,
    status: "todo",
    state: null,
    finished: false,
    assigneeName: "Meera",
    createdAt: "2026-11-05T10:00:00.000Z",
    teamIds: [],
    assigneeId: "meera",
    assignedBy: "admin",
    ...o,
  });

  it("lists the parts the caller sees, counts the others, and leaks no internal field", async () => {
    repo.childRows = [childRow({}), childRow({ id: "k-2", title: "Somebody else's secret", assigneeId: "arjun", assignedBy: "rohan" })];
    repo.childTotal = 2;
    const view = await service.get(MEERA, "t1");
    expect(view.children.map((c) => c.id)).toEqual(["k-1"]);
    expect(view.hiddenChildren).toBe(1);
    expect(JSON.stringify(view)).not.toContain("secret");
    expect(view).not.toHaveProperty("childRows");
    expect(view).not.toHaveProperty("parentRef");
    expect(view).not.toHaveProperty("depth");
    // The Admin sees both.
    expect((await service.get(ADMIN, "t1")).children).toHaveLength(2);
  });

  it("the parent stub is null when the caller can't see the parent", async () => {
    repo.parentRecord = { kind: "event", id: "e1", title: "Shoot", stageId: "es1", stageName: "Planned", teamIds: ["rohan"], assigneeId: null, assignedBy: null };
    expect((await service.get(ADMIN, "t1")).parent).toEqual({ kind: "event", id: "e1", title: "Shoot", stageId: "es1", stageName: "Planned" });
    expect((await service.get(MEERA, "t1")).parent).toBeNull();
  });
});
