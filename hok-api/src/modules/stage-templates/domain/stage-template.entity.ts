import type { ApproverToken, Role } from "../../../domain";

/** What a template drives: the stages of a client event, or of a staff task (round 2). */
export const TEMPLATE_KINDS = ["event", "task"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

/** A template's stages, at most this many (FR-EVT-01). */
export const STAGES_MAX = 20;
export const STAGE_NAME_MAX_LENGTH = 60;
export const TEMPLATE_NAME_MAX_LENGTH = 80;

export interface TemplateStage {
  id: string;
  /** 1-based order. */
  position: number;
  name: string;
  /** Round 3: who can approve this stage (empty = no approval needed). Items copy it when created. */
  approvers: ApproverToken[];
}

/** An Admin-made stage template (FR-EVT-01): a name and an ordered list of stages, for events or for tasks. */
export interface StageTemplateEntity {
  id: string;
  name: string;
  /** Inactive templates can't be picked for new events; existing events keep their copy. */
  active: boolean;
  /** Fixed at creation. */
  kind: TemplateKind;
  /** Task templates only: the assignee roles it is offered for; empty = any role. Always [] for events. */
  roles: Role[];
  stages: TemplateStage[];
  version: number;
  createdAt: string;
  updatedAt: string;
}
