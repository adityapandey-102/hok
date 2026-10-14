import { describe, expect, it } from "vitest";
import { createEventDtoSchema, eventQueryDtoSchema, moveStageDtoSchema, updateEventDtoSchema } from "./event.dto";

const base = {
  clientId: "7c443f82-7913-4383-b49c-605bdbe8e139",
  templateId: "2f71448d-d7d2-4367-a22e-9de10f990cd6",
  title: "Shoot",
  type: "shoot",
  startsAt: "2026-10-20T10:00:00+05:30",
  endsAt: "2026-10-20T16:00:00+05:30",
};
const paths = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: (string | number)[] }[] } } }, v: unknown) => {
  const r = schema.safeParse(v);
  return r.success ? [] : r.error!.issues.map((i) => i.path.join("."));
};

describe("createEventDtoSchema", () => {
  it("accepts instants with an offset or Z, and an IANA zone", () => {
    expect(createEventDtoSchema.safeParse({ ...base, timeZone: "Asia/Kolkata" }).success).toBe(true);
    expect(createEventDtoSchema.safeParse({ ...base, startsAt: "2026-10-20T04:30:00Z" }).success).toBe(true);
  });

  it("refuses a wall time without an offset, a raw-offset zone and an unknown type", () => {
    expect(paths(createEventDtoSchema, { ...base, startsAt: "2026-10-20T10:00:00" })).toContain("startsAt");
    expect(paths(createEventDtoSchema, { ...base, timeZone: "+05:30" })).toContain("timeZone");
    expect(paths(createEventDtoSchema, { ...base, type: "party" })).toContain("type");
  });

  it("de-duplicates the team and caps it at 20", () => {
    const id = base.clientId;
    const r = createEventDtoSchema.safeParse({ ...base, assignedTeam: [id, id] });
    expect(r.success && r.data.assignedTeam).toEqual([id]);
    expect(paths(createEventDtoSchema, { ...base, assignedTeam: ["nope"] })).toContain("assignedTeam.0");
  });
});

describe("updateEventDtoSchema / moveStageDtoSchema", () => {
  it("require a version; state is one of active / cancelled / postponed", () => {
    expect(updateEventDtoSchema.safeParse({ title: "x" }).success).toBe(false);
    expect(updateEventDtoSchema.safeParse({ state: "postponed", version: 1 }).success).toBe(true);
    expect(updateEventDtoSchema.safeParse({ state: "done", version: 1 }).success).toBe(false);
  });

  it("a stage move defaults to not visible to the client", () => {
    const r = moveStageDtoSchema.safeParse({ stageId: base.clientId, version: 1 });
    expect(r.success && r.data.visibleToClient).toBe(false);
    expect(moveStageDtoSchema.safeParse({ stageId: base.clientId }).success).toBe(false);
  });
});

describe("eventQueryDtoSchema", () => {
  it("clamps the page to 200 and refuses malformed instants", () => {
    expect(eventQueryDtoSchema.parse({ limit: "5000" }).limit).toBe(200);
    expect(eventQueryDtoSchema.parse({}).limit).toBe(50);
    expect(eventQueryDtoSchema.safeParse({ from: "yesterday" }).success).toBe(false);
  });
});
