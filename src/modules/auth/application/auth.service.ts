import { env } from "../../../config/env";
import { BadRequestError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { assertBootstrapKey, assertNoAdminExists } from "../domain/bootstrap.rules";
import { pickOwnProfileChanges } from "../domain/own-profile.rules";
import { toAuthSessionResponseDto } from "../api/auth-session.presenter";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import type { Profile } from "../../../domain";

import type { AuthRepositoryPort, AuthTokens } from "./ports/auth-repository.port";
import type { BootstrapDto } from "../api/dto/bootstrap.dto";
import type { LoginDto } from "../api/dto/login.dto";
import type { RefreshDto } from "../api/dto/refresh.dto";
import type { PasswordResetRequestDto } from "../api/dto/password-reset-request.dto";
import type { PasswordUpdateDto } from "../api/dto/password-update.dto";
import type { ExchangeCodeDto } from "../api/dto/exchange-code.dto";
import type { UpdateOwnProfileDto } from "../api/dto/update-own-profile.dto";
import type { AuthSessionResponseDto } from "../api/dto/auth-session.response.dto";

/**
 * Owns every auth operation the frontend needs, so hok-web never talks to
 * Supabase Auth directly -- it only ever talks to this API. Every method here
 * is self-contained: no session is kept between calls, tokens are always taken
 * as explicit input and handed back in the return value.
 */
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
    private readonly bootstrapToken: string | undefined = env.BOOTSTRAP_TOKEN,
  ) {}

  async getBootstrapStatus(): Promise<{ adminExists: boolean }> {
    const count = await this.authRepository.countAdmins();
    return { adminExists: count > 0 };
  }

  async bootstrap(dto: BootstrapDto): Promise<void> {
    assertBootstrapKey(this.bootstrapToken, dto.setupKey);
    // Check and create under one lock, re-checked here, not trusted from an earlier bootstrap-status call.
    const userId = await this.authRepository.withBootstrapLock(async () => {
      assertNoAdminExists(await this.authRepository.countAdmins());
      const id = await this.authRepository.createAdminUser({
        email: dto.email,
        password: dto.password,
        fullName: dto.fullName,
        timeZone: dto.timeZone ?? env.DEFAULT_TIMEZONE,
      });
      // The first Admin is the Owner -- the only one who can later manage other Admins.
      await this.authRepository.markOwner(id);
      return id;
    });
    // Unauthenticated request: the new admin is the actor.
    await this.audit.record({ action: AUDIT_ACTIONS.AUTH_BOOTSTRAP, entityType: AUDIT_ENTITIES.USER, entityId: userId, actorId: userId });
  }

  async login(dto: LoginDto): Promise<AuthSessionResponseDto> {
    const tokens = await this.authRepository.signInWithPassword(dto.email, dto.password);
    const session = await this.withProfile(tokens);
    // Only a real credential-based login counts -- not a silent refresh, not
    // exchange-code. last_login_at drives the users list's "last seen" and the
    // rule that another admin's password can't be regenerated once they've
    // signed in (users/domain/account-admin.rules.ts).
    await this.authRepository.recordLogin(tokens.userId);
    // Actor is passed explicitly: the request context has no user yet (login
    // is unauthenticated), so the audit logger can't infer it from context.
    await this.audit.record({ action: AUDIT_ACTIONS.AUTH_LOGIN, entityType: AUDIT_ENTITIES.SESSION, actorId: tokens.userId });
    return session;
  }

  async refresh(dto: RefreshDto): Promise<AuthSessionResponseDto> {
    const tokens = await this.authRepository.refreshSession(dto.refreshToken);
    return this.withProfile(tokens);
  }

  async logout(accessToken: string): Promise<void> {
    await this.authRepository.signOut(accessToken);
    // Actor comes from the request context (logout is behind requireAuth).
    await this.audit.record({ action: AUDIT_ACTIONS.AUTH_LOGOUT, entityType: AUDIT_ENTITIES.SESSION });
  }

  async requestPasswordReset(dto: PasswordResetRequestDto): Promise<void> {
    const redirectTo = `${env.WEB_APP_URL}/auth/callback?next=/update-password`;
    await this.authRepository.requestPasswordReset(dto.email, redirectTo);
  }

  /**
   * Own password change (security audit run 1): a token alone is not enough, the current
   * password must match. Afterwards every session ends (GoTrue already does this on a password
   * change; revoking here keeps it true on any version), and the web app signs this device
   * straight back in with the new password.
   */
  async updatePassword(userId: string, dto: PasswordUpdateDto): Promise<void> {
    const profile = await this.authRepository.getProfile(userId);
    if (!(await this.authRepository.verifyPassword(profile.email, dto.currentPassword))) {
      throw new BadRequestError("Your current password is not correct.", ERROR_CODES.AUTH_CURRENT_PASSWORD_INVALID);
    }
    await this.authRepository.updatePassword(userId, dto.newPassword);
    await this.authRepository.revokeAllSessions(userId);
    await this.audit.record({ action: AUDIT_ACTIONS.AUTH_PASSWORD_CHANGED, entityType: AUDIT_ENTITIES.USER, entityId: userId });
  }

  async exchangeCode(dto: ExchangeCodeDto): Promise<AuthSessionResponseDto> {
    const tokens = await this.authRepository.exchangeCodeForSession(dto.code);
    return this.withProfile(tokens);
  }

  /**
   * The caller edits their own profile (name, phone, time zone, photo URL --
   * FR-AUTH-05). Never role, email or active: those are the Admin's, through
   * the Users module. Returns the fresh profile so the client can update its
   * session view without a second GET.
   */
  async updateOwnProfile(userId: string, dto: UpdateOwnProfileDto): Promise<Profile> {
    const changes = pickOwnProfileChanges(dto);
    await this.authRepository.updateOwnProfile(userId, changes);
    await this.audit.record({
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATED,
      entityType: AUDIT_ENTITIES.USER,
      entityId: userId,
      metadata: { fields: Object.keys(changes) },
    });
    return this.authRepository.getProfile(userId);
  }

  /**
   * Attaches the profile to a freshly-issued session, revoking the session
   * again if the account turns out to be inactive -- a deactivated user
   * should never walk away from login holding a live token.
   */
  private async withProfile(tokens: AuthTokens): Promise<AuthSessionResponseDto> {
    try {
      const profile = await this.authRepository.getProfile(tokens.userId);
      return toAuthSessionResponseDto(tokens, profile);
    } catch (err) {
      await this.authRepository.signOut(tokens.accessToken);
      throw err;
    }
  }
}
