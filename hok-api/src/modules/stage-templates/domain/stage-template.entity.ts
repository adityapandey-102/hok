/** A template's stages, at most this many (FR-EVT-01). */
export const STAGES_MAX = 20;
export const STAGE_NAME_MAX_LENGTH = 60;
export const TEMPLATE_NAME_MAX_LENGTH = 80;

export interface TemplateStage {
  id: string;
  /** 1-based order. */
  position: number;
  name: string;
}

/** An Admin-made stage template (FR-EVT-01): a name and an ordered list of stages. */
export interface StageTemplateEntity {
  id: string;
  name: string;
  /** Inactive templates can't be picked for new events; existing events keep their copy. */
  active: boolean;
  stages: TemplateStage[];
  version: number;
  createdAt: string;
  updatedAt: string;
}
