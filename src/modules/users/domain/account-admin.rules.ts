import { BadRequestError, ForbiddenError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import type { Role } from "../../../domain";

/**
 * Rules for the Admin managing staff accounts (REQUIREMENTS FR-AUTH-02/03).
 * Pure functions that throw AppError directly -- see
 * docs/adr/0002-repository-port-implementation-split.md for why domain rules
 * in this codebase don't use a separate domain-error type.
 *
 * Together, the two "self" rules guarantee there is always at least one active
 * Admin: an Admin can demote or deactivate *another* Admin, but never
 * themselves, so the caller -- an Admin -- always remains.
 */

/** An Admin can't deactivate their own account (POST /users/:id/deactivate, or PATCH { active: false }). */
export function assertNotDeactivatingSelf(targetId: string, callerId: string): void {
  if (targetId === callerId) {
    throw new BadRequestError("You cannot deactivate your own account", ERROR_CODES.USER_CANNOT_DEACTIVATE_SELF);
  }
}

/** An Admin can't change their own role -- the only thing standing between "one admin" and "no admin". */
export function assertNotChangingOwnRole(targetId: string, callerId: string, currentRole: Role, newRole: Role): void {
  if (targetId === callerId && newRole !== currentRole) {
    throw new BadRequestError("You cannot change your own role", ERROR_CODES.USER_CANNOT_CHANGE_OWN_ROLE);
  }
}

export interface PasswordTarget {
  id: string;
  role: Role;
  lastLoginAt: string | null;
}

/**
 * The Admin can issue a fresh generated password for any staff account (they
 * forget it, or never received it). Two exceptions, both
 * USER_PASSWORD_SELF_MANAGED (403):
 *  - their own account: change it from the profile page (POST /auth/password-update),
 *    which needs a live session rather than handing the Admin a new secret;
 *  - another Admin who has already signed in: from then on that Admin manages
 *    their own password (the forgot-password flow), so one Admin can't
 *    silently take over another Admin's account. Before that first sign-in
 *    it's allowed, in case the first password never reached them.
 */
export function assertPasswordCanBeRegenerated(target: PasswordTarget, callerId: string): void {
  if (target.id === callerId) {
    throw new ForbiddenError("Change your own password from your profile", ERROR_CODES.USER_PASSWORD_SELF_MANAGED);
  }
  if (target.role === "admin" && target.lastLoginAt !== null) {
    throw new ForbiddenError(
      "This Admin has already signed in and manages their own password. They can use 'Forgot password'.",
      ERROR_CODES.USER_PASSWORD_SELF_MANAGED,
    );
  }
}
