import type { EventDetail, EventSummaryEntity } from "../domain/event.entity";

/**
 * Entities -> response DTOs. The shapes match today (documented in
 * openapi.yaml as `EventDetail` / `EventSummary`); kept explicit so a
 * portal-safe view (M8: no description, team or internal notes) can diverge.
 */
/** `teamIds` (the client's team, for the scope check) stays on the server. */
export type EventDetailResponseDto = Omit<EventDetail, "teamIds">;
export type EventSummaryResponseDto = EventSummaryEntity;

export function toEventDetailResponseDto(e: EventDetail): EventDetailResponseDto {
  const { teamIds: _internal, ...rest } = e;
  return { ...rest, stages: [...e.stages], history: [...e.history], team: [...e.team], assignedTeam: [...e.assignedTeam] };
}

export function toEventSummaryResponseDto(e: EventSummaryEntity): EventSummaryResponseDto {
  return { ...e };
}
