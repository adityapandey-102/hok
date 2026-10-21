import type { SearchHit, SearchScope } from "../../domain/search.rules";

/** One capped query per group: hits whose text contains `term` (case-insensitive), best first. */
export interface SearchRepositoryPort {
  clients(term: string, scope: SearchScope, limit: number): Promise<SearchHit[]>;
  events(term: string, scope: SearchScope, limit: number): Promise<SearchHit[]>;
  tasks(term: string, scope: SearchScope, limit: number): Promise<SearchHit[]>;
  todos(term: string, scope: SearchScope, limit: number): Promise<SearchHit[]>;
  assets(term: string, scope: SearchScope, limit: number): Promise<SearchHit[]>;
}
