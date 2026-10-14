/**
 * Local-dev seed data. M0: one staff account per role, so every role can be
 * tried as soon as login lands (M2). M3: clients spread across the managers
 * and the Admin (one paused, one archived). M4: three stage templates and
 * three events per client (past, current, upcoming) in each client's time
 * zone. Later milestones add assets, tasks and comments here.
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
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../common/database/drizzle-client";
import { authProvider } from "../common/auth/supabase-auth-provider";
import { logger } from "../common/logger/logger";
import { profiles } from "../modules/users/infrastructure/profile.schema";
import { clients } from "../modules/clients/infrastructure/clients.schema";
import type { ClientStatus, SocialHandles } from "../modules/clients/domain/client.entity";
import { stageTemplateStages, stageTemplates } from "../modules/stage-templates/infrastructure/stage-templates.schema";
import { eventStageHistory, eventStages, events } from "../modules/events/infrastructure/events.schema";
import type { EventState, EventType } from "../modules/events/domain/event.entity";
import type { Role } from "../domain";

export const SEED_PASSWORD = "Hok@2026";

const STAFF: { fullName: string; email: string; role: Role; timeZone: string }[] = [
  { fullName: "Aisha Khan", email: "admin@hok.test", role: "admin", timeZone: "Asia/Kolkata" },
  { fullName: "Rohan Mehta", email: "rohan.smm@hok.test", role: "social_media_manager", timeZone: "Asia/Kolkata" },
  { fullName: "Sara Ali", email: "sara.smm@hok.test", role: "social_media_manager", timeZone: "Asia/Dubai" },
  { fullName: "Vikram Rao", email: "vikram.mm@hok.test", role: "marketing_manager", timeZone: "Europe/London" },
  { fullName: "Neha Joshi", email: "neha.agent@hok.test", role: "marketing_agent", timeZone: "Asia/Kolkata" },
  { fullName: "Arjun Das", email: "arjun.dev@hok.test", role: "developer", timeZone: "Asia/Kolkata" },
  { fullName: "Meera Nair", email: "meera.editor@hok.test", role: "editor", timeZone: "Asia/Kolkata" },
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
  socialHandles: SocialHandles;
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
    await db.insert(clients).values({
      ...client,
      ownerId,
      notes: client.notes ?? null,
      archivedAt: client.status === "archived" ? new Date() : null,
    });
    logger.info({ businessName: client.businessName, ownerEmail, status: client.status }, "seed: client created");
  }
}

const TEMPLATES: { name: string; stages: string[] }[] = [
  { name: "Photo Shoot", stages: ["Planned", "Pre-production", "Shoot", "Editing", "Client Review", "Completed"] },
  { name: "Reel Production", stages: ["Brief", "Script", "Shoot", "Edit", "Client Review", "Published"] },
  { name: "Campaign Launch", stages: ["Strategy", "Creatives", "Approval", "Live", "Report"] },
];

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
      const [row] = await tx.insert(stageTemplates).values({ name: t.name, createdBy: adminId ?? null }).returning({ id: stageTemplates.id });
      await tx.insert(stageTemplateStages).values(t.stages.map((name, i) => ({ templateId: row!.id, position: i + 1, name })));
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
      if (existing) continue;
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
        await tx.insert(eventStageHistory).values([
          { eventId: event!.id, fromStageId: null, toStageId: stages[0]!.id, changedBy: client.ownerId },
          ...stages.slice(1, target + 1).map((st, k) => ({
            eventId: event!.id,
            fromStageId: stages[k]!.id,
            toStageId: st.id,
            note: k === target - 1 ? "Moving along nicely." : null,
            visibleToClient: k === target - 1,
            changedBy: client.ownerId,
          })),
        ]);
      });
      logger.info({ title, timeZone: client.timeZone }, "seed: event created");
    }
  }
}

async function main(): Promise<void> {
  await seedStaff();
  await seedClients();
  const [adminRow] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, "admin@hok.test")).limit(1);
  await seedEvents(await seedTemplates(adminRow?.id));
  logger.info(`seed: done. Every seeded account uses the password ${SEED_PASSWORD}`);
}

main()
  .then(() => db.$client.end())
  .catch(async (err: unknown) => {
    logger.error({ err }, "seed failed");
    await db.$client.end();
    process.exit(1);
  });
