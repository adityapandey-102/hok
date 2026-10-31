import { describe, expect, it } from "vitest";
import { emptyValues, toPayload, valuesFromEvent } from "./personalEventForm";

describe("personalEventForm", () => {
  it("builds a payload with the viewer zone offset", () => {
    const r = toPayload({ ...emptyValues("2026-11-20"), title: " Dentist " }, "Asia/Kolkata");
    expect(r).toEqual({
      payload: {
        title: "Dentist",
        startsAt: "2026-11-20T09:00:00+05:30",
        endsAt: "2026-11-20T10:00:00+05:30",
        timeZone: "Asia/Kolkata",
        description: null,
        clientId: null,
      },
    });
  });
  it("rejects empty title, end before start and over 31 days", () => {
    expect(toPayload(emptyValues("2026-11-20"), "UTC")).toEqual({ error: "Enter a title." });
    expect(toPayload({ ...emptyValues("2026-11-20"), title: "x", end: "2026-11-19T10:00" }, "UTC")).toHaveProperty("error");
    expect(toPayload({ ...emptyValues("2026-11-20"), title: "x", end: "2026-12-30T10:00" }, "UTC")).toHaveProperty("error");
    expect(toPayload({ ...emptyValues(), title: "x" }, "UTC")).toHaveProperty("error");
  });
  it("round-trips an entry into form values in the viewer zone", () => {
    const v = valuesFromEvent(
      { id: "1", ownerId: "o", ownerName: "O", clientId: "c", clientName: "C", title: "T", startsAt: "2026-11-20T03:30:00.000Z", endsAt: "2026-11-20T04:30:00.000Z", timeZone: "UTC", description: null, version: 2 },
      "Asia/Kolkata",
    );
    expect(v).toEqual({ title: "T", start: "2026-11-20T09:00", end: "2026-11-20T10:00", description: "", clientId: "c" });
  });
});
