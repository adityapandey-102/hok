/**
 * Local-dev seed data. M0: one staff account per role, so every role can be
 * tried as soon as login lands (M2). M3: clients spread across the managers
 * and the Admin (one paused, one archived). M4: three stage templates and
 * three events per client (past, current, upcoming) in each client's time
 * zone. M7: twelve staff tasks across every role (four editor tasks with a
 * brief; some overdue, blocked or done) with matching timelines, reused by
 * (assignee, title). Round 1 (2026-11-02) adds a task an SMM created for the
 * editor, tasks due on fixed days of the current month, and 3 private to-dos per
 * person. Round 2 (2026-11-03) adds task templates (two for roles, one for any role),
 * gives every task a template and its stages, brief links on the editor tasks, one
 * delivered link, and one asset the client can see on the portal.
 *
 * Deliberately calls the AuthProvider directly, not an Application service --
 * seeding is an administrative bypass of RBAC (the same way migrations and the
 * service-role key bypass RLS), not a real user request. needleye's seed works
 * the same way.
 *
 * Safe to re-run: accounts are looked up by email, clients by (owner,
 * business name), templates by name and events by (client, title) first, so a second run reuses them instead of duplicating
 * them. It never deletes or overwrites anything.
 *
 * LOCAL ONLY. The password is a well-known dev value; never run this against a
 * shared or production database.
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../common/database/drizzle-client";
import { authProvider } from "../common/auth/supabase-auth-provider";
import { logger } from "../common/logger/logger";
import { env } from "../config/env";
import { profiles } from "../modules/users/infrastructure/profile.schema";
import { clientMembers, clients } from "../modules/clients/infrastructure/clients.schema";
import type { ClientStatus, SocialPlatform } from "../modules/clients/domain/client.entity";
import { stageTemplateStages, stageTemplates } from "../modules/stage-templates/infrastructure/stage-templates.schema";
import { eventStageHistory, eventStages, events } from "../modules/events/infrastructure/events.schema";
import type { EventState, EventType } from "../modules/events/domain/event.entity";
import { personalEvents } from "../modules/personal-events/infrastructure/personal-events.schema";
import { assetTags, assets, tags } from "../modules/assets/infrastructure/assets.schema";
import type { AssetType } from "../modules/assets/domain/asset.entity";
import { staffTaskLinks, staffTaskUpdates, staffTasks, taskStages } from "../modules/staff-tasks/infrastructure/staff-tasks.schema";
import type { StaffTaskPriority, StaffTaskStatus } from "../modules/staff-tasks/domain/staff-task.entity";
import { todos } from "../modules/todos/infrastructure/todos.schema";
import type { TodoUrgency } from "../modules/todos/domain/todo.entity";
import { nextTodoReminder } from "../modules/todos/domain/todo.rules";
import type { ApproverToken, Role } from "../domain";
import { stageApprovals } from "../modules/approvals/infrastructure/approvals.schema";

export const SEED_PASSWORD = "Hok@2026";

const STAFF: { fullName: string; email: string; role: Role; timeZone: string }[] = [
  { fullName: "Aisha Khan", email: "admin@hok.test", role: "admin", timeZone: "Asia/Kolkata" },
  { fullName: "Rohan Mehta", email: "rohan.smm@hok.test", role: "social_media_manager", timeZone: "Asia/Kolkata" },
  { fullName: "Sara Ali", email: "sara.smm@hok.test", role: "social_media_manager", timeZone: "Asia/Dubai" },
  { fullName: "Vikram Rao", email: "vikram.mm@hok.test", role: "marketing_manager", timeZone: "Europe/London" },
  { fullName: "Kiran Desai", email: "kiran.pm@hok.test", role: "project_manager", timeZone: "Asia/Kolkata" },
  { fullName: "Neha Joshi", email: "neha.agent@hok.test", role: "marketing_agent", timeZone: "Asia/Kolkata" },
  { fullName: "Arjun Das", email: "arjun.dev@hok.test", role: "developer", timeZone: "Asia/Kolkata" },
  { fullName: "Meera Nair", email: "meera.editor@hok.test", role: "editor", timeZone: "Asia/Kolkata" },
  { fullName: "Isha Verma", email: "isha.writer@hok.test", role: "content_writer", timeZone: "Asia/Kolkata" },
];

async function seedStaff(): Promise<void> {
  const existing = await db
    .select({ email: profiles.email })
    .from(profiles)
    .where(inArray(profiles.email, STAFF.map((s) => s.email)));
  const have = new Set(existing.map((r) => r.email));

  for (const person of STAFF) {
    if (have.has(person.email)) {
      logger.info({ email: person.email }, "seed: staff account already exists -- reused");
      continue;
    }
    await authProvider.createUser({
      email: person.email,
      password: SEED_PASSWORD,
      fullName: person.fullName,
      role: person.role,
      timeZone: person.timeZone,
    });
    logger.info({ email: person.email, role: person.role }, "seed: staff account created");
  }
}

interface SeedClient {
  ownerEmail: string;
  businessName: string;
  industry: string;
  contactPerson: string;
  phone: string;
  email: string;
  website: string;
  socialHandles: Partial<Record<SocialPlatform, string>>;
  services: string[];
  contractStart: string;
  contractEnd: string;
  timeZone: string;
  status: ClientStatus;
  notes?: string;
}

const CLIENTS: SeedClient[] = [
  { ownerEmail: "rohan.smm@hok.test", businessName: "Chai Point Cafe", industry: "Food & Beverage", contactPerson: "Kabir Shah", phone: "+91 98200 11111", email: "kabir@chaipoint.example", website: "https://chaipoint.example", socialHandles: { instagram: "@chaipointcafe", facebook: "chaipointcafe" }, services: ["Social media management", "Monthly shoot"], contractStart: "2026-04-01", contractEnd: "2027-03-31", timeZone: "Asia/Kolkata", status: "active", notes: "Prefers WhatsApp for approvals." },
  { ownerEmail: "rohan.smm@hok.test", businessName: "Urban Threads", industry: "Fashion", contactPerson: "Ananya Iyer", phone: "+91 98200 22222", email: "ananya@urbanthreads.example", website: "https://urbanthreads.example", socialHandles: { instagram: "@urbanthreads", tiktok: "@urbanthreads" }, services: ["Reels", "Influencer outreach"], contractStart: "2026-07-01", contractEnd: "2026-12-31", timeZone: "Asia/Kolkata", status: "active" },
  { ownerEmail: "sara.smm@hok.test", businessName: "Desert Rose Spa", industry: "Wellness", contactPerson: "Layla Haddad", phone: "+971 50 123 4567", email: "layla@desertrose.example", website: "https://desertrose.example", socialHandles: { instagram: "@desertrosespa", youtube: "https://youtube.com/@desertrosespa" }, services: ["Social media management", "Paid ads"], contractStart: "2026-01-15", contractEnd: "2027-01-14", timeZone: "Asia/Dubai", status: "active" },
  { ownerEmail: "sara.smm@hok.test", businessName: "Gulf Auto Detailing", industry: "Automotive", contactPerson: "Omar Farouk", phone: "+971 55 987 6543", email: "omar@gulfauto.example", website: "https://gulfauto.example", socialHandles: { instagram: "@gulfautodetailing" }, services: ["Monthly shoot"], contractStart: "2026-02-01", contractEnd: "2026-11-30", timeZone: "Asia/Dubai", status: "paused", notes: "Paused over the summer; resumes in November." },
  { ownerEmail: "vikram.mm@hok.test", businessName: "Thames Coffee Roasters", industry: "Food & Beverage", contactPerson: "Oliver Grant", phone: "+44 20 7946 0958", email: "oliver@thamescoffee.example", website: "https://thamescoffee.example", socialHandles: { instagram: "@thamescoffee", linkedin: "company/thames-coffee" }, services: ["Brand strategy", "Email marketing"], contractStart: "2026-03-01", contractEnd: "2027-02-28", timeZone: "Europe/London", status: "active" },
  { ownerEmail: "vikram.mm@hok.test", businessName: "Northwind Fitness", industry: "Fitness", contactPerson: "Hannah Lee", phone: "+44 161 496 0000", email: "hannah@northwind.example", website: "https://northwind.example", socialHandles: { instagram: "@northwindfit", youtube: "https://youtube.com/@northwindfit" }, services: ["Reels", "Paid ads"], contractStart: "2025-09-01", contractEnd: "2026-08-31", timeZone: "Europe/London", status: "archived", notes: "Contract ended; archived." },
  { ownerEmail: "admin@hok.test", businessName: "HOK Studio (in-house)", industry: "Marketing", contactPerson: "Aisha Khan", phone: "+91 98200 33333", email: "studio@hok.example", website: "https://hok.example", socialHandles: { instagram: "@hokstudio", linkedin: "company/hok" }, services: ["Social media management"], contractStart: "2026-01-01", contractEnd: "2026-12-31", timeZone: "Asia/Kolkata", status: "active" },
  { ownerEmail: "admin@hok.test", businessName: "Lotus Interiors", industry: "Interior Design", contactPerson: "Riya Kapoor", phone: "+91 98200 44444", email: "riya@lotusinteriors.example", website: "https://lotusinteriors.example", socialHandles: { instagram: "@lotusinteriors", pinterest: "lotusinteriors" }, services: ["Monthly shoot", "Website content"], contractStart: "2026-05-01", contractEnd: "2027-04-30", timeZone: "Asia/Kolkata", status: "active" },
];

async function seedClients(): Promise<void> {
  const owners = await db
    .select({ id: profiles.id, email: profiles.email })
    .from(profiles)
    .where(inArray(profiles.email, [...new Set(CLIENTS.map((c) => c.ownerEmail))]));
  const ownerIdByEmail = new Map(owners.map((o) => [o.email, o.id]));

  for (const { ownerEmail, ...client } of CLIENTS) {
    const ownerId = ownerIdByEmail.get(ownerEmail);
    if (!ownerId) {
      logger.warn({ ownerEmail, businessName: client.businessName }, "seed: owner missing -- client skipped");
      continue;
    }
    const [existing] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.ownerId, ownerId), eq(clients.businessName, client.businessName)))
      .limit(1);
    if (existing) {
      logger.info({ businessName: client.businessName }, "seed: client already exists -- reused");
      continue;
    }
    // The sample data keeps one of each for readability; the table stores lists.
    const { contactPerson, phone, website, socialHandles, ...rest } = client;
    const [created] = await db.insert(clients).values({
      ...rest,
      contacts: [{ name: contactPerson, phone: null, email: null }],
      phones: [phone],
      websites: [website],
      socialAccounts: Object.entries(socialHandles).map(([platform, handle]) => ({ platform: platform as SocialPlatform, handle })),
      ownerId,
      notes: client.notes ?? null,
      archivedAt: client.status === "archived" ? new Date() : null,
    }).returning({ id: clients.id });
    // The lead is always on the client's team.
    await db.insert(clientMembers).values({ clientId: created!.id, profileId: ownerId }).onConflictDoNothing();
    logger.info({ businessName: client.businessName, ownerEmail, status: client.status }, "seed: client created");
  }

  // A sample multi-person team: the Project Manager also works on Chai Point Cafe (led by Rohan).
  for (const [businessName, emails] of Object.entries(EXTRA_TEAM)) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.businessName, businessName)).limit(1);
    const people = await db.select({ id: profiles.id }).from(profiles).where(inArray(profiles.email, emails));
    if (!client || people.length === 0) continue;
    await db.insert(clientMembers).values(people.map((p) => ({ clientId: client.id, profileId: p.id }))).onConflictDoNothing();
  }
}

/** Extra team members (besides the lead) for some sample clients. */
const EXTRA_TEAM: Record<string, string[]> = { "Chai Point Cafe": ["kiran.pm@hok.test"] };

const TEMPLATES: { name: string; stages: string[]; kind: "event" | "task"; roles: Role[]; approvers?: Record<number, ApproverToken[]> }[] = [
  { name: "Photo Shoot", kind: "event", roles: [], stages: ["Planned", "Pre-production", "Shoot", "Editing", "Client Review", "Completed"] },
  { name: "Reel Production", kind: "event", roles: [], stages: ["Brief", "Script", "Shoot", "Edit", "Client Review", "Published"] },
  { name: "Campaign Launch", kind: "event", roles: [], stages: ["Strategy", "Creatives", "Approval", "Live", "Report"] },
  // Task templates (round 2): the stages a staff task moves through. Offered for the listed roles; empty = any role.
  { name: "Reel edit", kind: "task", roles: ["editor"], stages: ["Brief received", "Rough cut", "Review", "Final cut"] },
  { name: "Caption writing", kind: "task", roles: ["content_writer"], stages: ["Draft", "Review", "Final"] },
  { name: "General task", kind: "task", roles: [], stages: ["To do", "In progress", "Done"] },
  // Round 3 (stage approvals). `approvers` = stage index (0-based) -> who approves it.
  // The client signs off in the portal at "Client Review".
  { name: "Shoot with client sign-off", kind: "event", roles: [], stages: ["Planned", "Shoot", "Editing", "Client Review", "Completed"], approvers: { 3: ["client"] } },
  // The example from the team feedback: stage 4 by an SMM or the Admin, stage 5 by the Admin only.
  { name: "Reel edit (approvals)", kind: "task", roles: ["editor"], stages: ["Brief received", "Rough cut", "Review", "Final cut", "Delivery"], approvers: { 3: ["social_media_manager", "admin"], 4: ["admin"] } },
];

/** The task template each seeded task uses, by its assignee's role. */
function taskTemplateFor(role: Role): string {
  return role === "editor" ? "Reel edit" : role === "content_writer" ? "Caption writing" : "General task";
}

async function seedTemplates(adminId: string | undefined): Promise<Map<string, { id: string; stages: string[] }>> {
  const byName = new Map<string, { id: string; stages: string[] }>();
  for (const t of TEMPLATES) {
    const [existing] = await db.select({ id: stageTemplates.id }).from(stageTemplates).where(sql`lower(${stageTemplates.name}) = lower(${t.name})`).limit(1);
    if (existing) {
      const rows = await db.select({ name: stageTemplateStages.name }).from(stageTemplateStages).where(eq(stageTemplateStages.templateId, existing.id)).orderBy(stageTemplateStages.position);
      byName.set(t.name, { id: existing.id, stages: rows.map((r) => r.name) });
      logger.info({ name: t.name }, "seed: stage template already exists -- reused");
      continue;
    }
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(stageTemplates).values({ name: t.name, kind: t.kind, roles: t.roles, createdBy: adminId ?? null }).returning({ id: stageTemplates.id });
      await tx.insert(stageTemplateStages).values(t.stages.map((name, i) => ({ templateId: row!.id, position: i + 1, name, approvers: t.approvers?.[i] ?? [] })));
      return row!.id;
    });
    byName.set(t.name, { id, stages: t.stages });
    logger.info({ name: t.name }, "seed: stage template created");
  }
  return byName;
}

const DAY = 24 * 60 * 60 * 1000;

/** Per client: a finished event in the past, one in progress around now, one upcoming -- relative to the day the seed runs. */
const EVENT_PLAN: { suffix: string; template: string; type: EventType; dayOffset: number; hours: number; stageIndex: "last" | "middle" | "first"; state: EventState }[] = [
  { suffix: "Brand shoot", template: "Photo Shoot", type: "shoot", dayOffset: -21, hours: 6, stageIndex: "last", state: "active" },
  { suffix: "Monthly reels", template: "Reel Production", type: "content_posting", dayOffset: 1, hours: 3, stageIndex: "middle", state: "active" },
  { suffix: "Festive campaign", template: "Campaign Launch", type: "campaign", dayOffset: 12, hours: 2, stageIndex: "first", state: "active" },
];

/**
 * Repairs a seeded event whose history rows all share one timestamp (the
 * first M4 seed wrote them in one transaction without explicit times):
 * follows the seed's linear chain (null -> first stage -> ...) and stamps the
 * entries one minute apart in that order. Leaves any event with distinct
 * timestamps -- i.e. real use -- untouched.
 */
async function restampSeededHistory(eventId: string): Promise<void> {
  const rows = await db
    .select({ id: eventStageHistory.id, from: eventStageHistory.fromStageId, to: eventStageHistory.toStageId, createdAt: eventStageHistory.createdAt })
    .from(eventStageHistory)
    .where(eq(eventStageHistory.eventId, eventId));
  if (rows.length < 2 || new Set(rows.map((r) => r.createdAt.getTime())).size > 1) return;

  const ordered: typeof rows = [];
  let next = rows.find((r) => r.from === null);
  while (next && ordered.length < rows.length) {
    ordered.push(next);
    const to = next.to;
    next = rows.find((r) => r.from === to && !ordered.includes(r));
  }
  if (ordered.length !== rows.length) return; // not a seed-shaped chain; leave it alone

  const base = rows[0]!.createdAt.getTime() - (rows.length - 1) * 60_000;
  await db.transaction(async (tx) => {
    for (const [k, r] of ordered.entries()) {
      await tx.update(eventStageHistory).set({ createdAt: new Date(base + k * 60_000) }).where(eq(eventStageHistory.id, r.id));
    }
  });
  logger.info({ eventId }, "seed: event history re-stamped in order");
}

async function seedEvents(templates: Map<string, { id: string; stages: string[] }>): Promise<void> {
  const rows = await db
    .select({ id: clients.id, name: clients.businessName, timeZone: clients.timeZone, ownerId: clients.ownerId, status: clients.status })
    .from(clients)
    .where(inArray(clients.businessName, CLIENTS.map((c) => c.businessName)));
  // Midnight UTC today, so re-runs on the same day produce the same times.
  const today = Math.floor(Date.now() / DAY) * DAY;

  for (const client of rows) {
    for (const [i, plan] of EVENT_PLAN.entries()) {
      const title = `${client.name}: ${plan.suffix}`;
      const [existing] = await db.select({ id: events.id }).from(events).where(and(eq(events.clientId, client.id), eq(events.title, title))).limit(1);
      if (existing) {
        await restampSeededHistory(existing.id);
        continue;
      }
      const template = templates.get(plan.template);
      if (!template) continue;
      // Spread start hours a little per client, 10:00 UTC + i.
      const startsAt = new Date(today + plan.dayOffset * DAY + (10 + i) * 3600_000);
      const endsAt = new Date(startsAt.getTime() + plan.hours * 3600_000);
      const target =
        plan.stageIndex === "first" ? 0 : plan.stageIndex === "last" ? template.stages.length - 1 : Math.floor(template.stages.length / 2);

      await db.transaction(async (tx) => {
        const [event] = await tx
          .insert(events)
          .values({
            clientId: client.id,
            title,
            type: plan.type,
            startsAt,
            endsAt,
            timeZone: client.timeZone,
            location: plan.type === "shoot" ? "Client premises" : "Online",
            templateId: template.id,
            templateName: plan.template,
            stageCount: template.stages.length,
            state: plan.state,
            createdBy: client.ownerId,
          })
          .returning({ id: events.id });
        const stages = await tx
          .insert(eventStages)
          .values(template.stages.map((name, pos) => ({ eventId: event!.id, position: pos + 1, name })))
          .returning({ id: eventStages.id, position: eventStages.position });
        stages.sort((a, b) => a.position - b.position);
        await tx.update(events).set({ currentStageId: stages[target]!.id }).where(eq(events.id, event!.id));
        // History: created at the first stage, then one move per stage up to the current one.
        // One minute apart: rows inserted in one transaction would otherwise share now(),
        // and the detail's newest-first order would be arbitrary.
        const base = Date.now() - (target + 1) * 60_000;
        await tx.insert(eventStageHistory).values([
          { eventId: event!.id, fromStageId: null, toStageId: stages[0]!.id, changedBy: client.ownerId, createdAt: new Date(base) },
          ...stages.slice(1, target + 1).map((st, k) => ({
            eventId: event!.id,
            fromStageId: stages[k]!.id,
            toStageId: st.id,
            note: k === target - 1 ? "Moving along nicely." : null,
            visibleToClient: k === target - 1,
            changedBy: client.ownerId,
            createdAt: new Date(base + (k + 1) * 60_000),
          })),
        ]);
      });
      logger.info({ title, timeZone: client.timeZone }, "seed: event created");
    }
  }
}

/** Per client: a few reference links (Drive, Canva, ...), each with tags; the first is linked to the client's first event. */
const ASSET_PLAN: { title: string; url: string; type: AssetType; comment: string; tags: string[]; linkEvent?: boolean; sharedWithClientFor?: string }[] = [
  { title: "Raw footage: brand shoot", url: "https://drive.google.com/drive/folders/hok-seed-raw", type: "video", comment: "Unedited clips from the shoot day.", tags: ["Raw", "Shoot"], linkEvent: true },
  { title: "Brand kit (logos, colours)", url: "https://www.canva.com/design/hok-seed-brand-kit", type: "design", comment: "Latest approved brand kit.", tags: ["Brand", "Design"] },
  { title: "Monthly content plan", url: "https://docs.google.com/document/d/hok-seed-plan", type: "document", comment: "Posting plan shared with the client.", tags: ["Plan", "Reels"] },
  // Round 2: the one asset the client sees on their portal (under the first event, tied to its third stage). Only for this client.
  { title: "Final photos: brand shoot", url: "https://drive.google.com/drive/folders/hok-seed-final-photos", type: "photo", comment: "Edited photos, ready to use.", tags: ["Final"], linkEvent: true, sharedWithClientFor: "Chai Point Cafe" },
];

async function seedAssets(): Promise<void> {
  const rows = await db
    .select({ id: clients.id, name: clients.businessName, ownerId: clients.ownerId })
    .from(clients)
    .where(inArray(clients.businessName, CLIENTS.map((c) => c.businessName)));
  for (const client of rows) {
    const [first] = await db.select({ id: events.id }).from(events).where(eq(events.clientId, client.id)).orderBy(events.startsAt).limit(1);
    for (const plan of ASSET_PLAN) {
      if (plan.sharedWithClientFor && plan.sharedWithClientFor !== client.name) continue;
      const title = `${client.name}: ${plan.title}`;
      const [existing] = await db.select({ id: assets.id }).from(assets).where(and(eq(assets.clientId, client.id), eq(assets.title, title))).limit(1);
      if (existing) continue;
      const eventId = plan.linkEvent ? (first?.id ?? null) : null;
      // The client-visible asset needs its event; its stage is the event's third one.
      let eventStageId: string | null = null;
      if (plan.sharedWithClientFor && eventId) {
        const [st] = await db.select({ id: eventStages.id }).from(eventStages).where(and(eq(eventStages.eventId, eventId), eq(eventStages.position, 3))).limit(1);
        eventStageId = st?.id ?? null;
      }
      const visibleToClient = Boolean(plan.sharedWithClientFor && eventId);
      await db.transaction(async (tx) => {
        const [asset] = await tx
          .insert(assets)
          .values({ clientId: client.id, eventId, title, url: plan.url, type: plan.type, comment: plan.comment, visibleToClient, eventStageId, createdBy: client.ownerId })
          .returning({ id: assets.id });
        await tx.insert(tags).values(plan.tags.map((name) => ({ clientId: client.id, name }))).onConflictDoNothing();
        const tagRows = await tx.select({ id: tags.id, name: tags.name }).from(tags).where(eq(tags.clientId, client.id));
        const wanted = new Set(plan.tags.map((t) => t.toLowerCase()));
        await tx.insert(assetTags).values(tagRows.filter((t) => wanted.has(t.name.toLowerCase())).map((t) => ({ assetId: asset!.id, tagId: t.id })));
      });
      logger.info({ title }, "seed: asset created");
    }
  }
}

// -- Staff tasks (M7) ---------------------------------------------------------------

interface SeedTask {
  assigneeEmail: string;
  title: string;
  description?: string;
  priority: StaffTaskPriority;
  /** Days from today (UTC midnight) + 18:00 UTC; negative = overdue unless done. Omit for no due date. */
  dueInDays?: number;
  /** Day of the CURRENT month (UTC) at 18:00 UTC, so the month view always has tasks in it. Wins over dueInDays. */
  dueInMonthDay?: number;
  /** Who created it (a client manager, assigning down the ladder); the Admin when omitted. */
  assignedByEmail?: string;
  /** The status path the task has walked, starting after "todo" (each step is a timeline entry). */
  path: StaffTaskStatus[];
  comments?: { byAdmin: boolean; text: string }[];
  client?: string;
  /** Seeded event title suffix under `client` (see EVENT_PLAN). */
  event?: string;
  /** Becomes the task's brief (script) and its "Raw files" / "Reference edit" brief links. */
  editor?: { rawFilesUrl: string; referenceUrl?: string; script?: string };
  /** Why it is blocked, when the path ends in "blocked". */
  blockedReason?: string;
  /** A delivered link the assignee added (finished work). Added once, also to a task that already exists. */
  delivered?: { url: string; label: string };
}

const TASKS: SeedTask[] = [
  { assigneeEmail: "meera.editor@hok.test", title: "Edit the Chai Point monthly reel", priority: "high", dueInDays: 2, path: ["in_progress"], client: "Chai Point Cafe", event: "Monthly reels", comments: [{ byAdmin: false, text: "First cut by tomorrow evening." }], delivered: { url: "https://drive.google.com/file/d/chai-point-first-cut", label: "First cut" }, editor: { rawFilesUrl: "https://drive.google.com/drive/folders/chai-point-raw", referenceUrl: "https://www.instagram.com/reel/example-style", script: "0-3s: steam rising from a fresh cup.\n3-8s: barista pouring, slow motion.\n8-15s: customers laughing, logo end card." } },
  { assigneeEmail: "meera.editor@hok.test", title: "Colour-grade the Desert Rose spa shoot", priority: "medium", dueInDays: -1, path: ["in_progress", "blocked"], blockedReason: "Half the RAW files are missing from the folder.", client: "Desert Rose Spa", comments: [{ byAdmin: false, text: "Blocked: half the RAW files are missing from the folder." }, { byAdmin: true, text: "Asked Sara to re-upload them today." }], editor: { rawFilesUrl: "https://drive.google.com/drive/folders/desert-rose-raw" } },
  { assigneeEmail: "isha.writer@hok.test", title: "Write 5 captions for the Chai Point monthly reels", priority: "medium", dueInDays: 3, path: ["in_progress"], client: "Chai Point Cafe", comments: [{ byAdmin: true, text: "Tone: warm and playful. Use the brand hashtags from the folder." }] },
  { assigneeEmail: "meera.editor@hok.test", title: "Cut a 15s teaser for Urban Threads", priority: "low", dueInDays: -5, path: ["in_progress", "done"], client: "Urban Threads", editor: { rawFilesUrl: "https://drive.google.com/drive/folders/urban-threads-raw", referenceUrl: "https://youtu.be/example-teaser", script: "Fast cuts on the beat; end on the new collection logo." } },
  { assigneeEmail: "meera.editor@hok.test", title: "Subtitle the Thames Coffee interview", priority: "medium", dueInDays: 6, path: [], client: "Thames Coffee Roasters", editor: { rawFilesUrl: "https://drive.google.com/drive/folders/thames-interview" } },
  { assigneeEmail: "arjun.dev@hok.test", title: "Fix the contact form on lotusinteriors.example", description: "Submissions bounce with a 500 since the hosting move.", priority: "urgent", dueInDays: -2, path: ["in_progress"], client: "Lotus Interiors" },
  { assigneeEmail: "arjun.dev@hok.test", title: "Add the Instagram feed widget to the HOK site", priority: "low", path: [] },
  { assigneeEmail: "arjun.dev@hok.test", title: "Speed up the Northwind landing page", priority: "medium", dueInDays: -12, path: ["in_progress", "done"], comments: [{ byAdmin: true, text: "Great work, the score went from 48 to 91." }] },
  { assigneeEmail: "neha.agent@hok.test", title: "Draft the Diwali offer email for Chai Point", priority: "high", dueInDays: 1, path: [], client: "Chai Point Cafe" },
  { assigneeEmail: "neha.agent@hok.test", title: "Collect 5 influencer leads for Urban Threads", priority: "medium", dueInDays: -3, path: ["in_progress"], client: "Urban Threads" },
  { assigneeEmail: "rohan.smm@hok.test", title: "Prepare the Q4 content calendar", priority: "high", dueInDays: 4, path: ["in_progress"] },
  { assigneeEmail: "sara.smm@hok.test", title: "Re-upload the Desert Rose RAW files", priority: "urgent", dueInDays: 0, path: [], client: "Desert Rose Spa" },
  { assigneeEmail: "vikram.mm@hok.test", title: "Review the Thames Coffee ad budget", priority: "medium", dueInDays: 10, path: [], client: "Thames Coffee Roasters" },
  // Round 1: a task an SMM created for the editor (on the SMM's own client), and tasks due on fixed days of this month.
  { assigneeEmail: "meera.editor@hok.test", assignedByEmail: "rohan.smm@hok.test", title: "Trim the Chai Point behind-the-scenes clip", description: "30 seconds, vertical, with captions.", priority: "medium", dueInMonthDay: 12, path: [], client: "Chai Point Cafe" },
  { assigneeEmail: "arjun.dev@hok.test", title: "Set up analytics for Urban Threads", priority: "medium", dueInMonthDay: 15, path: [], client: "Urban Threads" },
  { assigneeEmail: "neha.agent@hok.test", title: "Weekly performance summary for the Admin", priority: "low", dueInMonthDay: 18, path: [] },
  { assigneeEmail: "isha.writer@hok.test", title: "Proofread the Desert Rose newsletter", priority: "high", dueInMonthDay: 22, path: [], client: "Desert Rose Spa" },
];

/** Day `day` of the current UTC month at 18:00 UTC. */
function dayOfThisMonth(day: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 18));
}

/**
 * Tasks across every role (four editor tasks with a brief), each on a task template, at the stage its
 * status implies, with a matching timeline. Reused by (assignee, title).
 */
async function seedStaffTasks(adminId: string | undefined, templates: Map<string, { id: string; stages: string[] }>): Promise<void> {
  if (!adminId) return;
  const probe = await db.execute(sql`select to_regclass('public.staff_tasks') is not null as ok`);
  if ((probe.rows[0] as { ok: boolean } | undefined)?.ok !== true) {
    logger.warn("seed: staff_tasks table missing (migration 20261014200001 not applied yet) -- staff tasks skipped");
    return;
  }
  const probeStages = await db.execute(sql`select to_regclass('public.task_stages') is not null as ok`);
  if ((probeStages.rows[0] as { ok: boolean } | undefined)?.ok !== true) {
    logger.warn("seed: task_stages table missing (migration 20261103000001 not applied yet) -- staff tasks skipped");
    return;
  }
  const people = await db
    .select({ id: profiles.id, email: profiles.email, role: profiles.role })
    .from(profiles)
    .where(inArray(profiles.email, [...new Set(TASKS.flatMap((t) => (t.assignedByEmail ? [t.assigneeEmail, t.assignedByEmail] : [t.assigneeEmail])))]));
  const idByEmail = new Map(people.map((p) => [p.email, p.id]));
  const roleByEmail = new Map(people.map((p) => [p.email, p.role]));
  const clientRows = await db
    .select({ id: clients.id, name: clients.businessName })
    .from(clients)
    .where(inArray(clients.businessName, [...new Set(TASKS.flatMap((t) => (t.client ? [t.client] : [])))]));
  const clientIdByName = new Map(clientRows.map((c) => [c.name, c.id]));
  const today = Math.floor(Date.now() / DAY) * DAY;

  for (const t of TASKS) {
    const assigneeId = idByEmail.get(t.assigneeEmail);
    if (!assigneeId) continue;
    const creatorId = t.assignedByEmail ? (idByEmail.get(t.assignedByEmail) ?? adminId) : adminId;
    const [existing] = await db
      .select({ id: staffTasks.id })
      .from(staffTasks)
      .where(and(eq(staffTasks.assigneeId, assigneeId), eq(staffTasks.title, t.title)))
      .limit(1);
    if (existing) {
      logger.info({ title: t.title }, "seed: staff task already exists -- reused");
      if (t.delivered) await ensureDeliveredLink(existing.id, assigneeId, t.delivered);
      continue;
    }
    const templateName = taskTemplateFor(roleByEmail.get(t.assigneeEmail) ?? "developer");
    const template = templates.get(templateName);
    if (!template) continue;
    const clientId = t.client ? (clientIdByName.get(t.client) ?? null) : null;
    let eventId: string | null = null;
    if (clientId && t.event) {
      const [ev] = await db.select({ id: events.id }).from(events).where(and(eq(events.clientId, clientId), eq(events.title, `${t.client}: ${t.event}`))).limit(1);
      eventId = ev?.id ?? null;
    }
    const status: StaffTaskStatus = t.path.at(-1) ?? "todo";
    const stageCount = template.stages.length;
    // Where the status puts it: todo = stage 1, in progress / blocked = stage 2, done = completed at the last stage.
    const position = status === "todo" ? 1 : status === "done" ? stageCount : 2;
    // The timeline is spread over the last few hours so it reads in order.
    const moves = t.path.length + (status === "done" && stageCount > 2 ? 1 : 0);
    const steps = 1 + moves + (t.comments?.length ?? 0);
    const at = (i: number) => new Date(Date.now() - (steps - i) * 3600_000);

    await db.transaction(async (tx) => {
      const stageIds = template.stages.map(() => randomUUID());
      const [row] = await tx
        .insert(staffTasks)
        .values({
          title: t.title,
          description: t.description ?? null,
          assigneeId,
          assignedBy: creatorId,
          clientId,
          eventId,
          dueAt:
            t.dueInMonthDay !== undefined
              ? dayOfThisMonth(t.dueInMonthDay)
              : t.dueInDays === undefined
                ? null
                : new Date(today + t.dueInDays * DAY + 18 * 3600_000),
          priority: t.priority,
          status,
          completedAt: status === "done" ? at(moves) : null,
          script: t.editor?.script ?? null,
          templateId: template.id,
          templateName,
          stageCount,
          currentStageId: stageIds[position - 1],
          blockedReason: status === "blocked" ? (t.blockedReason ?? "Waiting on something") : null,
          version: 1 + moves,
        })
        .returning({ id: staffTasks.id });
      const taskId = row!.id;
      await tx.insert(taskStages).values(template.stages.map((name, i) => ({ id: stageIds[i]!, taskId, position: i + 1, name })));

      // Brief links: the editor's raw files and reference edit.
      const briefLinks = [
        ...(t.editor?.rawFilesUrl ? [{ url: t.editor.rawFilesUrl, label: "Raw files" }] : []),
        ...(t.editor?.referenceUrl ? [{ url: t.editor.referenceUrl, label: "Reference edit" }] : []),
      ];
      if (briefLinks.length > 0) {
        await tx
          .insert(staffTaskLinks)
          .values(briefLinks.map((l, i) => ({ taskId, kind: "brief" as const, url: l.url, label: l.label, addedBy: creatorId, createdAt: new Date(Date.now() - 1000 * (briefLinks.length - i)) })));
      }
      if (t.delivered) {
        await tx.insert(staffTaskLinks).values({ taskId, kind: "delivered", url: t.delivered.url, label: t.delivered.label, stageId: stageIds[Math.min(1, stageCount - 1)]!, addedBy: assigneeId });
      }

      // The timeline: created, then one entry per step of the status path, then the comments.
      type Entry = typeof staffTaskUpdates.$inferInsert;
      const entries: Entry[] = [{ taskId, authorId: creatorId, kind: "created", toStatus: "todo", toAssigneeId: assigneeId, toStageId: stageIds[0]!, createdAt: at(0) }];
      let from: StaffTaskStatus = "todo";
      let stageAt = 0;
      let n = 1;
      for (const to of t.path) {
        if (to === "in_progress") {
          entries.push({ taskId, authorId: assigneeId, kind: "stage", fromStatus: from, toStatus: to, fromStageId: stageIds[stageAt]!, toStageId: stageIds[1]!, createdAt: at(n++) });
          stageAt = 1;
        } else if (to === "blocked") {
          entries.push({ taskId, authorId: assigneeId, kind: "blocked", fromStatus: from, toStatus: to, fromStageId: stageIds[stageAt]!, comment: t.blockedReason ?? "Waiting on something", createdAt: at(n++) });
        } else if (to === "done") {
          if (stageCount > 2) {
            entries.push({ taskId, authorId: assigneeId, kind: "stage", fromStatus: from, toStatus: "in_progress", fromStageId: stageIds[stageAt]!, toStageId: stageIds[stageCount - 1]!, createdAt: at(n++) });
            from = "in_progress";
            stageAt = stageCount - 1;
          }
          entries.push({ taskId, authorId: assigneeId, kind: "completed", fromStatus: from, toStatus: "done", fromStageId: stageIds[stageAt]!, createdAt: at(n++) });
        }
        from = to;
      }
      for (const [i, c] of (t.comments ?? []).entries()) {
        entries.push({ taskId, authorId: c.byAdmin ? adminId : assigneeId, kind: "comment", comment: c.text, createdAt: at(1 + moves + i) });
      }
      await tx.insert(staffTaskUpdates).values(entries);
    });
    logger.info({ title: t.title, assignee: t.assigneeEmail, status }, "seed: staff task created");
  }
}

/** A delivered link on a task that already exists (an older seed run made it without one); added once. */
async function ensureDeliveredLink(taskId: string, assigneeId: string, link: { url: string; label: string }): Promise<void> {
  const [have] = await db.select({ id: staffTaskLinks.id }).from(staffTaskLinks).where(and(eq(staffTaskLinks.taskId, taskId), eq(staffTaskLinks.kind, "delivered"))).limit(1);
  if (have) return;
  const [stage] = await db.select({ id: taskStages.id }).from(taskStages).where(and(eq(taskStages.taskId, taskId), eq(taskStages.position, 2))).limit(1);
  await db.insert(staffTaskLinks).values({ taskId, kind: "delivered", url: link.url, label: link.label, stageId: stage?.id ?? null, addedBy: assigneeId });
  logger.info({ label: link.label }, "seed: delivered link added to an existing task");
}


/**
 * M5: two personal calendar entries per client manager (a weekly planning
 * slot and a one-off, the second linked to one of their own clients), in
 * each manager's own zone, relative to the day the seed runs. Idempotent by
 * (owner, title).
 */
/** The stages of a template with their approvers (what a new event or task snapshots). */
async function templateStages(templateId: string): Promise<{ name: string; approvers: ApproverToken[] }[]> {
  return db
    .select({ name: stageTemplateStages.name, approvers: stageTemplateStages.approvers })
    .from(stageTemplateStages)
    .where(eq(stageTemplateStages.templateId, templateId))
    .orderBy(stageTemplateStages.position);
}

/**
 * Round 3 (stage approvals): one event on the "Shoot with client sign-off" template sitting on its Client Review stage with a
 * pending request for the CLIENT (try it on the portal), and one task on "Reel edit (approvals)" sitting on stage 4 with a
 * pending request for an SMM or the Admin. Reused by (client, title) / (assignee, title).
 */
async function seedApprovals(templates: Map<string, { id: string; stages: string[] }>): Promise<void> {
  const probe = await db.execute(sql`select to_regclass('public.stage_approvals') is not null as ok`);
  if ((probe.rows[0] as { ok: boolean } | undefined)?.ok !== true) {
    logger.warn("seed: stage_approvals table missing (migration 20261104000001 not applied yet) -- approvals skipped");
    return;
  }
  const people = await db
    .select({ id: profiles.id, email: profiles.email })
    .from(profiles)
    .where(inArray(profiles.email, ["rohan.smm@hok.test", "meera.editor@hok.test"]));
  const rohan = people.find((p) => p.email === "rohan.smm@hok.test")?.id;
  const meera = people.find((p) => p.email === "meera.editor@hok.test")?.id;
  const [client] = await db
    .select({ id: clients.id, name: clients.businessName, timeZone: clients.timeZone, ownerId: clients.ownerId })
    .from(clients)
    .where(eq(clients.businessName, "Chai Point Cafe"))
    .limit(1);
  if (!rohan || !meera || !client) return;
  const today = Math.floor(Date.now() / DAY) * DAY;

  // -- the event waiting for the client --
  const eventTemplate = templates.get("Shoot with client sign-off");
  const eventTitle = `${client.name}: Sign-off shoot`;
  const [existingEvent] = await db.select({ id: events.id }).from(events).where(and(eq(events.clientId, client.id), eq(events.title, eventTitle))).limit(1);
  if (eventTemplate && !existingEvent) {
    const stages = await templateStages(eventTemplate.id);
    const target = stages.findIndex((s) => s.approvers.includes("client"));
    const startsAt = new Date(today + 3 * DAY + 10 * 3600_000);
    await db.transaction(async (tx) => {
      const [event] = await tx
        .insert(events)
        .values({
          clientId: client.id,
          title: eventTitle,
          type: "shoot",
          startsAt,
          endsAt: new Date(startsAt.getTime() + 4 * 3600_000),
          timeZone: client.timeZone,
          location: "Client premises",
          templateId: eventTemplate.id,
          templateName: "Shoot with client sign-off",
          stageCount: stages.length,
          state: "active",
          createdBy: client.ownerId,
        })
        .returning({ id: events.id });
      const rows = await tx
        .insert(eventStages)
        .values(stages.map((st, pos) => ({ eventId: event!.id, position: pos + 1, name: st.name, approvers: st.approvers })))
        .returning({ id: eventStages.id, position: eventStages.position });
      rows.sort((a, b) => a.position - b.position);
      await tx.update(events).set({ currentStageId: rows[target]!.id }).where(eq(events.id, event!.id));
      const base = Date.now() - (target + 1) * 60_000;
      await tx.insert(eventStageHistory).values([
        { eventId: event!.id, fromStageId: null, toStageId: rows[0]!.id, changedBy: client.ownerId, createdAt: new Date(base) },
        ...rows.slice(1, target + 1).map((st, k) => ({ eventId: event!.id, fromStageId: rows[k]!.id, toStageId: st.id, changedBy: client.ownerId, createdAt: new Date(base + (k + 1) * 60_000) })),
      ]);
      await tx.insert(stageApprovals).values({
        eventId: event!.id,
        eventStageId: rows[target]!.id,
        requestNote: "The final edit is ready for your sign-off.",
        requestLink: "https://drive.google.com/drive/folders/hok-seed-signoff",
        requestedBy: client.ownerId,
      });
    });
    logger.info({ title: eventTitle }, "seed: event waiting for the client's approval created");
  }

  // -- the task waiting for an SMM or the Admin --
  const taskTemplate = templates.get("Reel edit (approvals)");
  const taskTitle = "Cut the festive reel (needs approval)";
  const [existingTask] = await db.select({ id: staffTasks.id }).from(staffTasks).where(and(eq(staffTasks.assigneeId, meera), eq(staffTasks.title, taskTitle))).limit(1);
  if (taskTemplate && !existingTask) {
    const stages = await templateStages(taskTemplate.id);
    const target = stages.findIndex((s) => s.approvers.length > 0);
    const stageIds = stages.map(() => randomUUID());
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(staffTasks)
        .values({
          title: taskTitle,
          description: "Festive reel for Chai Point Cafe: ready for a look before delivery.",
          assigneeId: meera,
          assignedBy: rohan,
          clientId: client.id,
          dueAt: new Date(today + 5 * DAY + 18 * 3600_000),
          priority: "high",
          status: "in_progress",
          templateId: taskTemplate.id,
          templateName: "Reel edit (approvals)",
          stageCount: stages.length,
          currentStageId: stageIds[target],
          version: 1 + target,
        })
        .returning({ id: staffTasks.id });
      const taskId = row!.id;
      await tx.insert(taskStages).values(stages.map((st, i) => ({ id: stageIds[i]!, taskId, position: i + 1, name: st.name, approvers: st.approvers })));
      const at = (i: number) => new Date(Date.now() - (target + 2 - i) * 60_000);
      await tx.insert(staffTaskUpdates).values([
        { taskId, authorId: rohan, kind: "created" as const, toStatus: "todo" as const, toAssigneeId: meera, toStageId: stageIds[0]!, createdAt: at(0) },
        ...stageIds.slice(1, target + 1).map((id, k) => ({
          taskId,
          authorId: meera,
          kind: "stage" as const,
          fromStatus: k === 0 ? ("todo" as const) : ("in_progress" as const),
          toStatus: "in_progress" as const,
          fromStageId: stageIds[k]!,
          toStageId: id,
          createdAt: at(k + 1),
        })),
      ]);
      await tx.insert(stageApprovals).values({
        taskId,
        taskStageId: stageIds[target]!,
        requestNote: "Ready for your look.",
        requestLink: "https://drive.google.com/drive/folders/hok-seed-reel-final",
        requestedBy: meera,
      });
    });
    logger.info({ title: taskTitle }, "seed: task waiting for approval created");
  }
}

async function seedPersonalEvents(): Promise<void> {
  const managers = await db
    .select({ id: profiles.id, email: profiles.email, timeZone: profiles.timeZone })
    .from(profiles)
    .where(inArray(profiles.email, ["admin@hok.test", "rohan.smm@hok.test", "sara.smm@hok.test", "vikram.mm@hok.test"]));
  const today = Math.floor(Date.now() / (24 * 3600_000)) * 24 * 3600_000;
  for (const m of managers) {
    const [ownClient] = await db.select({ id: clients.id, name: clients.businessName }).from(clients).where(eq(clients.ownerId, m.id)).limit(1);
    const plan = [
      { title: "Weekly planning", dayOffset: 2, hour: 9, minutes: 60, clientId: null as string | null },
      { title: ownClient ? `Prep call notes: ${ownClient.name}` : "Content review", dayOffset: 5, hour: 13, minutes: 30, clientId: ownClient?.id ?? null },
    ];
    for (const p of plan) {
      const [existing] = await db
        .select({ id: personalEvents.id })
        .from(personalEvents)
        .where(and(eq(personalEvents.ownerId, m.id), eq(personalEvents.title, p.title)))
        .limit(1);
      if (existing) continue;
      const startsAt = new Date(today + p.dayOffset * 24 * 3600_000 + p.hour * 3600_000);
      await db.insert(personalEvents).values({
        ownerId: m.id,
        clientId: p.clientId,
        title: p.title,
        startsAt,
        endsAt: new Date(startsAt.getTime() + p.minutes * 60_000),
        timeZone: m.timeZone,
        description: p.clientId ? "Private note: questions for the next client call." : null,
      });
      logger.info({ owner: m.email, title: p.title }, "seed: personal event created");
    }
  }
}

// -- My to-dos (round 1) ---------------------------------------------------------------

interface SeedTodo {
  title: string;
  notes?: string;
  urgency: TodoUrgency;
  /** Day of the current month (UTC) and hour (UTC). */
  day: number;
  hour: number;
  done?: boolean;
}

/** Three private to-dos per person, mixed urgencies, due in the current month. Reused by (owner, title). */
const TODO_PLAN: SeedTodo[] = [
  { title: "Review this week's priorities", urgency: "urgent", day: 3, hour: 9 },
  { title: "Reply to pending messages", notes: "Anything older than two days first.", urgency: "high", day: 12, hour: 15 },
  { title: "Tidy up shared folders", urgency: "low", day: 24, hour: 17 },
];

async function seedTodos(): Promise<void> {
  const probe = await db.execute(sql`select to_regclass('public.todos') is not null as ok`);
  if ((probe.rows[0] as { ok: boolean } | undefined)?.ok !== true) {
    logger.warn("seed: todos table missing (migration 20261102000001 not applied yet) -- to-dos skipped");
    return;
  }
  const people = await db.select({ id: profiles.id, email: profiles.email }).from(profiles).where(inArray(profiles.email, STAFF.map((p) => p.email)));
  const now = new Date();
  for (const [i, person] of people.entries()) {
    for (const [j, t] of TODO_PLAN.entries()) {
      // Spread the dates a little so the calendar isn't one column of everyone's to-dos.
      const day = Math.min(28, t.day + ((i + j) % 4));
      const dueAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, t.hour));
      const title = j === 2 && i % 2 === 1 ? "Draft ideas for next month" : t.title;
      const [existing] = await db.select({ id: todos.id }).from(todos).where(and(eq(todos.ownerId, person.id), eq(todos.title, title))).limit(1);
      if (existing) continue;
      const done = j === 2 && i % 3 === 0;
      await db.insert(todos).values({
        ownerId: person.id,
        title,
        notes: t.notes ?? null,
        dueAt,
        urgency: t.urgency,
        doneAt: done ? now : null,
        nextRemindAt: done ? null : nextTodoReminder(dueAt, t.urgency, now),
      });
      logger.info({ owner: person.email, title }, "seed: to-do created");
    }
  }
}

async function main(): Promise<void> {
  // The seed password is public (it is in this repo), so never seed a database off this machine.
  const host = new URL(env.DATABASE_URL).hostname;
  if (env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    throw new Error(`seed refuses to run against ${host} (NODE_ENV=${env.NODE_ENV}); it is for the local database only`);
  }
  await seedStaff();
  await seedClients();
  const [adminRow] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, "admin@hok.test")).limit(1);
  const templates = await seedTemplates(adminRow?.id);
  await seedEvents(templates);
  await seedPersonalEvents();
  await seedAssets();
  await seedStaffTasks(adminRow?.id, templates);
  await seedApprovals(templates);
  await seedTodos();
  logger.info(`seed: done. Every seeded account uses the password ${SEED_PASSWORD}`);
}

main()
  .then(() => db.$client.end())
  .catch(async (err: unknown) => {
    logger.error({ err }, "seed failed");
    await db.$client.end();
    process.exit(1);
  });
