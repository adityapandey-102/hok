import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, ilike, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../../common/database/drizzle-client";
import { containsPattern } from "../../../common/database/like-pattern";
import { ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
// Cross-module Infrastructure-only reads (ADR 0003): the assignee's and
// author's names, the linked client's name and the linked event's title, the
// stage templates a task starts from -- and, for "share with client", the one
// cross-module WRITE: inserting the client-visible asset.
import { profiles } from "../../users/infrastructure/profile.schema";
import { clients } from "../../clients/infrastructure/clients.schema";
import { isOnTeam, teamIdsOf } from "../../clients/infrastructure/client-team.sql";
import { eventStages, events } from "../../events/infrastructure/events.schema";
import { stageTemplateStages, stageTemplates } from "../../stage-templates/infrastructure/stage-templates.schema";
import { assets } from "../../assets/infrastructure/assets.schema";
import { staffTaskLinks, staffTaskUpdates, staffTasks, taskStages } from "./staff-tasks.schema";
import type { StaffTaskDetail, StaffTaskEntity, StaffTaskLink, StaffTaskSummaryEntity, StaffTaskUpdate, TaskStage } from "../domain/staff-task.entity";
import type { AssigneeCandidate, TaskClientRef, TaskEventRef, TaskTemplate } from "../domain/staff-task.rules";
import type {
  LinkTargetContext,
  LinkWriteContext,
  NewStaffTaskRecord,
  NewTaskLink,
  ShareEventContext,
  ShareInput,
  StaffTaskChangeDecision,
  StaffTaskListFilters,
  StaffTaskPage,
  StaffTasksRepositoryPort } from "../application/ports/staff-tasks-repository.port";
import { guarded } from "../../../common/database/guarded";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Timeline entries returned with a task, newest first. Older ones stay in the table. */
const UPDATES_LIMIT = 100;

const assignee = alias(profiles, "assignee");
const assigner = alias(profiles, "assigner");
const author = alias(profiles, "author");
const fromAssignee = alias(profiles, "from_assignee");
const toAssignee = alias(profiles, "to_assignee");
const currentStage = alias(taskStages, "current_stage");
const fromStage = alias(taskStages, "from_stage");
const toStage = alias(taskStages, "to_stage");
const linkStage = alias(taskStages, "link_stage");
const linkAuthor = alias(profiles, "link_author");

const TASK_SELECT = {
  id: staffTasks.id,
  title: staffTasks.title,
  description: staffTasks.description,
  brief: staffTasks.script,
  assigneeId: staffTasks.assigneeId,
  assigneeName: assignee.fullName,
  assigneeRole: assignee.role,
  assignedBy: staffTasks.assignedBy,
  assignedByName: assigner.fullName,
  clientId: staffTasks.clientId,
  clientName: clients.businessName,
  teamIds: teamIdsOf(staffTasks.clientId),
  eventId: staffTasks.eventId,
  dueAt: staffTasks.dueAt,
  priority: staffTasks.priority,
  status: staffTasks.status,
  templateName: staffTasks.templateName,
  stageCount: staffTasks.stageCount,
  currentStageId: currentStage.id,
  currentStageName: currentStage.name,
  currentStagePosition: currentStage.position,
  blockedReason: staffTasks.blockedReason,
  completedAt: staffTasks.completedAt,
  version: staffTasks.version,
  createdAt: staffTasks.createdAt,
  updatedAt: staffTasks.updatedAt,
};

/** Exactly what a list row / board card shows. */
const SUMMARY_SELECT = {
  id: staffTasks.id,
  title: staffTasks.title,
  status: staffTasks.status,
  priority: staffTasks.priority,
  dueAt: staffTasks.dueAt,
  assigneeId: staffTasks.assigneeId,
  assigneeName: assignee.fullName,
  assigneeRole: assignee.role,
  assignedById: staffTasks.assignedBy,
  assignedByName: assigner.fullName,
  clientId: staffTasks.clientId,
  clientName: clients.businessName,
  eventId: staffTasks.eventId,
  templateName: staffTasks.templateName,
  stageCount: staffTasks.stageCount,
  currentStageId: currentStage.id,
  currentStageName: currentStage.name,
  currentStagePosition: currentStage.position,
  blockedReason: staffTasks.blockedReason,
  completedAt: staffTasks.completedAt,
  version: staffTasks.version,
  createdAt: staffTasks.createdAt,
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** SQLSTATE 42P01: the events table isn't there (migration 20261013000004 not applied). Drizzle may wrap it in `cause`. */
function isUndefinedTable(err: unknown): boolean {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "42P01" || e?.cause?.code === "42P01";
}

function taskQuery(ex: Executor, id: string) {
  return ex
    .select(TASK_SELECT)
    .from(staffTasks)
    .innerJoin(assignee, eq(assignee.id, staffTasks.assigneeId))
    .innerJoin(currentStage, eq(currentStage.id, staffTasks.currentStageId))
    .leftJoin(assigner, eq(assigner.id, staffTasks.assignedBy))
    .leftJoin(clients, eq(clients.id, staffTasks.clientId))
    .where(eq(staffTasks.id, id))
    .limit(1);
}
type TaskRow = Awaited<ReturnType<typeof taskQuery>>[number];

function toEntity(row: TaskRow): StaffTaskEntity {
  const { currentStageId, currentStageName, currentStagePosition, ...rest } = row;
  return {
    ...rest,
    currentStage: { id: currentStageId, name: currentStageName, position: currentStagePosition },
    dueAt: iso(row.dueAt),
    completedAt: iso(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function selectTask(ex: Executor, id: string, forUpdate = false): Promise<StaffTaskEntity | null> {
  // FOR UPDATE OF staff_tasks: lock the task, not the profiles, client or stage it joins.
  const [row] = forUpdate ? await taskQuery(ex, id).for("update", { of: staffTasks }) : await taskQuery(ex, id);
  return row ? toEntity(row) : null;
}

/** A task's stages in order: one query. */
async function selectStages(ex: Executor, taskId: string): Promise<TaskStage[]> {
  return ex
    .select({ id: taskStages.id, name: taskStages.name, position: taskStages.position })
    .from(taskStages)
    .where(eq(taskStages.taskId, taskId))
    .orderBy(asc(taskStages.position));
}

/** A task's links, oldest first, with the stage and author names joined in: one query (optionally just one link). */
async function selectLinks(ex: Executor, taskId: string, linkId?: string): Promise<StaffTaskLink[]> {
  const rows = await ex
    .select({
      id: staffTaskLinks.id,
      kind: staffTaskLinks.kind,
      url: staffTaskLinks.url,
      label: staffTaskLinks.label,
      stageId: staffTaskLinks.stageId,
      stageName: linkStage.name,
      addedById: staffTaskLinks.addedBy,
      addedByName: linkAuthor.fullName,
      createdAt: staffTaskLinks.createdAt,
      sharedAssetId: staffTaskLinks.sharedAssetId,
    })
    .from(staffTaskLinks)
    .leftJoin(linkStage, eq(linkStage.id, staffTaskLinks.stageId))
    .leftJoin(linkAuthor, eq(linkAuthor.id, staffTaskLinks.addedBy))
    .where(linkId ? and(eq(staffTaskLinks.taskId, taskId), eq(staffTaskLinks.id, linkId)) : eq(staffTaskLinks.taskId, taskId))
    .orderBy(asc(staffTaskLinks.createdAt), asc(staffTaskLinks.id));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** An event's id, client and title -- or null when it's missing or the events table doesn't exist yet. */
async function selectEvent(eventId: string): Promise<TaskEventRef | null> {
  try {
    const [row] = await db
      .select({ id: events.id, clientId: events.clientId, title: events.title, teamIds: teamIdsOf(events.clientId) })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    return row ?? null;
  } catch (err) {
    if (isUndefinedTable(err)) return null;
    throw err;
  }
}

function linkNotFound(): NotFoundError {
  return new NotFoundError("Link not found", ERROR_CODES.STAFF_TASK_LINK_NOT_FOUND);
}

/**
 * Staff tasks through Drizzle. Every list is one page query (joined to the
 * assignee's profile, the client and the current stage) + one count; a detail
 * is the task, its stages, its links and its timeline (each ONE query, run in
 * parallel) + the event's title when linked. Volume: tens of staff, a few
 * thousand tasks a year; the live set (not done) stays small and has its own
 * partial indexes.
 */
export class DrizzleStaffTasksRepository implements StaffTasksRepositoryPort {
  /** Shared by findMany and countMany so the page and its total can never disagree. */
  private conditions(f: StaffTaskListFilters): SQL | undefined {
    const c: SQL[] = [];
    // Row scope: ANDed with everything below, so no filter can widen it.
    if (f.scope.kind === "own") {
      const me = f.scope.userId;
      c.push(
        or(
          eq(staffTasks.assigneeId, me),
          eq(staffTasks.assignedBy, me),
          // Only client-manager roles see their clients' tasks (a client-less task has no team: the EXISTS is false).
          f.scope.viaTeam ? isOnTeam(staffTasks.clientId, me) : undefined,
        )!,
      );
    }
    if (f.relation === "assigned") c.push(eq(staffTasks.assigneeId, f.callerId));
    else if (f.relation === "created") c.push(eq(staffTasks.assignedBy, f.callerId));
    else if (f.relation === "team") c.push(isOnTeam(staffTasks.clientId, f.callerId));
    if (f.assigneeId) c.push(eq(staffTasks.assigneeId, f.assigneeId));
    if (f.role) c.push(eq(assignee.role, f.role));
    if (f.status) c.push(eq(staffTasks.status, f.status));
    else if (f.openOnly) c.push(ne(staffTasks.status, "done"));
    if (f.priority) c.push(eq(staffTasks.priority, f.priority));
    if (f.clientId) c.push(eq(staffTasks.clientId, f.clientId));
    if (f.overdue) c.push(ne(staffTasks.status, "done"), lt(staffTasks.dueAt, new Date(f.now)));
    if (f.dueFrom) c.push(gte(staffTasks.dueAt, new Date(f.dueFrom)));
    if (f.dueTo) c.push(lt(staffTasks.dueAt, new Date(f.dueTo)));
    if (f.search) c.push(ilike(staffTasks.title, containsPattern(f.search)));
    return c.length ? and(...c) : undefined;
  }

  findMany(filters: StaffTaskListFilters, page: StaffTaskPage) {
    return guarded("load tasks", async () => {
      // Done tasks: most recently completed first. Otherwise open before done,
      // then soonest due (no due date last), then newest; id breaks ties.
      const order =
        filters.status === "done"
          ? [desc(staffTasks.completedAt), desc(staffTasks.id)]
          : [
              asc(sql`(${staffTasks.status} = 'done')`),
              sql`${staffTasks.dueAt} asc nulls last`,
              desc(staffTasks.createdAt),
              desc(staffTasks.id),
            ];
      const rows = await db
        .select(SUMMARY_SELECT)
        .from(staffTasks)
        .innerJoin(assignee, eq(assignee.id, staffTasks.assigneeId))
        .innerJoin(currentStage, eq(currentStage.id, staffTasks.currentStageId))
        .leftJoin(assigner, eq(assigner.id, staffTasks.assignedBy))
        .leftJoin(clients, eq(clients.id, staffTasks.clientId))
        .where(this.conditions(filters))
        .orderBy(...order)
        .limit(page.limit)
        .offset(page.offset);
      return rows.map(
        ({ currentStageId, currentStageName, currentStagePosition, ...r }): StaffTaskSummaryEntity => ({
          ...r,
          currentStage: { id: currentStageId, name: currentStageName, position: currentStagePosition },
          dueAt: iso(r.dueAt),
          completedAt: iso(r.completedAt),
          createdAt: r.createdAt.toISOString(),
        }),
      );
    });
  }

  countMany(filters: StaffTaskListFilters) {
    return guarded("count tasks", async () => {
      const query = db.select({ count: sql<number>`count(*)::int` }).from(staffTasks);
      // The role filter is the only one that needs the assignee's profile.
      const [row] = filters.role
        ? await query.innerJoin(assignee, eq(assignee.id, staffTasks.assigneeId)).where(this.conditions(filters))
        : await query.where(this.conditions(filters));
      return row?.count ?? 0;
    });
  }

  findById(id: string) {
    return guarded("load the task", () => selectTask(db, id));
  }

  findDetail(id: string) {
    return guarded("load the task", async (): Promise<StaffTaskDetail | null> => {
      const [task, stages, links, updates] = await Promise.all([
        selectTask(db, id),
        selectStages(db, id),
        selectLinks(db, id),
        db
          .select({
            id: staffTaskUpdates.id,
            kind: staffTaskUpdates.kind,
            authorId: staffTaskUpdates.authorId,
            authorName: author.fullName,
            fromStatus: staffTaskUpdates.fromStatus,
            toStatus: staffTaskUpdates.toStatus,
            fromAssigneeName: fromAssignee.fullName,
            toAssigneeName: toAssignee.fullName,
            fromStageName: fromStage.name,
            toStageName: toStage.name,
            comment: staffTaskUpdates.comment,
            createdAt: staffTaskUpdates.createdAt,
          })
          .from(staffTaskUpdates)
          .leftJoin(author, eq(author.id, staffTaskUpdates.authorId))
          .leftJoin(fromAssignee, eq(fromAssignee.id, staffTaskUpdates.fromAssigneeId))
          .leftJoin(toAssignee, eq(toAssignee.id, staffTaskUpdates.toAssigneeId))
          .leftJoin(fromStage, eq(fromStage.id, staffTaskUpdates.fromStageId))
          .leftJoin(toStage, eq(toStage.id, staffTaskUpdates.toStageId))
          .where(eq(staffTaskUpdates.taskId, id))
          .orderBy(desc(staffTaskUpdates.createdAt), desc(staffTaskUpdates.id))
          .limit(UPDATES_LIMIT),
      ]);
      if (!task) return null;
      const event = task.eventId ? await selectEvent(task.eventId) : null;
      return {
        ...task,
        eventTitle: event?.title ?? null,
        stages,
        links,
        updates: updates.map((u): StaffTaskUpdate => ({ ...u, createdAt: u.createdAt.toISOString() })),
      };
    });
  }

  findAssigneeCandidate(userId: string) {
    return guarded("load the assignee", async (): Promise<AssigneeCandidate | null> => {
      const [row] = await db
        .select({ id: profiles.id, role: profiles.role, active: profiles.active })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      return row ?? null;
    });
  }

  findClient(clientId: string) {
    return guarded("load the client", async (): Promise<TaskClientRef | null> => {
      const [row] = await db.select({ id: clients.id, teamIds: teamIdsOf(clients.id) }).from(clients).where(eq(clients.id, clientId)).limit(1);
      return row ?? null;
    });
  }

  findEvent(eventId: string) {
    return guarded("load the event", () => selectEvent(eventId));
  }

  findTemplate(templateId: string) {
    return guarded("load the stage template", async (): Promise<TaskTemplate | null> => {
      const [row] = await db
        .select({ id: stageTemplates.id, name: stageTemplates.name, active: stageTemplates.active, kind: stageTemplates.kind, roles: stageTemplates.roles })
        .from(stageTemplates)
        .where(eq(stageTemplates.id, templateId))
        .limit(1);
      if (!row) return null;
      const stages = await db
        .select({ name: stageTemplateStages.name })
        .from(stageTemplateStages)
        .where(eq(stageTemplateStages.templateId, templateId))
        .orderBy(asc(stageTemplateStages.position));
      return { ...row, stageNames: stages.map((s) => s.name) };
    });
  }

  create(record: NewStaffTaskRecord) {
    return guarded("create the task", () =>
      db.transaction(async (tx) => {
        // The stage ids are made here so the task can name its first stage in the same INSERT
        // (the composite FK is deferred to commit, like an event's).
        const stageIds = record.stageNames.map(() => randomUUID());
        const [row] = await tx
          .insert(staffTasks)
          .values({
            title: record.title,
            description: record.description,
            assigneeId: record.assigneeId,
            assignedBy: record.assignedBy,
            clientId: record.clientId,
            eventId: record.eventId,
            dueAt: record.dueAt ? new Date(record.dueAt) : null,
            priority: record.priority,
            script: record.brief,
            templateId: record.templateId,
            templateName: record.templateName,
            stageCount: record.stageNames.length,
            currentStageId: stageIds[0],
          })
          .returning({ id: staffTasks.id });
        const id = row!.id;
        // The template's stages are COPIED; later template edits never reach this task.
        await tx.insert(taskStages).values(record.stageNames.map((name, i) => ({ id: stageIds[i]!, taskId: id, position: i + 1, name })));
        if (record.links.length > 0) {
          await tx.insert(staffTaskLinks).values(
            record.links.map((l, i) => ({
              taskId: id,
              kind: "brief" as const,
              url: l.url,
              label: l.label,
              addedBy: record.assignedBy,
              // Keep the order they were sent in (one transaction = one now()).
              createdAt: new Date(Date.now() + i),
            })),
          );
        }
        await tx.insert(staffTaskUpdates).values({
          taskId: id,
          authorId: record.assignedBy,
          kind: "created",
          toStatus: "todo",
          toAssigneeId: record.assigneeId,
          toStageId: stageIds[0],
        });
        return id;
      }),
    );
  }

  update(id: string, decide: StaffTaskChangeDecision) {
    return guarded("update the task", () =>
      db.transaction(async (tx) => {
        const current = await selectTask(tx, id, true);
        if (!current) throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
        const changes = decide(current, await selectStages(tx, id));

        const { dueAt, brief, ...fields } = changes.fields ?? {};
        const set: Partial<typeof staffTasks.$inferInsert> = { ...fields };
        if (dueAt !== undefined) set.dueAt = dueAt ? new Date(dueAt) : null;
        if (brief !== undefined) set.script = brief;
        if (changes.assigneeId !== undefined) set.assigneeId = changes.assigneeId;
        if (changes.status !== undefined) set.status = changes.status;
        if (changes.stageId !== undefined) set.currentStageId = changes.stageId;
        if (changes.blockedReason !== undefined) set.blockedReason = changes.blockedReason;
        // The 2-hour due reminder starts over for a new due time, a new assignee or a reopened task.
        const reopened = changes.status !== undefined && changes.status !== "done" && current.status === "done";
        if (dueAt !== undefined || changes.assigneeId !== undefined || reopened) set.dueRemindedAt = null;
        if (Object.keys(set).length === 0 && !changes.entry) return; // nothing to write

        await tx
          .update(staffTasks)
          .set({
            ...set,
            // completed_at follows the status (DB CHECK keeps them in step).
            ...(changes.status !== undefined
              ? { completedAt: changes.status === "done" ? sql`now()` : null }
              : {}),
            version: sql`${staffTasks.version} + 1`,
          })
          .where(eq(staffTasks.id, id));

        if (changes.entry) {
          const statusEntry = changes.status !== undefined;
          const reassigned = changes.entry.kind === "reassigned";
          // Every stage-related entry remembers the stage the task was at (a completion and a
          // block happen AT that stage); the one a move or reopen lands on is `toStageId`.
          const stageEntry = !reassigned;
          await tx.insert(staffTaskUpdates).values({
            taskId: id,
            authorId: changes.entry.authorId,
            kind: changes.entry.kind,
            fromStatus: statusEntry ? current.status : null,
            toStatus: statusEntry ? changes.status : null,
            fromAssigneeId: reassigned ? current.assigneeId : null,
            toAssigneeId: reassigned ? changes.assigneeId : null,
            fromStageId: stageEntry ? current.currentStage.id : null,
            toStageId: changes.entry.toStageId ?? null,
            comment: changes.entry.comment,
          });
        }
      }),
    );
  }

  addComment(id: string, guard: (current: StaffTaskEntity) => void, authorId: string, comment: string) {
    return guarded("add the comment", async () => {
      // No lock: a comment changes nothing on the task row (and doesn't bump its version).
      const current = await selectTask(db, id);
      if (!current) throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
      guard(current);
      await db.insert(staffTaskUpdates).values({ taskId: id, authorId, kind: "comment", comment });
    });
  }

  delete(id: string, guard: (current: StaffTaskEntity) => void) {
    return guarded("delete the task", () =>
      db.transaction(async (tx) => {
        const current = await selectTask(tx, id, true);
        if (!current) throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
        guard(current);
        await tx.delete(staffTasks).where(eq(staffTasks.id, id));
        return current;
      }),
    );
  }

  addLink(taskId: string, guard: (ctx: LinkWriteContext) => void, link: NewTaskLink) {
    return guarded("add the link", () =>
      db.transaction(async (tx) => {
        // The task lock serialises two people adding links, so the 50-link cap holds. No version bump.
        const task = await selectTask(tx, taskId, true);
        if (!task) throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
        const [stages, [count]] = await Promise.all([
          selectStages(tx, taskId),
          tx.select({ n: sql<number>`count(*)::int` }).from(staffTaskLinks).where(eq(staffTaskLinks.taskId, taskId)),
        ]);
        guard({ task, stages, linkCount: count?.n ?? 0 });
        const [row] = await tx
          .insert(staffTaskLinks)
          .values({ taskId, kind: link.kind, url: link.url, label: link.label, stageId: link.stageId, addedBy: link.addedBy })
          .returning({ id: staffTaskLinks.id });
        return row!.id;
      }),
    );
  }

  removeLink(taskId: string, linkId: string, guard: (ctx: LinkTargetContext) => void) {
    return guarded("remove the link", () =>
      db.transaction(async (tx) => {
        const task = await selectTask(tx, taskId, true);
        if (!task) throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
        const [link] = await selectLinks(tx, taskId, linkId);
        if (!link) throw linkNotFound();
        guard({ task, link });
        await tx.delete(staffTaskLinks).where(eq(staffTaskLinks.id, linkId));
        return link;
      }),
    );
  }

  shareLink(taskId: string, linkId: string, input: ShareInput, guard: (ctx: LinkTargetContext, event: ShareEventContext | null) => void) {
    return guarded("share the link", () =>
      db.transaction(async (tx) => {
        const task = await selectTask(tx, taskId, true);
        if (!task) throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
        // Lock the link row too, so two people sharing at once can't both pass the "not yet shared" check.
        await tx.select({ id: staffTaskLinks.id }).from(staffTaskLinks).where(and(eq(staffTaskLinks.id, linkId), eq(staffTaskLinks.taskId, taskId))).for("update");
        const [link] = await selectLinks(tx, taskId, linkId);
        if (!link) throw linkNotFound();

        let event: ShareEventContext | null = null;
        if (task.eventId) {
          // The client is locked FOR SHARE (like asset creation), so it can't be archived or reassigned under us.
          const [row] = await tx
            .select({ eventId: events.id, clientId: events.clientId, clientStatus: clients.status, teamIds: teamIdsOf(clients.id) })
            .from(events)
            .innerJoin(clients, eq(clients.id, events.clientId))
            .where(eq(events.id, task.eventId))
            .for("share", { of: clients });
          if (row) {
            const stages = await tx.select({ id: eventStages.id }).from(eventStages).where(eq(eventStages.eventId, row.eventId));
            event = { ...row, stageIds: stages.map((s) => s.id) };
          }
        }
        guard({ task, link }, event);
        if (!event) throw new ConflictError("Link this task to an event before sharing work with the client", ERROR_CODES.STAFF_TASK_NO_EVENT);

        const [asset] = await tx
          .insert(assets)
          .values({
            clientId: event.clientId,
            eventId: event.eventId,
            title: input.title ?? link.label ?? "Delivered work",
            url: link.url,
            // The closest existing type: a delivered link is anything (a folder, a video, a doc).
            type: "other",
            visibleToClient: true,
            eventStageId: input.stageId,
            createdBy: input.createdBy,
          })
          .returning({ id: assets.id });
        await tx.update(staffTaskLinks).set({ sharedAssetId: asset!.id }).where(eq(staffTaskLinks.id, linkId));
        return { assetId: asset!.id, url: link.url };
      }),
    );
  }
}
