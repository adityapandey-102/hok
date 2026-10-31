import { ForbiddenError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { safeEqual } from "../../../common/crypto/credentials";

/**
 * There is no public sign-up (REQUIREMENTS FR-AUTH-02): the Admin creates
 * every other account directly, through the Users module, with a generated
 * password. Bootstrap exists solely to create the very first Admin on a fresh
 * install -- it refuses to run once any admin account exists, so it can't be
 * used to self-escalate after go-live.
 */
/**
 * Only the deployment owner may create the first Admin (security audit run 1:
 * first caller wins otherwise). They prove it with the BOOTSTRAP_TOKEN secret
 * from the server settings; unset means bootstrap is off. Compared in constant time.
 */
export function assertBootstrapKey(configured: string | undefined, supplied: string): void {
  if (!configured) throw new ForbiddenError("First-time setup is turned off on this server.", ERROR_CODES.AUTH_BOOTSTRAP_DISABLED);
  if (!safeEqual(configured, supplied)) throw new ForbiddenError("The setup key is not correct.", ERROR_CODES.AUTH_BOOTSTRAP_KEY_INVALID);
}

export function assertNoAdminExists(existingAdminCount: number): void {
  if (existingAdminCount > 0) {
    throw new ForbiddenError("An Admin account already exists. Ask the Admin to create your account.", ERROR_CODES.AUTH_BOOTSTRAP_ALREADY_DONE);
  }
}
