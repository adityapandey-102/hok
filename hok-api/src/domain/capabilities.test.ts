import { describe, expect, it } from "vitest";
import { CAPABILITIES, getCapabilityScope, hasCapability, isScopedToOwnRecords, type Capability } from "./capabilities";
import { ROLES, isClientManager, type Role } from "./roles";

const TASK_ONLY: Role[] = ["marketing_agent", "developer", "editor", "content_writer"];
const MANAGERS: Role[] = ["social_media_manager", "marketing_manager"];

const CLIENT_SIDE: Capability[] = [
  "clients:read",
  "clients:write",
  "events:read",
  "events:write",
  "personal_events:manage",
  "assets:read",
  "assets:write",
  "portal:manage",
  "comments:read",
  "comments:manage",
];

describe("capabilities matrix", () => {
  it("defines a scope for every role on every capability", () => {
    for (const capability of CAPABILITIES) {
      for (const role of ROLES) {
        expect(getCapabilityScope(role, capability)).toBeDefined();
      }
    }
  });

  it("gives admin unrestricted (true) access to everything", () => {
    for (const capability of CAPABILITIES) {
      expect(getCapabilityScope("admin", capability)).toBe(true);
    }
  });

  it("scopes Social Media / Marketing Managers to their own clients on every client-side capability", () => {
    for (const role of MANAGERS) {
      for (const capability of CLIENT_SIDE) {
        expect(getCapabilityScope(role, capability)).toBe("own");
        expect(isScopedToOwnRecords(role, capability)).toBe(true);
      }
    }
  });

  it("gives task-only staff (Marketing Agent, Developer, Editor) no client-side access at all", () => {
    for (const role of TASK_ONLY) {
      for (const capability of CLIENT_SIDE) {
        expect(hasCapability(role, capability)).toBe(false);
      }
    }
  });

  it("keeps admin-only powers admin-only (users, templates, reassigning, assigning tasks, global dashboard)", () => {
    const adminOnly: Capability[] = ["users:manage", "stage_templates:manage", "clients:reassign", "staff_tasks:assign", "dashboard:global"];
    for (const role of ROLES.filter((r) => r !== "admin")) {
      for (const capability of adminOnly) {
        expect(getCapabilityScope(role, capability)).toBe(false);
      }
    }
  });

  it("lets every non-admin role read and update only the staff tasks assigned to them", () => {
    for (const role of ROLES.filter((r) => r !== "admin")) {
      expect(getCapabilityScope(role, "staff_tasks:read")).toBe("own");
      expect(getCapabilityScope(role, "staff_tasks:update")).toBe("own");
    }
  });

  it("agrees with isClientManager: exactly the roles that can read clients", () => {
    for (const role of ROLES) {
      expect(hasCapability(role, "clients:read")).toBe(isClientManager(role));
    }
  });
});
