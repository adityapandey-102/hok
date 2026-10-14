import { and, asc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { containsPattern } from "../../../common/database/like-pattern";
import { isUniqueViolation } from "../../../common/database/pg-errors";
import { AppError, ConflictError, InternalError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { stageTemplateStages, stageTemplates } from "./stage-templates.schema";
import type { StageTemplateEntity, TemplateStage } from "../domain/stage-template.entity";
import type {
  StageTemplateDecision,
  StageTemplateListFilters,
  StageTemplatePage,
  StageTemplatesRepositoryPort,
} from "../application/ports/stage-templates-repository.port";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
type TemplateRow = typeof stageTemplates.$inferSelect;

/** Turns the unique-name index into a 409; rethrows deliberate AppErrors; wraps the rest as a 500. */
async function guarded<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isUniqueViolation(error, "stage_templates_name_key")) {
      throw new ConflictError("A stage template with this name already exists", ERROR_CODES.STAGE_TEMPLATE_NAME_TAKEN);
    }
    throw new InternalError(`Failed to ${what}`, error);
  }
}

/** The stages of several templates in ONE query, grouped by template id, in order. */
async function stagesFor(ex: Executor, templateIds: string[]): Promise<Map<string, TemplateStage[]>> {
  const byTemplate = new Map<string, TemplateStage[]>(templateIds.map((id) => [id, []]));
  if (templateIds.length === 0) return byTemplate;
  const rows = await ex
    .select()
    .from(stageTemplateStages)
    .where(inArray(stageTemplateStages.templateId, templateIds))
    .orderBy(asc(stageTemplateStages.templateId), asc(stageTemplateStages.position));
  for (const r of rows) byTemplate.get(r.templateId)?.push({ id: r.id, position: r.position, name: r.name });
  return byTemplate;
}

function toEntity(row: TemplateRow, stages: TemplateStage[]): StageTemplateEntity {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    stages,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function selectTemplate(ex: Executor, id: string, forUpdate = false): Promise<StageTemplateEntity | null> {
  const query = ex.select().from(stageTemplates).where(eq(stageTemplates.id, id)).limit(1);
  const [row] = forUpdate ? await query.for("update") : await query;
  if (!row) return null;
  return toEntity(row, (await stagesFor(ex, [id])).get(id) ?? []);
}

async function insertStages(ex: Executor, templateId: string, names: string[]): Promise<void> {
  await ex.insert(stageTemplateStages).values(names.map((name, i) => ({ templateId, position: i + 1, name })));
}

/** Templates are few (tens), so each list is one page query + one count + one batched stages query. */
export class DrizzleStageTemplatesRepository implements StageTemplatesRepositoryPort {
  private conditions(filters: StageTemplateListFilters): SQL | undefined {
    const c: SQL[] = [];
    if (filters.active !== undefined) c.push(eq(stageTemplates.active, filters.active));
    if (filters.search) c.push(ilike(stageTemplates.name, containsPattern(filters.search)));
    return c.length ? and(...c) : undefined;
  }

  findMany(filters: StageTemplateListFilters, page: StageTemplatePage) {
    return guarded("load stage templates", async () => {
      const rows = await db
        .select()
        .from(stageTemplates)
        .where(this.conditions(filters))
        .orderBy(sql`lower(${stageTemplates.name})`, asc(stageTemplates.id))
        .limit(page.limit)
        .offset(page.offset);
      const stages = await stagesFor(db, rows.map((r) => r.id));
      return rows.map((r) => toEntity(r, stages.get(r.id) ?? []));
    });
  }

  countMany(filters: StageTemplateListFilters) {
    return guarded("count stage templates", async () => {
      const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(stageTemplates).where(this.conditions(filters));
      return row?.count ?? 0;
    });
  }

  findById(id: string) {
    return guarded("load the stage template", () => selectTemplate(db, id));
  }

  create(record: { name: string; stages: string[]; createdBy: string }) {
    return guarded("create the stage template", async () => {
      const id = await db.transaction(async (tx) => {
        const [row] = await tx.insert(stageTemplates).values({ name: record.name, createdBy: record.createdBy }).returning({ id: stageTemplates.id });
        await insertStages(tx, row!.id, record.stages);
        return row!.id;
      });
      return (await selectTemplate(db, id))!;
    });
  }

  update(id: string, decide: StageTemplateDecision) {
    return guarded("update the stage template", async () => {
      await db.transaction(async (tx) => {
        const current = await selectTemplate(tx, id, true);
        if (!current) throw new NotFoundError("Stage template not found", ERROR_CODES.STAGE_TEMPLATE_NOT_FOUND);
        const changes = decide(current);
        if (changes.name === undefined && changes.stages === undefined && changes.active === undefined) return;

        await tx
          .update(stageTemplates)
          .set({
            ...(changes.name !== undefined ? { name: changes.name } : {}),
            ...(changes.active !== undefined ? { active: changes.active } : {}),
            version: sql`${stageTemplates.version} + 1`,
          })
          .where(eq(stageTemplates.id, id));
        if (changes.stages !== undefined) {
          // Replace the ordered list: nothing references these rows (events copy them).
          await tx.delete(stageTemplateStages).where(eq(stageTemplateStages.templateId, id));
          await insertStages(tx, id, changes.stages);
        }
      });
      return (await selectTemplate(db, id))!;
    });
  }
}
