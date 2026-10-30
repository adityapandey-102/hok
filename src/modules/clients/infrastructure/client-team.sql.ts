import { sql, type AnyColumn, type SQL } from "drizzle-orm";
import { CLIENT_MANAGER_ROLES } from "../../../domain";
import { clientMembers } from "./clients.schema";

/**
 * The one definition of "this person is on this client's team", shared by
 * every module that scopes by client (events, assets, to-dos, comments,
 * portal, calendar, dashboard, reports, search). Other modules import it
 * Infrastructure-to-Infrastructure (docs/adr/0003), never re-spell it.
 * Both forms hit the client_members primary key / profile index.
 */

/** WHERE condition: `clientId` (a column holding a client id) has `userId` on its team. */
export function isOnTeam(clientId: AnyColumn | SQL, userId: string): SQL {
  return sql`exists (select 1 from ${clientMembers} where ${clientMembers.clientId} = ${clientId} and ${clientMembers.profileId} = ${userId})`;
}

/** SELECT field: the team's profile ids, for a guard that checks membership in memory after a lock. */
export function teamIdsOf(clientId: AnyColumn | SQL): SQL<string[]> {
  return sql<string[]>`array(select ${clientMembers.profileId} from ${clientMembers} where ${clientMembers.clientId} = ${clientId})`;
}

/** SQL condition on a client_members row aliased `m`: its person is an active client manager. */
const NOTIFIABLE_MEMBER = sql`exists (select 1 from public.profiles p where p.id = m.profile_id and p.active and p.role in (${sql.join(
  CLIENT_MANAGER_ROLES.map((r) => sql`${r}`),
  sql`, `,
)}))`;

/**
 * The team members to NOTIFY about the client (portal comments, event reminders):
 * only active client managers. Someone deactivated, or moved to a task-only role,
 * since joining stays listed on the team until the Admin takes them off, but
 * hears nothing more about the client. (Profiles are matched in a nested EXISTS so
 * an unqualified outer `id` can never bind to profiles.id.)
 */
export function notifiedTeamIdsOf(clientId: AnyColumn | SQL): SQL<string[]> {
  return sql<string[]>`array(select m.profile_id from ${clientMembers} m where m.client_id = ${clientId} and ${NOTIFIABLE_MEMBER})`;
}

