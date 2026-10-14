import type { EventDetail, EventSummaryEntity } from "../domain/event.entity";

/**
 * Entities -> response DTOs. The shapes match today (documented in
 * openapi.yaml as `EventDetail` / `EventSummary`); kept explicit so a
 * portal-safe view (M8: no description, team or internal notes) can diverge.
 */
export type EventDetailResponseDto = EventDetail;
export type EventSummaryResponseDto = EventSummaryEntity;

export function toEventDetailResponseDto(e: EventDetail): EventDetailResponseDto {
  return { ...e, stages: [...e.stages], history: [...e.history], team: [...e.team], assignedTeam: [...e.assignedTeam] };
}

export function toEventSummaryResponseDto(e: EventSummaryEntity): EventSummaryResponseDto {
  return { ...e };
}
