import type { ActivityFilter, ActivityRow } from "../../domain/activity.entity";

/**
 * Read-only feed over audit_log and the four typed history tables. `page` is
 * ONE query (UNION ALL of per-source selects, bounded and filtered before the
 * union, then ordered and limited, names joined only for the page's rows);
 * `count` is one more over the same union.
 */
export interface ActivityRepositoryPort {
  page(filter: ActivityFilter, limit: number, offset: number): Promise<ActivityRow[]>;
  count(filter: ActivityFilter): Promise<number>;
}
