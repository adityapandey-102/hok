import { describe, expect, it, vi, beforeEach } from "vitest";
import { UsersService } from "./users.service";
import { AUDIT_ACTIONS } from "../../../common/audit/audit-actions";
import type { AuditEvent, AuditLogger } from "../../../common/audit/audit-logger";
import type { UserAccountEntity } from "../domain/user-account.entity";
import type {
  UsersRepositoryPort,
  NewUserRecord,
  ProfileUpdate,
  UserListFilters,
  UserListPage,
} from "./ports/users-repository.port";

/**
 * Unit coverage for the Users application service against an in-memory fake
 * repository + audit sink -- exercises the pagination envelope, not-found
 * handling, and the Admin self-protection / password rules with no DB.
 * Repository SQL itself is covered by the integration suite.
 */

function entity(overrides: Partial<UserAccountEntity> = {}): UserAccountEntity {
  return {
    id: "user-1",
    fullName: "Test Staff",
    email: "staff@hok.test",
    role: "editor",
    timeZone: "Asia/Kolkata",
    phone: null,
    avatarUrl: null,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: null,
    lastSeenAt: null,
    ...overrides,
  };
}

class FakeUsersRepository implements UsersRepositoryPort {
  users: UserAccountEntity[] = [];
  created: NewUserRecord[] = [];
  updates: { id: string; updates: ProfileUpdate }[] = [];
  passwords: { id: string; password: string }[] = [];
  banned: string[] = [];
  unbanned: string[] = [];

  findMany(_filters: UserListFilters, page: UserListPage): Promise<UserAccountEntity[]> {
    return Promise.resolve(this.users.slice(page.offset, page.offset + page.limit));
  }
  countMany(): Promise<number> {
    return Promise.resolve(this.users.length);
  }
  findById(id: string): Promise<UserAccountEntity | null> {
    return Promise.resolve(this.users.find((u) => u.id === id) ?? null);
  }
  createUser(record: NewUserRecord): Promise<string> {
    this.created.push(record);
    return Promise.resolve("new-id");
  }
  updateProfile(id: string, updates: ProfileUpdate): Promise<void> {
    this.updates.push({ id, updates });
    return Promise.resolve();
  }
  setPassword(id: string, password: string): Promise<void> {
    this.passwords.push({ id, password });
    return Promise.resolve();
  }
  banAuthUser(id: string): Promise<void> {
    this.banned.push(id);
    return Promise.resolve();
  }
  unbanAuthUser(id: string): Promise<void> {
    this.unbanned.push(id);
    return Promise.resolve();
  }
}

describe("UsersService", () => {
  let repo: FakeUsersRepository;
  let audit: AuditLogger & { events: AuditEvent[] };
  let service: UsersService;

  beforeEach(() => {
    repo = new FakeUsersRepository();
    const events: AuditEvent[] = [];
    audit = {
      events,
      record: vi.fn((e: AuditEvent) => {
        events.push(e);
        return Promise.resolve();
      }),
    };
    service = new UsersService(repo, audit);
  });

  describe("listUsers", () => {
    it("returns a paginated envelope with the full total", async () => {
      repo.users = [entity({ id: "a" }), entity({ id: "b" }), entity({ id: "c" })];
      const result = await service.listUsers({}, { limit: 2, offset: 0 });
      expect(result).toMatchObject({ total: 3, limit: 2, offset: 0 });
      expect(result.users).toHaveLength(2);
    });

    it("honours the offset window", async () => {
      repo.users = [entity({ id: "a" }), entity({ id: "b" }), entity({ id: "c" })];
      const result = await service.listUsers({}, { limit: 2, offset: 2 });
      expect(result.users.map((u) => u.id)).toEqual(["c"]);
    });
  });

  describe("getUser", () => {
    it("returns the user with their time zone", async () => {
      repo.users = [entity({ id: "a", fullName: "Ana", timeZone: "Europe/London" })];
      const user = await service.getUser("a");
      expect(user).toMatchObject({ fullName: "Ana", timeZone: "Europe/London" });
    });

    it("throws USER_NOT_FOUND when missing", async () => {
      await expect(service.getUser("missing")).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
    });
  });

  describe("createUser", () => {
    it("generates a name-based password, defaults the time zone, saves the phone and audits", async () => {
      const result = await service.createUser({ email: "new@hok.test", fullName: "Priya Shah", role: "developer", phone: "+91 98765 43210" });
      expect(result.userId).toBe("new-id");
      expect(result.password).toMatch(/^Priya-[A-Za-z0-9]{8}$/);
      expect(repo.created[0]).toMatchObject({ role: "developer", timeZone: "Asia/Kolkata", password: result.password });
      expect(repo.updates).toEqual([{ id: "new-id", updates: { phone: "+91 98765 43210" } }]);
      expect(audit.events.map((e) => e.action)).toEqual([AUDIT_ACTIONS.USER_CREATED]);
    });

    it("keeps an explicit time zone and skips the phone update when there is none", async () => {
      await service.createUser({ email: "x@hok.test", fullName: "X", role: "editor", timeZone: "America/New_York" });
      expect(repo.created[0]?.timeZone).toBe("America/New_York");
      expect(repo.updates).toHaveLength(0);
    });
  });

  describe("generatePassword", () => {
    it("sets and returns a fresh password for a staff account", async () => {
      repo.users = [entity({ id: "t", fullName: "Meera Nair", lastLoginAt: "2026-10-01T00:00:00.000Z" })];
      const { password } = await service.generatePassword("t", "admin");
      expect(password).toMatch(/^Meera-/);
      expect(repo.passwords).toEqual([{ id: "t", password }]);
      expect(audit.events.map((e) => e.action)).toContain(AUDIT_ACTIONS.USER_PASSWORD_REGENERATED);
    });

    it("refuses your own account and a signed-in Admin's (USER_PASSWORD_SELF_MANAGED)", async () => {
      repo.users = [entity({ id: "me", role: "admin" }), entity({ id: "a2", role: "admin", lastLoginAt: "2026-10-01T00:00:00.000Z" })];
      await expect(service.generatePassword("me", "me")).rejects.toMatchObject({ code: "USER_PASSWORD_SELF_MANAGED" });
      await expect(service.generatePassword("a2", "me")).rejects.toMatchObject({ code: "USER_PASSWORD_SELF_MANAGED" });
      expect(repo.passwords).toHaveLength(0);
    });
  });

  describe("updateUser", () => {
    it("rejects an empty edit", async () => {
      await expect(service.updateUser("t", "admin", {})).rejects.toMatchObject({ code: "VALIDATION_NO_FIELDS" });
    });

    it("updates the given fields and records a role change as from/to", async () => {
      repo.users = [entity({ id: "t", role: "editor" })];
      await service.updateUser("t", "admin", { role: "marketing_manager", timeZone: "Asia/Dubai", phone: null });
      expect(repo.updates).toEqual([{ id: "t", updates: { role: "marketing_manager", timeZone: "Asia/Dubai", phone: null } }]);
      expect(audit.events[0]?.metadata).toMatchObject({ role: { from: "editor", to: "marketing_manager" } });
    });

    it("refuses an Admin changing their own role", async () => {
      repo.users = [entity({ id: "me", role: "admin" })];
      await expect(service.updateUser("me", "me", { role: "editor" })).rejects.toMatchObject({ code: "USER_CANNOT_CHANGE_OWN_ROLE" });
      expect(repo.updates).toHaveLength(0);
    });

    it("refuses deactivating yourself through PATCH too", async () => {
      repo.users = [entity({ id: "me", role: "admin" })];
      await expect(service.updateUser("me", "me", { active: false })).rejects.toMatchObject({ code: "USER_CANNOT_DEACTIVATE_SELF" });
    });

    it("bans / unbans at the auth layer when PATCH flips active", async () => {
      repo.users = [entity({ id: "t", active: true }), entity({ id: "u", active: false })];
      await service.updateUser("t", "admin", { active: false });
      await service.updateUser("u", "admin", { active: true });
      expect(repo.banned).toEqual(["t"]);
      expect(repo.unbanned).toEqual(["u"]);
    });

    it("throws USER_NOT_FOUND for a missing target", async () => {
      await expect(service.updateUser("missing", "admin", { fullName: "X" })).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
    });
  });

  describe("deactivateUser", () => {
    it("rejects deactivating your own account", async () => {
      repo.users = [entity({ id: "self" })];
      await expect(service.deactivateUser("self", "self")).rejects.toMatchObject({ code: "USER_CANNOT_DEACTIVATE_SELF" });
      expect(repo.updates).toHaveLength(0);
    });

    it("deactivates: sets inactive, bans auth, audits", async () => {
      repo.users = [entity({ id: "target" })];
      await service.deactivateUser("target", "admin");
      expect(repo.updates).toEqual([{ id: "target", updates: { active: false } }]);
      expect(repo.banned).toEqual(["target"]);
      expect(audit.events.map((e) => e.action)).toContain(AUDIT_ACTIONS.USER_DEACTIVATED);
    });

    it("throws USER_NOT_FOUND when the target is missing", async () => {
      await expect(service.deactivateUser("missing", "admin")).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
      expect(repo.banned).toHaveLength(0);
    });
  });

  describe("reactivateUser", () => {
    it("reactivates: sets active, unbans auth, audits", async () => {
      repo.users = [entity({ id: "target", active: false })];
      await service.reactivateUser("target");
      expect(repo.updates).toEqual([{ id: "target", updates: { active: true } }]);
      expect(repo.unbanned).toEqual(["target"]);
      expect(audit.events.map((e) => e.action)).toContain(AUDIT_ACTIONS.USER_REACTIVATED);
    });

    it("throws USER_NOT_FOUND when the target is missing", async () => {
      await expect(service.reactivateUser("missing")).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
    });
  });
});
