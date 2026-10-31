/** One row of a server-searched picker (SearchSelect). `data` carries anything the caller needs on selection (e.g. a role). */
export interface SelectOption<T = unknown> {
  id: string;
  label: string;
  hint?: string;
  data?: T;
}

/** Every picker search asks the API for at most this many rows (the user types to narrow). */
export const SEARCH_SELECT_LIMIT = 20;

/** Merge several option lists: de-duplicated by id, sorted by label, capped. */
export function mergeOptions<T>(lists: SelectOption<T>[][], cap = SEARCH_SELECT_LIMIT): SelectOption<T>[] {
  const seen = new Set<string>();
  const merged: SelectOption<T>[] = [];
  for (const o of lists.flat()) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    merged.push(o);
  }
  return merged.sort((a, b) => a.label.localeCompare(b.label)).slice(0, cap);
}
