import type { PortalDashboard, PortalEvent, PortalEventDetail, PortalLinkEntity } from "../domain/portal.entity";

/**
 * Client-safe presenters (ARCHITECTURE §7). Each one copies an explicit list
 * of fields -- never a spread -- so a column added to a query later can't
 * reach the portal by accident.
 */
export function toPortalEvent(e: PortalEvent): PortalEvent {
  return {
    id: e.id,
    title: e.title,
    type: e.type,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    timeZone: e.timeZone,
    location: e.location,
    state: e.state,
    stages: e.stages.map((s) => ({ position: s.position, name: s.name })),
    currentStagePosition: e.currentStagePosition,
    stageCount: e.stageCount,
  };
}

export function toPortalEventDetail(e: PortalEventDetail): PortalEventDetail {
  return { ...toPortalEvent(e), updates: e.updates.map((u) => ({ stageName: u.stageName, note: u.note, createdAt: u.createdAt })) };
}

export function toPortalDashboard(d: PortalDashboard): PortalDashboard {
  return {
    client: { businessName: d.client.businessName, logoUrl: d.client.logoUrl, timeZone: d.client.timeZone },
    manager: { firstName: d.manager.firstName },
    current: d.current ? toPortalEvent(d.current) : null,
    upcoming: d.upcoming.map(toPortalEvent),
    recent: d.recent.map(toPortalEvent),
  };
}

/** Staff view of a link (no token, no hash). */
export function toPortalLinkDto(l: PortalLinkEntity): PortalLinkEntity {
  return {
    id: l.id,
    clientId: l.clientId,
    active: l.active,
    createdAt: l.createdAt,
    createdByName: l.createdByName,
    revokedAt: l.revokedAt,
    lastUsedAt: l.lastUsedAt,
  };
}
