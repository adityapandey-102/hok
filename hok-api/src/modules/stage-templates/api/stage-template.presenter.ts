import type { StageTemplateEntity } from "../domain/stage-template.entity";

/** Wire shape of a template (GET/POST/PATCH /stage-templates). */
export interface StageTemplateResponseDto {
  id: string;
  name: string;
  active: boolean;
  stages: { id: string; position: number; name: string }[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Entity -> response DTO. Identical today; explicit so the two can diverge. */
export function toStageTemplateResponseDto(t: StageTemplateEntity): StageTemplateResponseDto {
  return {
    id: t.id,
    name: t.name,
    active: t.active,
    stages: t.stages.map((s) => ({ id: s.id, position: s.position, name: s.name })),
    version: t.version,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
