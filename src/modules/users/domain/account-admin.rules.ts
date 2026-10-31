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
 *
 * On top of that there is one Owner (the first Admin, profiles.is_owner). Only
 * the Owner manages other Admins (make, demote, deactivate, regenerate the
 * password of), and nobody can demote or deactivate the Owner. Without this an
 * Admin could demote a peer, reset their password, then re-promote them (audit
 * lead users.admin-password-rule-bypass-via-role-flip).
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

/** The Owner-only guard shared by the rules below. */
function assertCallerIsOwner(callerIsOwner: boolean, action: string): void {
  if (!callerIsOwner) throw new ForbiddenError(`Only the Owner can ${action}`, ERROR_CODES.USER_OWNER_ONLY);
}

/** Creating an Admin account is Owner-only. */
export function assertCanCreateWithRole(role: Role, callerIsOwner: boolean): void {
  if (role === "admin") assertCallerIsOwner(callerIsOwner, "create an Admin");
}

/**
 * A role change that makes or unmakes an Admin is Owner-only, and the Owner
 * can't be moved off Admin. Resending an Admin's unchanged role is fine.
 */
export function assertCanChangeRole(target: { role: Role; isOwner: boolean }, newRole: Role, callerIsOwner: boolean): void {
  if (target.isOwner && newRole !== "admin") {
    throw new ForbiddenError("The Owner cannot be demoted", ERROR_CODES.USER_OWNER_PROTECTED);
  }
  if ((target.role === "admin") !== (newRole === "admin")) {
    assertCallerIsOwner(callerIsOwner, newRole === "admin" ? "make someone an Admin" : "demote an Admin");
  }
}

/** The Owner can't be deactivated; deactivating any other Admin is Owner-only. */
export function assertCanDeactivate(target: { role: Role; isOwner: boolean }, callerIsOwner: boolean): void {
  if (target.isOwner) throw new ForbiddenError("The Owner cannot be deactivated", ERROR_CODES.USER_OWNER_PROTECTED);
  if (target.role === "admin") assertCallerIsOwner(callerIsOwner, "deactivate an Admin");
}

/** Regenerating an Admin's password is Owner-only (checked after assertPasswordCanBeRegenerated). */
export function assertCanRegenerateAdminPassword(target: { role: Role }, callerIsOwner: boolean): void {
  if (target.role === "admin") assertCallerIsOwner(callerIsOwner, "regenerate an Admin's password");
}
