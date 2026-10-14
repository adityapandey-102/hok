import { BadRequestError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";

/** The fields a user may change on their own profile (FR-AUTH-05). Never role, email or active. */
export interface OwnProfileChanges {
  fullName?: string;
  timeZone?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

/**
 * Keeps only the self-editable fields actually present in the request (an
 * absent key means "leave it alone"; `null` means "clear it") and refuses an
 * empty edit, so a PATCH that changes nothing is a 400 rather than a silent
 * no-op. Anything else on the input (role, email, active) is dropped here as a
 * second line of defence behind the DTO, which already strips unknown keys.
 */
export function pickOwnProfileChanges(input: OwnProfileChanges): OwnProfileChanges {
  const changes: OwnProfileChanges = {};
  if (input.fullName !== undefined) changes.fullName = input.fullName;
  if (input.timeZone !== undefined) changes.timeZone = input.timeZone;
  if (input.phone !== undefined) changes.phone = input.phone;
  if (input.avatarUrl !== undefined) changes.avatarUrl = input.avatarUrl;
  if (Object.keys(changes).length === 0) {
    throw new BadRequestError("No fields to update", ERROR_CODES.VALIDATION_NO_FIELDS);
  }
  return changes;
}
