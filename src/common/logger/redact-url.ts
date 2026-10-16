/**
 * The client-portal token travels in the URL path (/api/v1/portal/<token>/...),
 * so it would land in every access-log line. It's a bearer credential: never
 * log it. Replaces the path segment after /portal/ with "[redacted]".
 */
const PORTAL_TOKEN = /(\/portal\/)[^/?#]+/;

export function redactUrl(url: string | undefined): string | undefined {
  return url?.replace(PORTAL_TOKEN, "$1[redacted]");
}
