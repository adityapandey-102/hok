import { describe, expect, it } from "vitest";
import { activityQueryDtoSchema } from "./activity-query.dto";

describe("activityQueryDtoSchema", () => {
  it("defaults: all kinds, 50 per page, no range (the service applies the last 7 days)", () => {
    expect(activityQueryDtoSchema.parse({})).toEqual({ kind: "all", limit: 50, offset: 0 });
  });

  it("parses instants, kind, person and paging", () => {
    const q = activityQueryDtoSchema.parse({
      from: "2026-10-01T00:00:00Z",
      to: "2026-10-08T00:00:00+05:30",
      kind: "tasks",
      actorId: "11111111-1111-4111-8111-111111111111",
      limit: "10",
      offset: "20",
    });
    expect(q.from).toEqual(new Date("2026-10-01T00:00:00Z"));
    expect(q.to).toEqual(new Date("2026-10-07T18:30:00Z"));
    expect(q).toMatchObject({ kind: "tasks", limit: 10, offset: 20 });
  });

  it("rejects bad input instead of defaulting", () => {
    for (const bad of [
      { kind: "bogus" },
      { from: "yesterday" },
      { from: "2026-10-01" },
      { actorId: "not-a-uuid" },
      { limit: "0" },
      { limit: "51" },
      { limit: "abc" },
      { offset: "-1" },
    ]) {
      expect(activityQueryDtoSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
