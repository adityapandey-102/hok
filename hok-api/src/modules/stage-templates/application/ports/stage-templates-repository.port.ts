import type { StageTemplateEntity } from "../../domain/stage-template.entity";

export interface StageTemplateListFilters {
  search?: string;
  active?: boolean;
}

export interface StageTemplatePage {
  limit: number;
  offset: number;
}

export interface StageTemplateChanges {
  name?: string;
  /** Replaces the whole ordered list. */
  stages?: string[];
  active?: boolean;
}

/** Guard callback: given the locked template, throw or return the changes (empty = write nothing). */
export type StageTemplateDecision = (current: StageTemplateEntity) => StageTemplateChanges;

/** Persistence contract for stage templates -- data access only. Name clashes surface as 409 STAGE_TEMPLATE_NAME_TAKEN. */
export interface StageTemplatesRepositoryPort {
  /** One page of templates WITH their stages (stages loaded in one batched query, never per template). */
  findMany(filters: StageTemplateListFilters, page: StageTemplatePage): Promise<StageTemplateEntity[]>;
  countMany(filters: StageTemplateListFilters): Promise<number>;
  findById(id: string): Promise<StageTemplateEntity | null>;
  create(record: { name: string; stages: string[]; createdBy: string }): Promise<StageTemplateEntity>;
  /** Locks the template (FOR UPDATE), applies `decide`'s changes and bumps the version, in one transaction. 404 if missing. */
  update(id: string, decide: StageTemplateDecision): Promise<StageTemplateEntity>;
}
