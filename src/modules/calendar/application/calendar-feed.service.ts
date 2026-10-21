import { env } from "../../../config/env";
import { NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { generateOpaqueToken, hashToken } from "../../../common/crypto/credentials";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import { hasCapability } from "../../../domain";
import { CALENDAR_MAX_ITEMS_PER_KIND } from "../domain/calendar.entity";
import { mergeByStart, resolveCalendarScope } from "../domain/calendar.rules";
import { feedTokenFrom, feedWindow, toIcs } from "../domain/calendar-feed.rules";
import type { CalendarFeedRepositoryPort, CalendarRepositoryPort } from "./ports/calendar-repository.port";

export type FeedLink = { createdAt: string } | null;

/**
 * The calendar subscribe link (FR-CAL-08): each person with a calendar can
 * make one secret link to add their HOK calendar to Google Calendar, Apple or
 * Outlook. It shows the same items as their calendar in HOK (a manager: their
 * clients' events + own entries; the Admin: every client event + own
 * entries). The token is returned ONCE; only its SHA-256 is stored. A new
 * link replaces the old one, which stops working at once.
 */
export class CalendarFeedService {
  constructor(
    private readonly links: CalendarFeedRepositoryPort,
    private readonly calendar: CalendarRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
    private readonly webAppUrl: string = env.WEB_APP_URL,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get(userId: string): Promise<FeedLink> {
    return this.links.feedLink(userId);
  }

  async create(userId: string): Promise<{ link: FeedLink; token: string }> {
    const token = generateOpaqueToken();
    const link = await this.links.setFeedLink(userId, hashToken(token));
    await this.audit.record({ action: AUDIT_ACTIONS.CALENDAR_FEED_CREATED, entityType: AUDIT_ENTITIES.USER, entityId: userId });
    return { link, token };
  }

  /** Idempotent: turning off a link that isn't there is fine. */
  async revoke(userId: string): Promise<void> {
    if (!(await this.links.feedLink(userId))) return;
    await this.links.setFeedLink(userId, null);
    await this.audit.record({ action: AUDIT_ACTIONS.CALENDAR_FEED_REVOKED, entityType: AUDIT_ENTITIES.USER, entityId: userId });
  }

  /** Public: `<token>.ics` → the iCalendar file. Every bad link is the same 404, so nothing can be learned by probing. */
  async ics(file: string): Promise<string> {
    const token = feedTokenFrom(file);
    const owner = token ? await this.links.findFeedOwner(hashToken(token)) : null;
    // A person whose role lost the calendar keeps the hash but gets nothing.
    if (!owner || !hasCapability(owner.role, "events:read")) {
      throw new NotFoundError("This calendar link isn't valid any more. Make a new one in HOK.", ERROR_CODES.CALENDAR_FEED_INVALID);
    }
    const scope = resolveCalendarScope({ userId: owner.userId, role: owner.role }, undefined);
    const now = this.now();
    const range = feedWindow(now);
    // shortcut: earliest 500 of each kind in the window; enough for a firm this size, page it if the Admin's feed ever fills up.
    const [events, personal] = await Promise.all([
      this.calendar.eventsInRange(range, scope.events, CALENDAR_MAX_ITEMS_PER_KIND),
      scope.personal ? this.calendar.personalInRange(range, scope.personal, CALENDAR_MAX_ITEMS_PER_KIND) : Promise.resolve([]),
    ]);
    return toIcs(mergeByStart(events, personal), { calendarName: `HOK · ${owner.fullName}`, webAppUrl: this.webAppUrl, now });
  }
}
