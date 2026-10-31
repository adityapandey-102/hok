import { z } from "zod";
import { URL_MAX_LENGTH, isValidHttpUrl } from "../../../../domain";
import { ASSET_TAGS_MAX, ASSET_TAG_MAX_LENGTH, ASSET_TYPES } from "../../domain/asset.entity";
import { normalizeTags, tagsWithinLimits } from "../../domain/asset.rules";

/** Optional free text: trimmed, capped; "" or null clears it. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullable()
    
    .transform((v) => (v === "" ? null : v)).optional();
}

const version = z.number().int().min(1);
const uuid = (what: string) => z.string().uuid(`${what} must be an id`);

/** An http(s) link only (FR-AST-01): a javascript:, data: or relative URL is a 400. */
const url = z
  .string()
  .trim()
  .max(URL_MAX_LENGTH)
  .refine(isValidHttpUrl, "Enter a full link starting with http:// or https://");

/** Free-form tags (FR-AST-02): normalised (trimmed, de-duplicated ignoring case), then capped. */
const tags = z
  .array(z.string().max(ASSET_TAG_MAX_LENGTH * 2))
  .max(ASSET_TAGS_MAX * 2)
  .transform(normalizeTags)
  .refine(tagsWithinLimits, `At most ${ASSET_TAGS_MAX} tags, each up to ${ASSET_TAG_MAX_LENGTH} characters`);

/** POST /assets. Goes under one of the caller's clients; `eventId` (optional) must be one of that client's events. */
export const createAssetDtoSchema = z.object({
  clientId: uuid("clientId"),
  title: z.string().trim().min(1, "Please enter a title").max(160),
  url,
  type: z.enum(ASSET_TYPES),
  comment: optionalText(2000),
  eventId: uuid("eventId").nullable().optional(),
  tags: tags.optional(),
});
export type CreateAssetDto = z.infer<typeof createAssetDtoSchema>;

/**
 * PATCH /assets/:id. Every field optional (at least one, or 400
 * VALIDATION_NO_FIELDS); `version` required (stale = 409 ASSET_MODIFIED).
 * `tags` replaces the whole set; `eventId: null` unlinks. The client never changes.
 */
export const updateAssetDtoSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  url: url.optional(),
  type: z.enum(ASSET_TYPES).optional(),
  comment: optionalText(2000),
  eventId: uuid("eventId").nullable().optional(),
  tags: tags.optional(),
  version,
});
export type UpdateAssetDto = z.infer<typeof updateAssetDtoSchema>;

/** DELETE /assets/:id?version= -- version optional (the UI sends it; a stale one is 409). */
export const deleteAssetQuerySchema = z.object({ version: z.coerce.number().int().min(1).optional() });
export type DeleteAssetQuery = z.infer<typeof deleteAssetQuerySchema>;

export const ASSETS_DEFAULT_LIMIT = 20;
/** Page-size cap (docs/engineering-practices.md section 1): an over-large limit is clamped, never honoured. */
export const ASSETS_MAX_LIMIT = 100;

const blankToUndefined = (v: string | undefined) => (v ? v : undefined);
const limit = (def: number, max: number) =>
  z.coerce
    .number()
    .int()
    .optional()
    .transform((v) => Math.min(Math.max(v ?? def, 1), max));
const instant = z.string().datetime({ offset: true, message: "Use an ISO date-time with an offset, e.g. 2026-10-14T00:00:00+05:30" });

/**
 * GET /assets. Parsed strictly like GET /clients: an unknown type, a
 * malformed id or date, or a non-numeric limit/offset is a 400; an
 * out-of-range limit is clamped to 1..100.
 *
 * - `clientId`: one client's assets (the client workspace tab). Without it:
 *   every client in the caller's scope.
 * - `search`: title, comment or tag contains (case-insensitive).
 * - `tag`: exactly this tag, ignoring case.
 * - `from` / `to`: when it was added, ISO instants (the web sends the
 *   viewer's day boundaries); `from` inclusive, `to` exclusive.
 * - `ownerId`: the Admin's owner filter; ignored for a manager.
 */
export const assetQueryDtoSchema = z.object({
  clientId: uuid("clientId").optional(),
  eventId: uuid("eventId").optional(),
  ownerId: uuid("ownerId").optional(),
  search: z.string().trim().max(80).transform(blankToUndefined).optional(),
  type: z.enum(ASSET_TYPES).optional(),
  tag: z.string().trim().max(ASSET_TAG_MAX_LENGTH).transform(blankToUndefined).optional(),
  from: instant.optional(),
  to: instant.optional(),
  limit: limit(ASSETS_DEFAULT_LIMIT, ASSETS_MAX_LIMIT),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type AssetQueryDto = z.infer<typeof assetQueryDtoSchema>;

export const TAG_SUGGEST_DEFAULT_LIMIT = 10;
export const TAG_SUGGEST_MAX_LIMIT = 50;

/** GET /assets/tags: auto-suggest (FR-AST-03). `q` matches anywhere in the name; no `q` = the most used. */
export const tagQueryDtoSchema = z.object({
  clientId: uuid("clientId").optional(),
  q: z.string().trim().max(ASSET_TAG_MAX_LENGTH).transform(blankToUndefined).optional(),
  limit: limit(TAG_SUGGEST_DEFAULT_LIMIT, TAG_SUGGEST_MAX_LIMIT),
});
export type TagQueryDto = z.infer<typeof tagQueryDtoSchema>;
