import { sql, type SQL } from "drizzle-orm";
import { CLIENT_MANAGER_ROLES } from "../../../domain";
import { clientMembers } from "../../clients/infrastructure/clients.schema";

/**
 * "Who may decide this approval", as ONE SQL predicate, so the inbox (`to_decide`), the badge, the dashboard and
 * the notification recipients are all worked out in the database -- paging and counts are never done in memory.
 *
 * It restates the pure rules in src/domain/stage-approvals.ts (canSeeApprovalItem + matchesApprover + self-approval);
 * the unit and integration tests keep the two in step. Every fragment is a SQL expression, so the same predicate runs
 * for "this caller vs. each approval row" and for "each profile vs. this one approval".
 */

/** The person: SQL for their id (uuid) and role (text). */
export interface WhoSql {
  id: SQL;
  role: SQL;
}

/** The approval and its item: SQL for each fact the rules read. */
export interface ItemSql {
  /** boolean: an event approval (else a task one). */
  isEvent: SQL;
  /** The item's client id (null for a task without a client: it has no team). */
  clientId: SQL;
  assigneeId: SQL;
  assignedBy: SQL;
  /** text[]: the stage's approver tokens. */
  approvers: SQL;
  requestedBy: SQL;
}

const MANAGER_ROLES = sql.join(CLIENT_MANAGER_ROLES.map((r) => sql`${r}`), sql`, `);

const onTeam = (clientId: SQL, who: WhoSql): SQL =>
  sql`exists (select 1 from ${clientMembers} where ${clientMembers.clientId} = ${clientId} and ${clientMembers.profileId} = ${who.id})`;

/** canSeeApprovalItem: the Admin; an event: a manager on the team; a task: assignee, creator or a manager on the team. */
export function canSeeItemSql(who: WhoSql, item: ItemSql): SQL {
  const manager = sql`(${who.role} in (${MANAGER_ROLES}) and ${onTeam(item.clientId, who)})`;
  return sql`(${who.role} = 'admin' or (${item.isEvent} and ${manager}) or (not ${item.isEvent} and (${who.id} = ${item.assigneeId} or ${who.id} = ${item.assignedBy} or ${manager})))`;
}

/** matchesApprover: the role equals a token ('admin' included), or 'team_managers' and a manager on the team. 'client' matches no staff member. */
export function approverMatchSql(who: WhoSql, item: ItemSql): SQL {
  return sql`(${who.role} = any(${item.approvers}) or ('team_managers' = any(${item.approvers}) and ${who.role} in (${MANAGER_ROLES}) and ${onTeam(item.clientId, who)}))`;
}

/** canDecide: sees the item, matches a token, and isn't deciding their own request (the Admin may). */
export function canDecideSql(who: WhoSql, item: ItemSql): SQL {
  return sql`(${canSeeItemSql(who, item)} and ${approverMatchSql(who, item)} and (${who.role} = 'admin' or ${item.requestedBy} is distinct from ${who.id}))`;
}

/** The signed-in caller as SQL (typed parameters, so Postgres never has to guess). */
export function whoParams(userId: string, role: string): WhoSql {
  return { id: sql`${userId}::uuid`, role: sql`${role}::text` };
}
