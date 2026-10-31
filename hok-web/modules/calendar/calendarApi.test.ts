import { describe, expect, it } from "vitest";
import { googleSubscribeUrl, isLocalAddress } from "./calendarApi";

describe("calendar subscribe link helpers", () => {
  const url = `https://api.hok.example/api/v1/calendar-feed/${"a".repeat(43)}.ics`;

  it("hands Google the https address as-is (no webcal://, which drops the scheme)", () => {
    expect(googleSubscribeUrl(url)).toBe(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(url)}`);
    expect(googleSubscribeUrl(url)).not.toContain("webcal");
  });

  it("spots every address the internet can't reach", () => {
    for (const local of [
      "http://localhost:4100/x",
      "http://127.0.0.1:4100/x",
      "http://[::1]:4100/x",
      "http://0.0.0.0:4100/x",
      "http://192.168.1.20:4100/x",
      "http://10.0.0.5/x",
      "http://172.16.0.1/x",
      "http://172.31.255.1/x",
      "http://169.254.1.1/x",
      "http://100.64.0.1/x",
      "http://hok.local/x",
      "http://api.localhost/x",
      "http://my-laptop:4100/x",
      "http://[fd00::1]/x",
      "http://[fe80::1]/x",
      "not a url",
    ]) {
      expect(isLocalAddress(local), local).toBe(true);
    }
  });

  it("does not flag public addresses, even ones that merely start with 'localhost'", () => {
    for (const pub of ["https://api.hok.example/x", "https://localhost-api.example.com/x", "http://172.32.0.1/x", "http://8.8.8.8/x", "https://[2606:4700::1111]/x"]) {
      expect(isLocalAddress(pub), pub).toBe(false);
    }
  });
});
