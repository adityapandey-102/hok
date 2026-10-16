import { Router, type Request } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody, validateQuery } from "../../../common/http/validate.middleware";
import { uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { AssetsService, type AssetsCaller } from "../application/assets.service";
import { DrizzleAssetsRepository } from "../infrastructure/drizzle-assets.repository";
import {
  assetQueryDtoSchema,
  createAssetDtoSchema,
  deleteAssetQuerySchema,
  tagQueryDtoSchema,
  updateAssetDtoSchema,
  type AssetQueryDto,
  type CreateAssetDto,
  type TagQueryDto,
  type UpdateAssetDto,
} from "./dto/asset.dto";

/** Composition root for the Assets module. */
const service = new AssetsService(new DrizzleAssetsRepository());

export const assetsRouter = Router();

// Admin (every asset) and SMM / MM (assets of clients they own; others' are
// 404); task-only staff get 403. Writes need assets:write.
assetsRouter.use(requireAuth, requireCapability("assets:read"));
assetsRouter.param("id", uuidParam(ERROR_CODES.ASSET_NOT_FOUND, "Asset"));

const callerOf = (req: Request): AssetsCaller => ({ userId: req.authUserId!, role: req.profile!.role });

assetsRouter.get(
  "/",
  validateQuery(assetQueryDtoSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.list(callerOf(req), req.query as unknown as AssetQueryDto));
  }),
);

// Declared before "/:id" so "tags" is never read as an asset id.
assetsRouter.get(
  "/tags",
  validateQuery(tagQueryDtoSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.suggestTags(callerOf(req), req.query as unknown as TagQueryDto));
  }),
);

assetsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ asset: await service.get(callerOf(req), req.params.id!) });
  }),
);

assetsRouter.post(
  "/",
  requireCapability("assets:write"),
  validateBody(createAssetDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ asset: await service.create(callerOf(req), req.body as CreateAssetDto) });
  }),
);

assetsRouter.patch(
  "/:id",
  requireCapability("assets:write"),
  validateBody(updateAssetDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ asset: await service.update(callerOf(req), req.params.id!, req.body as UpdateAssetDto) });
  }),
);

/** FR-AST-06: soft delete. */
assetsRouter.delete(
  "/:id",
  requireCapability("assets:write"),
  validateQuery(deleteAssetQuerySchema),
  asyncHandler(async (req, res) => {
    await service.remove(callerOf(req), req.params.id!, req.query);
    res.status(204).end();
  }),
);
