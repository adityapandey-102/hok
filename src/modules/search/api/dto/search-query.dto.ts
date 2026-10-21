import { z } from "zod";
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH } from "../../domain/search.rules";

/** GET /search?q= -- trimmed, 2 to 80 characters (shorter would match almost everything). */
export const searchQueryDtoSchema = z.object({
  q: z
    .string()
    .trim()
    .min(SEARCH_MIN_LENGTH, `Type at least ${SEARCH_MIN_LENGTH} characters`)
    .max(SEARCH_MAX_LENGTH, `At most ${SEARCH_MAX_LENGTH} characters`),
});
export type SearchQueryDto = z.infer<typeof searchQueryDtoSchema>;
