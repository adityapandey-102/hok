import { describe, expect, it } from "vitest";
import { portalAssetIcon, portalAssetLabel } from "./portalAssets";
import { formatLongDate } from "./portalFormat";

describe("shared links in the portal", () => {
  it("names and draws each known type", () => {
    expect(portalAssetLabel("video")).toBe("Video");
    expect(portalAssetIcon("photo")).toBe("image");
  });
  it("falls back for an unknown type", () => {
    expect(portalAssetLabel("hologram")).toBe("Link");
    expect(portalAssetIcon("hologram")).toBe("external-link");
  });
  it("writes the date in the client's zone", () => {
    expect(formatLongDate("2026-11-20T20:00:00Z", "Asia/Kolkata")).toBe("21 Nov 2026");
    expect(formatLongDate("2026-11-20T20:00:00Z", "UTC")).toBe("20 Nov 2026");
  });
});
