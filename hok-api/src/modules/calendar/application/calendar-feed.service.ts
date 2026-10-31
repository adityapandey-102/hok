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
import { FEED_PAST_MAX_PER_KIND, feedTokenFrom, feedUrl, feedWindows, toIcs } from "../domain/calendar-feed.rules";
import type { CalendarItem } from "../domain/calendar.entity";
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
    private readonly publicApiUrl: string = env.PUBLIC_API_URL,
  ) {}

  get(userId: string): Promise<FeedLink> {
    return this.links.feedLink(userId);
  }

  /** Returns the full subscribe address (built here, from this API's public URL) so every app gets the same working link. */
  async create(userId: string): Promise<{ link: NonNullable<FeedLink>; token: string; url: string }> {
    const token = generateOpaqueToken();
    const link = await this.links.setFeedLink(userId, hashToken(token));
    // Nothing saved (the profile row is gone): never hand out a token that can't work.
    if (!link) throw new NotFoundError("Your account wasn't found", ERROR_CODES.USER_NOT_FOUND);
    await this.audit.record({ action: AUDIT_ACTIONS.CALENDAR_FEED_CREATED, entityType: AUDIT_ENTITIES.USER, entityId: userId });
    return { link, token, url: feedUrl(this.publicApiUrl, token) };
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
    const { past, upcoming } = feedWindows(now);
    const none = Promise.resolve([] as CalendarItem[]);
    // Upcoming and past are read separately so a busy past month never pushes next month out (4 queries, fixed).
    // shortcut: the earliest 100 of the past 30 days + the next 500 of each kind; enough for a firm this size, page it if the Admin's feed ever fills up.
    const reads = await Promise.all([
      this.calendar.eventsInRange(upcoming, scope.events, CALENDAR_MAX_ITEMS_PER_KIND),
      scope.personal ? this.calendar.personalInRange(upcoming, scope.personal, CALENDAR_MAX_ITEMS_PER_KIND) : none,
      this.calendar.eventsInRange(past, scope.events, FEED_PAST_MAX_PER_KIND),
      scope.personal ? this.calendar.personalInRange(past, scope.personal, FEED_PAST_MAX_PER_KIND) : none,
    ]);
    // An item happening "now" is in both windows: keep it once.
    const unique = new Map<string, CalendarItem>();
    for (const item of reads.flat()) unique.set(`${item.kind}:${item.id}`, item);
    return toIcs(mergeByStart([...unique.values()], []), { calendarName: `HOK · ${owner.fullName}`, webAppUrl: this.webAppUrl, now });
  }
}
