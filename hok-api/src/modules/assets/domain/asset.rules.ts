import { BadRequestError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { ASSET_TAGS_MAX, ASSET_TAG_MAX_LENGTH, type AssetEntity } from "./asset.entity";

/**
 * Asset rules (FR-AST-01..07). Pure functions that throw AppError (ADR 0002).
 * An asset inherits its client's row scope: a manager sees only assets of
 * clients they own; anything else is a 404.
 */

/** Same shape as the Clients module's scope (kept local: domains don't import each other, ADR 0003). */
export type AssetScope = { kind: "all" } | { kind: "own"; userId: string };

/** The client a new asset goes under, as stored. */
export interface AssetClient {
  id: string;
  /** The client's team: who may see this (internal, never sent to the browser). */
  teamIds: string[];
  status: "active" | "paused" | "archived";
}

/** The event an asset may be linked to. */
export interface AssetEvent {
  id: string;
  clientId: string;
}

export function assertAssetVisible(scope: AssetScope, asset: Pick<AssetEntity, "teamIds"> | null): void {
  if (!asset || (scope.kind === "own" && !asset.teamIds.includes(scope.userId))) {
    throw new NotFoundError("Asset not found", ERROR_CODES.ASSET_NOT_FOUND);
  }
}

/** The client for a new asset: must be visible (else 404 CLIENT_NOT_FOUND) and not archived (409 CLIENT_ARCHIVED). */
export function assertClientUsable(scope: AssetScope, client: AssetClient | null): AssetClient {
  if (!client || (scope.kind === "own" && !client.teamIds.includes(scope.userId))) {
    throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
  }
  assertClientWritable(client.status);
  return client;
}

/** An archived client's assets are read-only until the client is unarchived. */
export function assertClientWritable(clientStatus: AssetClient["status"]): void {
  if (clientStatus === "archived") {
    throw new ConflictError("This client is archived, so its assets are read-only. Unarchive the client first.", ERROR_CODES.CLIENT_ARCHIVED);
  }
}

/** Optimistic lock: `undefined` = the caller didn't send a version (allowed only where documented, e.g. delete). */
export function assertAssetVersion(current: number, expected: number | undefined): void {
  if (expected !== undefined && current !== expected) {
    throw new ConflictError("This asset was changed by someone else. Reload and try again.", ERROR_CODES.ASSET_MODIFIED);
  }
}

/** FR-EVT-08: a linked event must exist and belong to the asset's own client. */
export function assertEventLinkable(clientId: string, event: AssetEvent | null): void {
  if (!event || event.clientId !== clientId) {
    throw new BadRequestError("Pick one of this client's events", ERROR_CODES.ASSET_EVENT_INVALID);
  }
}

/**
 * Tags as typed: trimmed, inner whitespace collapsed, a leading "#" dropped,
 * empties removed, de-duplicated ignoring case (the first spelling wins).
 * Whether the result fits the caps is `tagsWithinLimits`' job.
 */
export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of raw) {
    const name = tag.replace(/^#+/, "").replace(/\s+/g, " ").trim();
    if (name === "") continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function tagsWithinLimits(tags: readonly string[]): boolean {
  return tags.length <= ASSET_TAGS_MAX && tags.every((t) => t.length <= ASSET_TAG_MAX_LENGTH);
}

/** A calendar-independent check for the list's date filter: `from` must not be after `to`. */
export function assertRange(from: Date | undefined, to: Date | undefined): void {
  if (from && to && from.getTime() > to.getTime()) {
    throw new BadRequestError("`from` must not be after `to`", ERROR_CODES.ASSET_RANGE_INVALID);
  }
}
