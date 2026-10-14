import { BadRequestError, ConflictError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";

/**
 * Template rules (FR-EVT-01). A template's stages are always sent and stored
 * as one ordered list: an edit that renames, reorders, adds or removes stages
 * replaces the list. Events copy the stages they start with, so nothing ever
 * points at a template's stage rows.
 */

/** Trims each stage name; refuses a blank or a repeat (case-insensitive), since "Shoot" twice makes a tracker meaningless. */
export function normalizeStageNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  return names.map((raw) => {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) {
      throw new BadRequestError(
        name ? `The stage "${name}" appears twice` : "Stage names can't be blank",
        ERROR_CODES.STAGE_TEMPLATE_STAGES_INVALID,
      );
    }
    seen.add(key);
    return name;
  });
}

/** Optimistic lock for template edits (the Admin may edit from two tabs). */
export function assertTemplateVersion(current: number, expected: number | undefined): void {
  if (expected !== undefined && current !== expected) {
    throw new ConflictError("This template was changed by someone else. Reload and try again.", ERROR_CODES.STAGE_TEMPLATE_MODIFIED);
  }
}
