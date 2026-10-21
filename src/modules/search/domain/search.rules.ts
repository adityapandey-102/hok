import { getCapabilityScope, type Capability, type Role } from "../../../domain";

/**
 * Global search (REQUIREMENTS FR-SYS-01): one box over clients, events,
 * staff tasks, client to-dos and asset links, scoped exactly like the pages
 * that list them. Each group is one capped, indexed query (trigram on the
 * searched text); the groups run in parallel.
 */
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 80;
export const SEARCH_PER_GROUP = 5;

export const SEARCH_GROUPS = ["clients", "events", "tasks", "todos", "assets"] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

/** Who may see what in a group: every row, or only the caller's own (their clients / their tasks). */
export type SearchScope = { kind: "all" } | { kind: "own"; userId: string };

/** The capability that lists each group's records (the same one its page uses). */
const GROUP_CAPABILITY: Record<SearchGroup, Capability> = {
  clients: "clients:read",
  events: "events:read",
  tasks: "staff_tasks:read",
  todos: "clients:read",
  assets: "assets:read",
};

/** Per group: the caller's scope, or null when their role can't see that kind of record at all. */
export function searchPlan(caller: { userId: string; role: Role }): Record<SearchGroup, SearchScope | null> {
  const plan = {} as Record<SearchGroup, SearchScope | null>;
  for (const g of SEARCH_GROUPS) {
    const scope = getCapabilityScope(caller.role, GROUP_CAPABILITY[g]);
    plan[g] = scope === false ? null : scope === "own" ? { kind: "own", userId: caller.userId } : { kind: "all" };
  }
  return plan;
}

export interface SearchHit {
  id: string;
  title: string;
  /** One line of context: the client, a date, a status. */
  subtitle: string | null;
  /** Where clicking the hit goes (a page in the staff app). */
  url: string;
}

export interface SearchResult {
  query: string;
  /** Null for a group the caller's role can't search (the web hides it). */
  groups: Record<SearchGroup, SearchHit[] | null>;
}
