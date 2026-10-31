import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthService } from "./auth.service";
import { AUDIT_ACTIONS } from "../../../common/audit/audit-actions";
import { ForbiddenError } from "../../../common/errors/app-error";
import type { AuditEvent, AuditLogger } from "../../../common/audit/audit-logger";
import type { Profile } from "../../../domain";
import type { AuthRepositoryPort, AuthTokens, NewAdminRecord } from "./ports/auth-repository.port";
import type { OwnProfileChanges } from "../domain/own-profile.rules";

/**
 * Unit coverage for the Auth application service against an in-memory fake
 * repository + audit sink: the bootstrap gate, login bookkeeping (last login +
 * audit), the "inactive account never keeps a session" rule, and self-service
 * profile edits. The real provider is covered by the integration suite.
 */

const TOKENS: AuthTokens = { userId: "u1", accessToken: "at", refreshToken: "rt", expiresAt: 123 };

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "u1",
    fullName: "Aisha Khan",
    email: "admin@hok.test",
    role: "admin",
    timeZone: "Asia/Kolkata",
    phone: null,
    avatarUrl: null,
    active: true,
    createdAt: "2026-10-13T00:00:00.000Z",
    ...overrides,
  };
}

class FakeAuthRepository implements AuthRepositoryPort {
  admins = 0;
  createdAdmins: NewAdminRecord[] = [];
  logins: string[] = [];
  signedOut: string[] = [];
  profileUpdates: { userId: string; changes: OwnProfileChanges }[] = [];
  current: Profile | Error = profile();

  countAdmins(): Promise<number> {
    return Promise.resolve(this.admins);
  }
  withBootstrapLock<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
  createAdminUser(record: NewAdminRecord): Promise<string> {
    this.createdAdmins.push(record);
    return Promise.resolve("new-admin");
  }
  owners: string[] = [];
  markOwner(userId: string): Promise<void> {
    this.owners.push(userId);
    return Promise.resolve();
  }
  signInWithPassword(): Promise<AuthTokens> {
    return Promise.resolve(TOKENS);
  }
  refreshSession(): Promise<AuthTokens> {
    return Promise.resolve(TOKENS);
  }
  signOut(accessToken: string): Promise<void> {
    this.signedOut.push(accessToken);
    return Promise.resolve();
  }
  requestPasswordReset(): Promise<void> {
    return Promise.resolve();
  }
  passwordUpdates: string[] = [];
  revokedAll: string[] = [];
  currentPassword = "Current-123";
  updatePassword(userId: string): Promise<void> {
    this.passwordUpdates.push(userId);
    return Promise.resolve();
  }
  verifyPassword(_email: string, password: string): Promise<boolean> {
    return Promise.resolve(password === this.currentPassword);
  }
  revokeAllSessions(userId: string): Promise<void> {
    this.revokedAll.push(userId);
    return Promise.resolve();
  }
  exchangeCodeForSession(): Promise<AuthTokens> {
    return Promise.resolve(TOKENS);
  }
  getProfile(): Promise<Profile> {
    return this.current instanceof Error ? Promise.reject(this.current) : Promise.resolve(this.current);
  }
  recordLogin(userId: string): Promise<void> {
    this.logins.push(userId);
    return Promise.resolve();
  }
  updateOwnProfile(userId: string, changes: OwnProfileChanges): Promise<void> {
    this.profileUpdates.push({ userId, changes });
    return Promise.resolve();
  }
}

describe("AuthService", () => {
  let repo: FakeAuthRepository;
  let events: AuditEvent[];
  let service: AuthService;

  beforeEach(() => {
    repo = new FakeAuthRepository();
    events = [];
    const audit: AuditLogger = {
      record: vi.fn((e: AuditEvent) => {
        events.push(e);
        return Promise.resolve();
      }),
    };
    service = new AuthService(repo, audit);
  });

  describe("bootstrap", () => {
    it("reports adminExists from the admin count", async () => {
      expect(await service.getBootstrapStatus()).toEqual({ adminExists: false });
      repo.admins = 1;
      expect(await service.getBootstrapStatus()).toEqual({ adminExists: true });
    });

    const KEY = "setup-key-for-tests-0123456789";
    const withKey = () => new AuthService(repo, { record: (e: AuditEvent) => (events.push(e), Promise.resolve()) }, KEY);

    it("is off when no setup key is configured, and refuses a wrong key (security audit run 1)", async () => {
      await expect(service.bootstrap({ setupKey: "anything", email: "x@hok.test", password: "Secret123", fullName: "X" })).rejects.toMatchObject({ code: "AUTH_BOOTSTRAP_DISABLED" });
      await expect(withKey().bootstrap({ setupKey: "wrong", email: "x@hok.test", password: "Secret123", fullName: "X" })).rejects.toMatchObject({ code: "AUTH_BOOTSTRAP_KEY_INVALID" });
      expect(repo.createdAdmins).toHaveLength(0);
    });

    it("creates the first admin with the default time zone and audits it", async () => {
      await withKey().bootstrap({ setupKey: KEY, email: "first@hok.test", password: "Secret123", fullName: "First Admin" });
      expect(repo.createdAdmins).toEqual([{ email: "first@hok.test", password: "Secret123", fullName: "First Admin", timeZone: "Asia/Kolkata" }]);
      expect(repo.owners).toEqual(["new-admin"]); // the first Admin is the Owner
      expect(events[0]).toMatchObject({ action: AUDIT_ACTIONS.AUTH_BOOTSTRAP, actorId: "new-admin" });
    });

    it("refuses once an admin exists", async () => {
      repo.admins = 1;
      await expect(withKey().bootstrap({ setupKey: KEY, email: "x@hok.test", password: "Secret123", fullName: "X" })).rejects.toMatchObject({
        code: "AUTH_BOOTSTRAP_ALREADY_DONE",
      });
      expect(repo.createdAdmins).toHaveLength(0);
    });
  });

  describe("updatePassword (security audit run 1)", () => {
    it("refuses a wrong current password and changes nothing", async () => {
      await expect(service.updatePassword("u1", { currentPassword: "wrong", newPassword: "New-12345" })).rejects.toMatchObject({ code: "AUTH_CURRENT_PASSWORD_INVALID" });
      expect(repo.passwordUpdates).toEqual([]);
      expect(repo.revokedAll).toEqual([]);
    });

    it("with the right current password, changes it and ends every session", async () => {
      await service.updatePassword("u1", { currentPassword: repo.currentPassword, newPassword: "New-12345" });
      expect(repo.passwordUpdates).toEqual(["u1"]);
      expect(repo.revokedAll).toEqual(["u1"]);
    });
  });

  describe("login", () => {
    it("returns tokens + profile, records the login and audits with the user as actor", async () => {
      const session = await service.login({ email: "admin@hok.test", password: "x" });
      expect(session).toMatchObject({ accessToken: "at", refreshToken: "rt", expiresAt: 123, profile: { timeZone: "Asia/Kolkata" } });
      expect(repo.logins).toEqual(["u1"]);
      expect(events[0]).toMatchObject({ action: AUDIT_ACTIONS.AUTH_LOGIN, actorId: "u1" });
    });

    it("revokes the fresh session when the account is inactive, and records nothing", async () => {
      repo.current = new ForbiddenError("This account has been deactivated", "AUTH_ACCOUNT_DEACTIVATED");
      await expect(service.login({ email: "x@hok.test", password: "x" })).rejects.toMatchObject({ code: "AUTH_ACCOUNT_DEACTIVATED" });
      expect(repo.signedOut).toEqual(["at"]);
      expect(repo.logins).toHaveLength(0);
      expect(events).toHaveLength(0);
    });
  });

  it("a refresh does not count as a login", async () => {
    await service.refresh({ refreshToken: "rt" });
    expect(repo.logins).toHaveLength(0);
  });

  describe("updateOwnProfile", () => {
    it("saves only the sent fields, audits them and returns the fresh profile", async () => {
      repo.current = profile({ timeZone: "Europe/London" });
      const result = await service.updateOwnProfile("u1", { timeZone: "Europe/London", phone: null });
      expect(repo.profileUpdates).toEqual([{ userId: "u1", changes: { timeZone: "Europe/London", phone: null } }]);
      expect(events[0]).toMatchObject({ action: AUDIT_ACTIONS.USER_PROFILE_UPDATED, metadata: { fields: ["timeZone", "phone"] } });
      expect(result.timeZone).toBe("Europe/London");
    });

    it("refuses an empty edit", async () => {
      await expect(service.updateOwnProfile("u1", {})).rejects.toMatchObject({ code: "VALIDATION_NO_FIELDS" });
      expect(repo.profileUpdates).toHaveLength(0);
    });
  });
});
