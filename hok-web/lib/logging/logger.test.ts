import { describe, expect, it } from "vitest";
import { describeFetchError } from "./logger";

describe("describeFetchError", () => {
  it("maps a browser 'Failed to fetch' to the unreachable-server message", () => {
    const r = describeFetchError(new TypeError("Failed to fetch"));
    expect(r.kind).toBe("network");
    expect(r.message).toMatch(/can't reach the server/i);
  });

  it("maps a Node ECONNREFUSED (via error.cause.code) to the same network message", () => {
    const err = new TypeError("fetch failed");
    (err as { cause?: unknown }).cause = { code: "ECONNREFUSED" };
    const r = describeFetchError(err);
    expect(r.kind).toBe("network");
    expect(r.message).toMatch(/can't reach the server/i);
  });

  it("maps an AbortError to the timeout message", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    const r = describeFetchError(err);
    expect(r.kind).toBe("timeout");
    expect(r.message).toMatch(/timed out/i);
  });

  it("falls back to a generic (still friendly) message for anything else", () => {
    const r = describeFetchError(new Error("weird"));
    expect(r.kind).toBe("network");
    expect(r.message).toMatch(/something went wrong/i);
  });
});
