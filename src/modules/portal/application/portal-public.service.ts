import { NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import type { PortalContext } from "../../../common/database/portal-links";
import { PORTAL_RECENT_LIMIT, PORTAL_UPCOMING_LIMIT, type PortalDashboard, type PortalEvent, type PortalEventDetail } from "../domain/portal.entity";
import { assertPortalRange, pickCurrent } from "../domain/portal.rules";
import type { PortalReadRepositoryPort } from "./ports/portal-repositories.port";

/** Most events one portal calendar range returns. */
export const PORTAL_RANGE_LIMIT = 200;

/**
 * The client's read-only view (FR-POR-04..07). Every read is pinned to the
 * client the link opens (`ctx.clientId`), and every shape is client-safe
 * (see domain/portal.entity.ts): no internal notes, assets, tasks, team or
 * staff data beyond the manager's first name.
 */
export class PortalPublicService {
  constructor(
    private readonly repo: PortalReadRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async dashboard(ctx: PortalContext): Promise<PortalDashboard> {
    const now = this.now();
    const [upcoming, recent] = await Promise.all([
      this.repo.upcoming(ctx.clientId, now, PORTAL_UPCOMING_LIMIT),
      this.repo.recent(ctx.clientId, now, PORTAL_RECENT_LIMIT),
    ]);
    return {
      client: { businessName: ctx.businessName, logoUrl: ctx.logoUrl, timeZone: ctx.timeZone },
      manager: { firstName: ctx.ownerFirstName },
      current: pickCurrent(upcoming),
      upcoming,
      recent,
    };
  }

  /** FR-POR-05: the read-only calendar; the web shows it in the client's zone. */
  async calendar(ctx: PortalContext, from: string, to: string): Promise<{ from: string; to: string; timeZone: string; events: PortalEvent[] }> {
    assertPortalRange(from, to);
    return { from, to, timeZone: ctx.timeZone, events: await this.repo.inRange(ctx.clientId, from, to, PORTAL_RANGE_LIMIT) };
  }

  /** Another client's event (or a made-up id) is a 404 -- the query is pinned to this client. */
  async event(ctx: PortalContext, eventId: string): Promise<PortalEventDetail> {
    const event = await this.repo.event(ctx.clientId, eventId);
    if (!event) throw new NotFoundError("Event not found", ERROR_CODES.PORTAL_EVENT_NOT_FOUND);
    return event;
  }
}
