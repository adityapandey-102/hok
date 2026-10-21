import { describe, expect, it } from "vitest";
import { feedUrl, googleSubscribeUrl, isLocalAddress } from "./calendarApi";

describe("calendar subscribe link helpers", () => {
  const token = "a".repeat(43);

  it("builds the public .ics address on the API", () => {
    expect(feedUrl(token, "https://api.hok.example/api/v1/")).toBe(`https://api.hok.example/api/v1/calendar-feed/${token}.ics`);
  });

  it("hands Google the webcal:// form, encoded", () => {
    expect(googleSubscribeUrl(`https://api.hok.example/api/v1/calendar-feed/${token}.ics`)).toBe(
      `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://api.hok.example/api/v1/calendar-feed/${token}.ics`)}`,
    );
  });

  it("knows a local address can't be reached by Google", () => {
    expect(isLocalAddress("http://localhost:4100/api/v1/calendar-feed/x.ics")).toBe(true);
    expect(isLocalAddress("http://127.0.0.1:4100/x")).toBe(true);
    expect(isLocalAddress("https://api.hok.example/x")).toBe(false);
  });
});
