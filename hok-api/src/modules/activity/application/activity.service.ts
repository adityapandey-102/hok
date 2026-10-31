import type { ActivityFilterKind, ActivityPage } from "../domain/activity.entity";
import { resolveActivityRange, toActivityItem } from "../domain/activity.rules";
import type { ActivityRepositoryPort } from "./ports/activity-repository.port";

export interface ActivityQuery {
  from?: Date;
  to?: Date;
  kind: ActivityFilterKind;
  actorId?: string;
  limit: number;
  offset: number;
}

/** The Admin's activity log. Two queries per request, whatever the page size. */
export class ActivityService {
  constructor(
    private readonly repo: ActivityRepositoryPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(q: ActivityQuery): Promise<ActivityPage> {
    const range = resolveActivityRange({ from: q.from, to: q.to }, this.clock());
    const filter = { ...range, kind: q.kind, actorId: q.actorId };
    const [rows, total] = await Promise.all([this.repo.page(filter, q.limit, q.offset), this.repo.count(filter)]);
    return { items: rows.map(toActivityItem), total, limit: q.limit, offset: q.offset };
  }
}
