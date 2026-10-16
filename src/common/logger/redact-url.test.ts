import { describe, expect, it } from "vitest";
import { redactUrl } from "./redact-url";

describe("redactUrl", () => {
  it("hides the portal token, keeping the rest of the path and the query", () => {
    expect(redactUrl("/api/v1/portal/AbC_123-xyz/comments?limit=5")).toBe("/api/v1/portal/[redacted]/comments?limit=5");
    expect(redactUrl("/api/v1/portal/AbC_123-xyz")).toBe("/api/v1/portal/[redacted]");
  });

  it("leaves other URLs alone (the staff /portal-links route has no token)", () => {
    expect(redactUrl("/api/v1/events?from=x")).toBe("/api/v1/events?from=x");
    expect(redactUrl("/api/v1/portal-links/0b1c")).toBe("/api/v1/portal-links/0b1c");
    expect(redactUrl(undefined)).toBeUndefined();
  });
});
