import type { CalendarItem } from "./calendar.entity";

const DAY_MS = 24 * 60 * 60 * 1000;

/** What a subscribed calendar shows: the last 30 days and the next 180. */
export const FEED_PAST_DAYS = 30;
export const FEED_FUTURE_DAYS = 180;

export function feedWindow(now: Date): { from: string; to: string } {
  return {
    from: new Date(now.getTime() - FEED_PAST_DAYS * DAY_MS).toISOString(),
    to: new Date(now.getTime() + FEED_FUTURE_DAYS * DAY_MS).toISOString(),
  };
}

/** The feed's file name in the URL: `<token>.ics` (calendar apps like the extension). Same token shape as portal links. */
const FEED_FILE = /^([A-Za-z0-9_-]{43})\.ics$/;
export function feedTokenFrom(file: string): string | null {
  return FEED_FILE.exec(file)?.[1] ?? null;
}

const TYPE_WORDS: Record<string, string> = { shoot: "Shoot", campaign: "Campaign", meeting: "Meeting", content_posting: "Content posting", other: "Other" };

/** RFC 5545 text: backslash, semicolon, comma and newlines escaped. */
function text(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 2026-10-21T09:30:00.000Z → 20261021T093000Z */
function utc(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Lines longer than 75 bytes continue on the next line after a space (RFC 5545 §3.1), never splitting a character. */
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

/**
 * The subscribe feed (FR-CAL-08) as an iCalendar file. Times are UTC: every
 * calendar app shows them in its own zone. Client events link back to their
 * page in HOK; cancelled ones say so, postponed ones are marked tentative.
 */
export function toIcs(items: readonly CalendarItem[], opts: { calendarName: string; webAppUrl: string; now: Date }): string {
  const stamp = utc(opts.now.toISOString());
  const web = opts.webAppUrl.replace(/\/+$/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HOK//Calendar feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${text(opts.calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const item of items) {
    lines.push("BEGIN:VEVENT", `UID:${item.kind}-${item.id}@hok`, `DTSTAMP:${stamp}`, `DTSTART:${utc(item.startsAt)}`, `DTEND:${utc(item.endsAt)}`);
    if (item.kind === "event") {
      lines.push(
        `SUMMARY:${text(`${item.title} · ${item.clientName}`)}`,
        `DESCRIPTION:${text(`Client: ${item.clientName}\nType: ${TYPE_WORDS[item.eventType] ?? item.eventType}\nStage: ${item.currentStageName} (${item.currentStagePosition} of ${item.stageCount})`)}`,
        `STATUS:${item.state === "cancelled" ? "CANCELLED" : item.state === "postponed" ? "TENTATIVE" : "CONFIRMED"}`,
        `URL:${web}/app/events/${item.id}`,
      );
    } else {
      lines.push(`SUMMARY:${text(item.title)}`);
      if (item.clientName) lines.push(`DESCRIPTION:${text(`Client: ${item.clientName}`)}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
