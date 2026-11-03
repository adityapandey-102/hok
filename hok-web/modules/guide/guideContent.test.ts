import { describe, expect, it } from "vitest";
import { GUIDE, searchGuide, topicFor } from "./guideContent";

describe("guide", () => {
  it("opens on the page's topic, most specific page first", () => {
    expect(topicFor("/app")).toBe("Dashboard");
    expect(topicFor("/app/clients")).toBe("Clients");
    expect(topicFor("/app/clients/123")).toBe("Clients");
    expect(topicFor("/app/events/abc")).toBe("Events");
    expect(topicFor("/app/team")).toBe("Team workload");
    expect(topicFor("/elsewhere")).toBe("");
  });

  it("finds articles by title, keyword or text, every word must match", () => {
    expect(searchGuide(GUIDE, "portal")[0]!.id).toBe("portal");
    expect(searchGuide(GUIDE, "Clients")[0]!.id).toBe("clients"); // the page's own article first
    expect(searchGuide(GUIDE, "ctrl k").map((a) => a.id)).toContain("search");
    expect(searchGuide(GUIDE, "push iphone").map((a) => a.id)).toEqual(["notifications"]);
    expect(searchGuide(GUIDE, "zzzz")).toEqual([]);
    expect(searchGuide(GUIDE, "  ")).toHaveLength(GUIDE.length);
  });

  it("has unique ids and real steps", () => {
    expect(new Set(GUIDE.map((a) => a.id)).size).toBe(GUIDE.length);
    for (const a of GUIDE) expect(a.steps.length, a.id).toBeGreaterThan(0);
  });
});

describe("guide (round 1: calendar for everyone, My to-dos)", () => {
  it("shows the calendar to every role and the to-dos article to anyone with to-dos", () => {
    expect(GUIDE.find((a) => a.id === "calendar")?.requires).toBe("staff_tasks:read");
    expect(GUIDE.find((a) => a.id === "my-todos")?.requires).toBe("todos:manage");
  });
  it("opens on the to-dos topic on /app/todos, and finds it by its words", () => {
    expect(topicFor("/app/todos")).toBe("My to-dos");
    expect(searchGuide(GUIDE, "urgent reminder").map((a) => a.id)).toContain("my-todos");
  });
});

describe("guide (round 3: approvals)", () => {
  it("opens on the Approvals topic and is found by its words, for every staff role", () => {
    expect(topicFor("/app/approvals")).toBe("Approvals");
    expect(GUIDE.find((a) => a.id === "approvals")?.requires).toBe("staff_tasks:read");
    expect(searchGuide(GUIDE, "request changes").map((a) => a.id)).toContain("approvals");
    expect(searchGuide(GUIDE, "approvers").map((a) => a.id)).toContain("templates");
  });
});
