import { env } from "../../../config/env";
import { BadRequestError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { generatePassword } from "../../../common/crypto/credentials";
import {
  assertCanChangeRole,
  assertCanCreateWithRole,
  assertCanDeactivate,
  assertCanRegenerateAdminPassword,
  assertNotChangingOwnRole,
  assertNotDeactivatingSelf,
  assertPasswordCanBeRegenerated,
} from "../domain/account-admin.rules";
import { toUserResponseDto } from "../api/user.presenter";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import { logger } from "../../../common/logger/logger";
import type { UserAccountEntity } from "../domain/user-account.entity";
import type {
  UsersRepositoryPort,
  ProfileUpdate,
  UserListFilters,
  UserListPage,
} from "./ports/users-repository.port";
import type { UserResponseDto } from "../api/dto/user.response.dto";
import type { CreateUserDto } from "../api/dto/create-user.dto";
import type { UpdateUserDto } from "../api/dto/update-user.dto";

/** Paginated user list -- `total` is the full count matching the filters, for the pager. */
export interface UserListResult {
  users: UserResponseDto[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * The Admin's staff-account management (users:manage, REQUIREMENTS
 * FR-AUTH-02/03). The rules about what an Admin may do to their own or another
 * Admin's account live in domain/account-admin.rules.ts.
 */
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
  ) {}

  async listUsers(filters: UserListFilters, page: UserListPage): Promise<UserListResult> {
    // Count + page in parallel -- needleye's list shape.
    const [entities, total] = await Promise.all([
      this.usersRepository.findMany(filters, page),
      this.usersRepository.countMany(filters),
    ]);
    return { users: entities.map(toUserResponseDto), total, limit: page.limit, offset: page.offset };
  }

  async getUser(id: string): Promise<UserResponseDto> {
    return toUserResponseDto(await this.findOrThrow(id));
  }

  /**
   * Creates the account directly with a real password -- no invite email.
   * The generated password is returned once in the response; the Admin is
   * responsible for passing it on to the new person.
   */
  async createUser(dto: CreateUserDto, callerId: string): Promise<{ userId: string; password: string }> {
    assertCanCreateWithRole(dto.role, await this.callerIsOwner(callerId));
    const password = generatePassword(dto.fullName);
    const userId = await this.usersRepository.createUser({
      email: dto.email,
      fullName: dto.fullName,
      role: dto.role,
      timeZone: dto.timeZone ?? env.DEFAULT_TIMEZONE,
      password,
    });
    // The profiles trigger only copies name/role/time zone from the auth
    // metadata; the optional phone is a plain profile column.
    if (dto.phone) await this.usersRepository.updateProfile(userId, { phone: dto.phone });
    await this.audit.record({
      action: AUDIT_ACTIONS.USER_CREATED,
      entityType: AUDIT_ENTITIES.USER,
      entityId: userId,
      metadata: { role: dto.role },
    });
    return { userId, password };
  }

  async generatePassword(targetId: string, callerId: string): Promise<{ password: string }> {
    const target = await this.findOrThrow(targetId);
    assertPasswordCanBeRegenerated(target, callerId);
    assertCanRegenerateAdminPassword(target, await this.callerIsOwner(callerId));

    const password = generatePassword(target.fullName);
    await this.usersRepository.setPassword(targetId, password);
    // A reset means the old password may be known to someone else: end every session the
    // user had (security audit run 1). The new password is already set, so a failure here is
    // logged and audited, not a reason to hide the new password from the Admin.
    let sessionsRevoked = true;
    await this.usersRepository.revokeSessions(targetId).catch((error: unknown) => {
      sessionsRevoked = false;
      logger.error({ err: error, userId: targetId }, "Password reset: could not sign the user out of other sessions");
    });
    await this.audit.record({ action: AUDIT_ACTIONS.USER_PASSWORD_REGENERATED, entityType: AUDIT_ENTITIES.USER, entityId: targetId, metadata: { sessionsRevoked } });
    return { password };
  }

  async updateUser(targetId: string, callerId: string, dto: UpdateUserDto): Promise<void> {
    const updates: ProfileUpdate = {};
    if (dto.fullName !== undefined) updates.fullName = dto.fullName;
    if (dto.role !== undefined) updates.role = dto.role;
    if (dto.timeZone !== undefined) updates.timeZone = dto.timeZone;
    if (dto.phone !== undefined) updates.phone = dto.phone;
    if (dto.active !== undefined) updates.active = dto.active;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestError("No fields to update", ERROR_CODES.VALIDATION_NO_FIELDS);
    }

    const target = await this.findOrThrow(targetId);
    if (updates.role !== undefined) assertNotChangingOwnRole(targetId, callerId, target.role, updates.role);
    if (updates.active === false) assertNotDeactivatingSelf(targetId, callerId);
    // Owner rules, consulted only when an Admin is involved so other edits skip the caller lookup.
    if (updates.role !== undefined && (target.role === "admin" || updates.role === "admin")) {
      assertCanChangeRole(target, updates.role, await this.callerIsOwner(callerId));
    }
    if (updates.active === false) assertCanDeactivate(target, await this.callerIsOwner(callerId));

    await this.usersRepository.updateProfile(targetId, updates);
    // `active` through PATCH must have the same effect as deactivate/reactivate:
    // the auth-layer ban is what stops a refresh token from minting new sessions.
    if (updates.active !== undefined && updates.active !== target.active) {
      if (updates.active) await this.usersRepository.unbanAuthUser(targetId);
      else {
        await this.usersRepository.banAuthUser(targetId);
        // No more pushes (task titles, due times) to devices a deactivated person registered.
        await this.usersRepository.deletePushSubscriptions(targetId);
      }
    }

    await this.audit.record({
      action: AUDIT_ACTIONS.USER_UPDATED,
      entityType: AUDIT_ENTITIES.USER,
      entityId: targetId,
      metadata: {
        fields: Object.keys(updates),
        ...(updates.role !== undefined && updates.role !== target.role ? { role: { from: target.role, to: updates.role } } : {}),
      },
    });
  }

  async deactivateUser(targetId: string, callerId: string): Promise<void> {
    assertNotDeactivatingSelf(targetId, callerId);
    const target = await this.findOrThrow(targetId);
    assertCanDeactivate(target, await this.callerIsOwner(callerId));

    await this.usersRepository.updateProfile(targetId, { active: false });
    // Blocks sign-in and refresh at the auth layer; requireAuth already rejects
    // an inactive profile on the very next request, so live access tokens die too.
    await this.usersRepository.banAuthUser(targetId);
    await this.usersRepository.deletePushSubscriptions(targetId);
    await this.audit.record({ action: AUDIT_ACTIONS.USER_DEACTIVATED, entityType: AUDIT_ENTITIES.USER, entityId: targetId });
  }

  async reactivateUser(targetId: string): Promise<void> {
    await this.findOrThrow(targetId);

    await this.usersRepository.updateProfile(targetId, { active: true });
    // Lift the auth-layer ban so the account can sign in again (same password as before).
    await this.usersRepository.unbanAuthUser(targetId);
    await this.audit.record({ action: AUDIT_ACTIONS.USER_REACTIVATED, entityType: AUDIT_ENTITIES.USER, entityId: targetId });
  }

  /** Whether the signed-in Admin is the Owner (profiles.is_owner); read fresh from the database on each check. */
  private async callerIsOwner(callerId: string): Promise<boolean> {
    return (await this.usersRepository.findById(callerId))?.isOwner ?? false;
  }

  private async findOrThrow(id: string): Promise<UserAccountEntity> {
    const entity = await this.usersRepository.findById(id);
    if (!entity) throw new NotFoundError("User not found", ERROR_CODES.USER_NOT_FOUND);
    return entity;
  }
}
