import { ForbiddenError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";

/**
 * There is no public sign-up (REQUIREMENTS FR-AUTH-02): the Admin creates
 * every other account directly, through the Users module, with a generated
 * password. Bootstrap exists solely to create the very first Admin on a fresh
 * install -- it refuses to run once any admin account exists, so it can't be
 * used to self-escalate after go-live.
 */
export function assertNoAdminExists(existingAdminCount: number): void {
  if (existingAdminCount > 0) {
    throw new ForbiddenError("An Admin account already exists. Ask the Admin to create your account.", ERROR_CODES.AUTH_BOOTSTRAP_ALREADY_DONE);
  }
}
