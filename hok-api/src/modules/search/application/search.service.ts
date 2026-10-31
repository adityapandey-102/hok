import type { Role } from "../../../domain";
import { SEARCH_GROUPS, SEARCH_PER_GROUP, searchPlan, type SearchGroup, type SearchHit, type SearchResult } from "../domain/search.rules";
import type { SearchRepositoryPort } from "./ports/search-repository.port";

/**
 * Runs the groups the caller may see, in parallel; a group their role can't
 * see is never queried and comes back null.
 */
export class SearchService {
  constructor(private readonly repo: SearchRepositoryPort) {}

  async search(caller: { userId: string; role: Role }, query: string): Promise<SearchResult> {
    const plan = searchPlan(caller);
    const results = await Promise.all(
      SEARCH_GROUPS.map((g) => {
        const scope = plan[g];
        return scope ? this.repo[g](query, scope, SEARCH_PER_GROUP) : Promise.resolve(null);
      }),
    );
    const groups = Object.fromEntries(SEARCH_GROUPS.map((g, i) => [g, results[i]])) as Record<SearchGroup, SearchHit[] | null>;
    return { query, groups };
  }
}
