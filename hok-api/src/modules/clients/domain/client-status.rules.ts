import { ConflictError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import type { ClientStatus } from "./client.entity";

/**
 * Status lifecycle (FR-CLI-02, FR-CLI-07):
 *
 *   active <-> paused        (a normal edit, PATCH { status })
 *   active | paused -> archived   (POST /clients/:id/archive: hidden from active
 *                                  lists, data kept, archived_at stamped)
 *   archived -> active       (POST /clients/:id/unarchive)
 *
 * An archived client is read-only until it's unarchived -- you can't edit it
 * or pause it. Only the Admin's reassign still works on it (ownership isn't
 * part of the profile). All of these are 409s: the request is well-formed, it
 * just doesn't fit the client's current state.
 */

/** Optimistic lock: the caller's copy must be the current one. `undefined` = the caller didn't send a version (allowed only where documented). */
export function assertVersion(current: number, expected: number | undefined): void {
  if (expected !== undefined && current !== expected) {
    throw new ConflictError("This client was changed by someone else. Reload and try again.", ERROR_CODES.CLIENT_MODIFIED);
  }
}

/** Profile edits (and status changes between active and paused) need a client that isn't archived. */
export function assertEditable(status: ClientStatus): void {
  if (status === "archived") {
    throw new ConflictError("This client is archived. Unarchive it before making changes.", ERROR_CODES.CLIENT_ARCHIVED);
  }
}

export function assertArchivable(status: ClientStatus): void {
  if (status === "archived") {
    throw new ConflictError("This client is already archived", ERROR_CODES.CLIENT_ARCHIVED);
  }
}

export function assertUnarchivable(status: ClientStatus): void {
  if (status !== "archived") {
    throw new ConflictError("This client isn't archived", ERROR_CODES.CLIENT_NOT_ARCHIVED);
  }
}
