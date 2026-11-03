import type { Role } from "../../../domain";
import type { StageTemplateEntity, TemplateKind } from "../domain/stage-template.entity";

/** Wire shape of a template (GET/POST/PATCH /stage-templates). */
export interface StageTemplateResponseDto {
  id: string;
  name: string;
  active: boolean;
  kind: TemplateKind;
  /** Task templates: the assignee roles it is offered for; empty = any role. */
  roles: Role[];
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
    kind: t.kind,
    roles: t.roles,
    stages: t.stages.map((s) => ({ id: s.id, position: s.position, name: s.name })),
    version: t.version,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
