/**
 * The client-portal token and the calendar subscribe token travel in the URL
 * path (/api/v1/portal/<token>/..., /api/v1/calendar-feed/<token>.ics), so
 * they would land in every access-log line. They're bearer credentials:
 * never log them. Replaces the path segment after /portal/ or
 * /calendar-feed/ with "[redacted]".
 */
const PORTAL_TOKEN = /(\/(?:portal|calendar-feed)\/)[^/?#]+/;

export function redactUrl(url: string | undefined): string | undefined {
  return url?.replace(PORTAL_TOKEN, "$1[redacted]");
}
