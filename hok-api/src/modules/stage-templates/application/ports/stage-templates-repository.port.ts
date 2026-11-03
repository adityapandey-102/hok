import type { Role } from "../../../../domain";
import type { StageTemplateEntity, TemplateKind } from "../../domain/stage-template.entity";
import type { NormalizedStage } from "../../domain/stage-template.rules";

export interface StageTemplateListFilters {
  search?: string;
  active?: boolean;
  kind?: TemplateKind;
  /** Task templates offered for this assignee role (empty role list = any role). Implies kind "task". */
  role?: Role;
}

export interface StageTemplatePage {
  limit: number;
  offset: number;
}

export interface StageTemplateChanges {
  name?: string;
  /** Replaces the whole ordered list (names + approvers). */
  stages?: NormalizedStage[];
  active?: boolean;
  /** Replaces the role list (task templates). */
  roles?: Role[];
}

/** Guard callback: given the locked template, throw or return the changes (empty = write nothing). */
export type StageTemplateDecision = (current: StageTemplateEntity) => StageTemplateChanges;

/** Persistence contract for stage templates -- data access only. Name clashes surface as 409 STAGE_TEMPLATE_NAME_TAKEN. */
export interface StageTemplatesRepositoryPort {
  /** One page of templates WITH their stages (stages loaded in one batched query, never per template). */
  findMany(filters: StageTemplateListFilters, page: StageTemplatePage): Promise<StageTemplateEntity[]>;
  countMany(filters: StageTemplateListFilters): Promise<number>;
  findById(id: string): Promise<StageTemplateEntity | null>;
  create(record: { name: string; stages: NormalizedStage[]; kind: TemplateKind; roles: Role[]; createdBy: string }): Promise<StageTemplateEntity>;
  /** Locks the template (FOR UPDATE), applies `decide`'s changes and bumps the version, in one transaction. 404 if missing. */
  update(id: string, decide: StageTemplateDecision): Promise<StageTemplateEntity>;
}
