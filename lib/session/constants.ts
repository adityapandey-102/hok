/** Cookie names shared by the client- and server-side session helpers. */
export const ACCESS_TOKEN_COOKIE = "hok_at"; // non-httpOnly: browser JS reads it to call hok-api directly
export const REFRESH_TOKEN_COOKIE = "hok_rt"; // httpOnly: server-only; JS can never read/write it (set via /api/session/* + proxy)

export const COOKIE_MAX_AGE_ACCESS = 60 * 60 * 24; // 1 day safety net; real expiry is read from the JWT itself
export const COOKIE_MAX_AGE_REFRESH = 60 * 60 * 24 * 30; // 30 days
export const DEVICE_COOKIE = "hok_dev"; // httpOnly: hok-api's trusted-device token for this browser (skips the per-email login limiter)
export const COOKIE_MAX_AGE_DEVICE = 60 * 60 * 24 * 90; // 90 days, the token's own lifetime
