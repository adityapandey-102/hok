import { inArray } from "drizzle-orm";
import { db } from "../../src/common/database/drizzle-client";
import { clients } from "../../src/modules/clients/infrastructure/clients.schema";
import { events } from "../../src/modules/events/infrastructure/events.schema";
import { stageTemplates } from "../../src/modules/stage-templates/infrastructure/stage-templates.schema";
import { supabaseClient } from "../../src/common/database/supabase-client";
import { authProvider } from "../../src/common/auth/supabase-auth-provider";
import type { Role } from "../../src/domain";

/**
 * Shared fixtures for integration tests. Creates/tears down against the
 * real local Supabase stack (`npx supabase start`) -- these tests need
 * DATABASE_URL/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY set (see .env), same
 * as running the app itself. No mocks: this is the point of an integration
 * test in this codebase's testing pyramid (see CLAUDE.md).
 *
 * Fixture creation goes through `authProvider.createUser` directly (not
 * the HTTP layer) so a test can mint an account of any role on demand
 * without the once-only bootstrap rule getting in the way -- the same
 * bypass-the-Application-layer pattern `src/db/seed.ts` uses.
 */

export interface FixtureUser {
  id: string;
  email: string;
  password: string;
  role: Role;
}

let counter = 0;
function uniqueEmail(role: Role): string {
  counter += 1;
  return `it-${role}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 6)}@hok.test`;
}

export async function createFixtureUser(role: Role, fullName: string): Promise<FixtureUser> {
  const email = uniqueEmail(role);
  const password = `Test-${Math.random().toString(36).slice(2, 10)}!1`;
  const id = await authProvider.createUser({ email, password, fullName, role });
  return { id, email, password, role };
}

/**
 * Signs a fixture in through the provider directly (not POST /auth/login), so
 * test setup doesn't spend the in-memory /auth/* rate-limit budget. Returns
 * the ready-to-use Authorization header value.
 */
export async function bearerFor(user: FixtureUser): Promise<string> {
  const session = await authProvider.signInWithPassword(user.email, user.password);
  return `Bearer ${session.accessToken}`;
}

/** Deletes the auth user -- cascades to `profiles` via `on delete cascade` (see supabase/migrations/20261013000001_profiles.sql). */
export async function deleteFixtureUser(userId: string): Promise<void> {
  await supabaseClient.auth.admin.deleteUser(userId).catch(() => {
    // Best-effort teardown -- a test that already failed shouldn't also fail on cleanup.
  });
}

/**
 * Deletes the clients these fixture users own. clients.owner_id is ON DELETE
 * RESTRICT (a client never disappears with a person), so a test that creates
 * clients must call this before deleteFixtureUser for their owners. Their
 * events go first (events.client_id is RESTRICT too; stages and history
 * cascade). Fixture data only -- the API has no client or event delete.
 */
export async function deleteClientsOwnedBy(ownerIds: string[]): Promise<void> {
  if (ownerIds.length === 0) return;
  const owned = db.select({ id: clients.id }).from(clients).where(inArray(clients.ownerId, ownerIds));
  await db.delete(events).where(inArray(events.clientId, owned));
  await db.delete(clients).where(inArray(clients.ownerId, ownerIds));
}

/**
 * Deletes fixture stage templates by id (their stages cascade; events made
 * from them keep their copies, template_id goes null). The API never deletes
 * templates -- fixture cleanup only.
 */
export async function deleteStageTemplates(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(stageTemplates).where(inArray(stageTemplates.id, ids));
}

/** Call once in an `afterAll` per test file so the Postgres pool doesn't keep the process alive. */
export async function closeDb(): Promise<void> {
  await db.$client.end();
}
