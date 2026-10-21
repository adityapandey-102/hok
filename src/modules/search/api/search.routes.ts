import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateQuery } from "../../../common/http/validate.middleware";
import { SearchService } from "../application/search.service";
import { DrizzleSearchRepository } from "../infrastructure/drizzle-search.repository";
import { searchQueryDtoSchema, type SearchQueryDto } from "./dto/search-query.dto";

/** Composition root for global search (read-only; owns no table). */
const service = new SearchService(new DrizzleSearchRepository());

export const searchRouter = Router();

// Every staff role; each group is scoped by the caller's own capabilities.
searchRouter.use(requireAuth);

/** FR-SYS-01: up to 5 hits per group the caller may see; groups they can't see are null. */
searchRouter.get(
  "/",
  validateQuery(searchQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const { q } = req.query as unknown as SearchQueryDto;
    res.json(await service.search({ userId: req.profile!.id, role: req.profile!.role }, q));
  }),
);
