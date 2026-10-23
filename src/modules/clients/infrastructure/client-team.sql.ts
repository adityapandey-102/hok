import { sql, type AnyColumn, type SQL } from "drizzle-orm";
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
