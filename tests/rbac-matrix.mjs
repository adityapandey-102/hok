/**
 * A small, self-contained per-role API check (200/201/204/400/401/403) that
 * exercises the live capability matrix over HTTP -- so it runs identically
 * against localhost and a hosted API. It's the "zero code changes" proof of the
 * backend's authorization behaviour, not a replacement for the unit and
 * integration suites. needleye's pattern (its tests/rbac-matrix.mjs).
 *
 * Covers all SIX roles. Every new endpoint adds its cases here
 * (docs/engineering-practices.md, "Every new endpoint gets a row in the RBAC matrix").
 *   M2: /auth/me (read + self-edit), /auth/bootstrap gate, users:manage
 *       (list, get, create, edit, generate-password, deactivate, reactivate)
 *       and the Admin self-protection rules.
 *   M3: /clients (list, get, create incl. owner choice, edit + stale version,
 *       archive/unarchive, reassign): Admin all, SMM/MM own (others are 404),
 *       task-only 403. Needs migration 20261013000003_clients.sql. Its fixture
 *       clients are archived at the end (no delete endpoint).
 *   M4: /stage-templates (Admin writes; managers read) and /events (create,
 *       list, get, edit, stage move + stale version) for all six roles. Needs
 *       migration 20261013000004. Its template is deactivated at the end.
 *
 * Creates its own fixtures (one fresh account per non-admin role) every run,
 * so it never depends on `npm run seed` beyond the admin account it signs in
 * as. Like needleye's, it never deletes what it creates: the API has no
 * delete-user endpoint on purpose (deactivate instead). It deactivates its
 * fixtures at the end so they can't sign in, but they stay in the users list.
 *
 * Usage: npm run test:rbac  (API must be running; needs an existing admin's credentials)
 *   API_BASE_URL=http://localhost:4100/api/v1 \
 *   SEED_ADMIN_EMAIL=admin@hok.test SEED_ADMIN_PASSWORD=... npm run test:rbac
 *
 * It signs in 7 times (+1 refused attempt); /auth/* allows AUTH_RATE_LIMIT_MAX
 * (default 30) per 15 minutes per IP. On a 429 locally, restart the dev API
 * (touch src/index.ts) to clear the in-memory counter.
 */
const BASE = process.env.API_BASE_URL ?? "http://localhost:4100/api/v1";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@hok.test";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error("Set SEED_ADMIN_PASSWORD to an existing admin account's password before running this (local seed: see src/db/seed.ts).");
  process.exit(1);
}

async function req(path, opts = {}, token) {
  const headers = { "Content-Type": "application/json", ...(opts.headers ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body (e.g. 204) -- fine, body stays null
  }
  return { status: res.status, body };
}

async function login(email, password) {
  const r = await req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return { token: r.body.accessToken, profile: r.body.profile };
}

const results = [];
function check(label, actual, expected) {
  const pass = actual === expected;
  results.push({ label, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  (expected ${expected}, got ${actual})`);
}

const NON_ADMIN_ROLES = ["social_media_manager", "marketing_manager", "marketing_agent", "developer", "editor"];

async function main() {
  const stamp = Date.now();
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (admin.profile.role !== "admin") throw new Error(`${ADMIN_EMAIL} is not an admin (role: ${admin.profile.role})`);

  // One fresh account per non-admin role, created by the admin.
  const staff = {};
  for (const role of NON_ADMIN_ROLES) {
    const email = `rbac-${role.replace(/_/g, "-")}-${stamp}@hok.test`;
    const r = await req("/users", { method: "POST", body: JSON.stringify({ email, fullName: `RBAC ${role}`, role }) }, admin.token);
    if (r.status !== 201) throw new Error(`failed to create ${role} fixture: ${r.status} ${JSON.stringify(r.body)}`);
    staff[role] = { id: r.body.userId, email, password: r.body.password };
  }
  for (const role of NON_ADMIN_ROLES) {
    staff[role].token = (await login(staff[role].email, staff[role].password)).token;
  }
  const everyone = [["admin", admin.token], ...NON_ADMIN_ROLES.map((role) => [role, staff[role].token])];
  // A target account the per-role user-management checks act on.
  const target = staff.editor;

  console.log("\n--- authentication ---");
  check("GET /auth/me without a token -> 401", (await req("/auth/me")).status, 401);
  check("GET /users without a token -> 401", (await req("/users")).status, 401);
  check("PATCH /auth/me without a token -> 401", (await req("/auth/me", { method: "PATCH", body: "{}" })).status, 401);
  check("GET /auth/me with a garbage token -> 401", (await req("/auth/me", {}, "not-a-token")).status, 401);

  console.log("\n--- bootstrap (public, self-disabling) ---");
  const status = await req("/auth/bootstrap-status");
  check("GET /auth/bootstrap-status without a token -> 200", status.status, 200);
  check("bootstrap-status reports adminExists = true", status.body?.adminExists, true);
  check(
    "POST /auth/bootstrap once an admin exists -> 403",
    (await req("/auth/bootstrap", { method: "POST", body: JSON.stringify({ email: `rbac-boot-${stamp}@hok.test`, password: "Secret-123", fullName: "Nope" }) })).status,
    403,
  );

  console.log("\n--- own profile (every role) ---");
  for (const [role, token] of everyone) {
    const me = await req("/auth/me", {}, token);
    check(`GET /auth/me as ${role} -> 200`, me.status, 200);
    check(`GET /auth/me as ${role} reports role ${role}`, me.body?.profile?.role, role);
  }
  for (const [role, token] of everyone) {
    const zone = role === "admin" ? admin.profile.timeZone : "Europe/London";
    check(`PATCH /auth/me (time zone) as ${role} -> 200`, (await req("/auth/me", { method: "PATCH", body: JSON.stringify({ timeZone: zone }) }, token)).status, 200);
  }
  const escalate = await req("/auth/me", { method: "PATCH", body: JSON.stringify({ role: "admin", fullName: "RBAC editor" }) }, target.token);
  check("PATCH /auth/me with role: admin as editor -> 200 (role ignored)", escalate.status, 200);
  check("... and the editor is still an editor", escalate.body?.profile?.role, "editor");

  console.log("\n--- clients (admin: all; SMM / MM: own, others' are 404; task-only: 403) ---");
  // Runs before the users section: regenerating the editor's password there
  // revokes the editor's live sessions, and these checks need that token.
  const smm = staff.social_media_manager;
  const mm = staff.marketing_manager;
  const TASK_ONLY = ["marketing_agent", "developer", "editor"];
  const newClient = (name, extra = {}) => JSON.stringify({ businessName: `RBAC ${name} ${stamp}`, ...extra });

  for (const [role, token] of everyone) {
    const expected = TASK_ONLY.includes(role) ? 403 : 200;
    check(`GET /clients as ${role} -> ${expected}`, (await req("/clients", {}, token)).status, expected);
  }
  const created = {};
  for (const [role, token] of everyone) {
    const expected = TASK_ONLY.includes(role) ? 403 : 201;
    const r = await req("/clients", { method: "POST", body: newClient(role) }, token);
    check(`POST /clients as ${role} -> ${expected}`, r.status, expected);
    if (r.status === 201) created[role] = r.body.client;
  }
  const smmClient = created.social_media_manager;
  check("POST /clients by SMM is owned by the SMM", smmClient?.ownerId, smm.id);
  check(
    "POST /clients { ownerId: MM } as SMM -> 403 (only Admin picks the owner)",
    (await req("/clients", { method: "POST", body: newClient("smm-for-mm", { ownerId: mm.id }) }, smm.token)).status,
    403,
  );
  const adminForMm = await req("/clients", { method: "POST", body: newClient("admin-for-mm", { ownerId: mm.id }) }, admin.token);
  check("POST /clients { ownerId: MM } as admin -> 201", adminForMm.status, 201);
  check("... owned by the MM", adminForMm.body?.client?.ownerId, mm.id);
  check(
    "POST /clients { ownerId: editor } as admin -> 400 (task-only can't own clients)",
    (await req("/clients", { method: "POST", body: newClient("admin-for-editor", { ownerId: target.id }) }, admin.token)).status,
    400,
  );

  const smmList = await req(`/clients?ownerId=${mm.id}&limit=100`, {}, smm.token);
  check("GET /clients as SMM lists only the SMM's own clients (ownerId filter ignored)", smmList.body?.clients?.every((c) => c.ownerId === smm.id), true);

  // One client (the SMM's), every role, every action. Admin acts last so versions stay predictable.
  const cid = smmClient.id;
  const readExpect = { admin: 200, social_media_manager: 200, marketing_manager: 404, marketing_agent: 403, developer: 403, editor: 403 };
  for (const [role, token] of everyone) {
    check(`GET /clients/:id (SMM's) as ${role} -> ${readExpect[role]}`, (await req(`/clients/${cid}`, {}, token)).status, readExpect[role]);
  }
  for (const [role, token] of everyone.filter(([r]) => r !== "admin" && r !== "social_media_manager")) {
    const expected = readExpect[role];
    const patch = JSON.stringify({ notes: "nope", version: 1 });
    check(`PATCH /clients/:id (SMM's) as ${role} -> ${expected}`, (await req(`/clients/${cid}`, { method: "PATCH", body: patch }, token)).status, expected);
    check(`POST /clients/:id/archive (SMM's) as ${role} -> ${expected}`, (await req(`/clients/${cid}/archive`, { method: "POST", body: "{}" }, token)).status, expected);
    check(`POST /clients/:id/unarchive (SMM's) as ${role} -> ${expected}`, (await req(`/clients/${cid}/unarchive`, { method: "POST", body: "{}" }, token)).status, expected);
  }
  const ownEdit = await req(`/clients/${cid}`, { method: "PATCH", body: JSON.stringify({ notes: "mine", version: 1 }) }, smm.token);
  check("PATCH /clients/:id (own) as SMM -> 200", ownEdit.status, 200);
  check(
    "PATCH /clients/:id with the stale version -> 409",
    (await req(`/clients/${cid}`, { method: "PATCH", body: JSON.stringify({ notes: "again", version: 1 }) }, smm.token)).status,
    409,
  );
  check("POST /clients/:id/archive (own) as SMM -> 200", (await req(`/clients/${cid}/archive`, { method: "POST", body: "{}" }, smm.token)).status, 200);
  check("POST /clients/:id/unarchive (own) as SMM -> 200", (await req(`/clients/${cid}/unarchive`, { method: "POST", body: "{}" }, smm.token)).status, 200);
  check(
    "PATCH /clients/:id (SMM's) as admin -> 200",
    (await req(`/clients/${cid}`, { method: "PATCH", body: JSON.stringify({ industry: "Retail", version: 4 }) }, admin.token)).status,
    200,
  );

  for (const [role, token] of everyone.filter(([r]) => r !== "admin")) {
    check(
      `POST /clients/:id/reassign as ${role} -> 403`,
      (await req(`/clients/${cid}/reassign`, { method: "POST", body: JSON.stringify({ ownerId: mm.id }) }, token)).status,
      403,
    );
  }
  check(
    "POST /clients/:id/reassign to an editor as admin -> 400",
    (await req(`/clients/${cid}/reassign`, { method: "POST", body: JSON.stringify({ ownerId: target.id }) }, admin.token)).status,
    400,
  );
  check(
    "POST /clients/:id/reassign to the MM as admin -> 200",
    (await req(`/clients/${cid}/reassign`, { method: "POST", body: JSON.stringify({ ownerId: mm.id }) }, admin.token)).status,
    200,
  );
  check("... the SMM no longer sees it -> 404", (await req(`/clients/${cid}`, {}, smm.token)).status, 404);
  check("... the MM now does -> 200", (await req(`/clients/${cid}`, {}, mm.token)).status, 200);
  // Fixture clients are archived, not deleted (there is no client delete endpoint).
  for (const c of [...Object.values(created), adminForMm.body?.client].filter(Boolean)) {
    await req(`/clients/${c.id}/archive`, { method: "POST", body: "{}" }, admin.token);
  }

  console.log("\n--- stage templates (admin writes; SMM / MM read active; task-only: 403) ---");
  for (const [role, token] of everyone) {
    const expected = TASK_ONLY.includes(role) ? 403 : 200;
    check(`GET /stage-templates as ${role} -> ${expected}`, (await req("/stage-templates", {}, token)).status, expected);
  }
  const tplBody = (name) => JSON.stringify({ name: `RBAC ${name} ${stamp}`, stages: ["Planned", "Shoot", "Done"] });
  for (const [role, token] of everyone.filter(([r]) => r !== "admin")) {
    check(`POST /stage-templates as ${role} -> 403`, (await req("/stage-templates", { method: "POST", body: tplBody(role) }, token)).status, 403);
  }
  const tpl = await req("/stage-templates", { method: "POST", body: tplBody("template") }, admin.token);
  check("POST /stage-templates as admin -> 201", tpl.status, 201);
  const tplId = tpl.body?.template?.id;
  for (const [role, token] of everyone) {
    const expected = TASK_ONLY.includes(role) ? 403 : 200;
    check(`GET /stage-templates/:id as ${role} -> ${expected}`, (await req(`/stage-templates/${tplId}`, {}, token)).status, expected);
  }
  for (const [role, token] of everyone.filter(([r]) => r !== "admin")) {
    check(`PATCH /stage-templates/:id as ${role} -> 403`, (await req(`/stage-templates/${tplId}`, { method: "PATCH", body: JSON.stringify({ name: "Hacked", version: 1 }) }, token)).status, 403);
  }

  console.log("\n--- events (admin: all; SMM / MM: their clients' events, others' are 404; task-only: 403) ---");
  const evClient = (await req("/clients", { method: "POST", body: newClient("events-client") }, smm.token)).body?.client;
  const evBody = JSON.stringify({ clientId: evClient?.id, templateId: tplId, title: `RBAC event ${stamp}`, type: "shoot", startsAt: "2026-12-01T10:00:00+05:30", endsAt: "2026-12-01T12:00:00+05:30" });
  const evCreateExpect = { admin: 201, social_media_manager: 201, marketing_manager: 404, marketing_agent: 403, developer: 403, editor: 403 };
  let ev = null;
  for (const [role, token] of everyone) {
    const r = await req("/events", { method: "POST", body: evBody }, token);
    check(`POST /events (SMM's client) as ${role} -> ${evCreateExpect[role]}`, r.status, evCreateExpect[role]);
    if (role === "social_media_manager" && r.status === 201) ev = r.body.event;
  }
  for (const [role, token] of everyone) {
    const expected = TASK_ONLY.includes(role) ? 403 : 200;
    check(`GET /events as ${role} -> ${expected}`, (await req("/events", {}, token)).status, expected);
  }
  for (const [role, token] of everyone) {
    check(`GET /events/:id (SMM's) as ${role} -> ${readExpect[role]}`, (await req(`/events/${ev?.id}`, {}, token)).status, readExpect[role]);
  }
  for (const [role, token] of everyone.filter(([r]) => r !== "admin" && r !== "social_media_manager")) {
    const expected = readExpect[role];
    check(`PATCH /events/:id (SMM's) as ${role} -> ${expected}`, (await req(`/events/${ev?.id}`, { method: "PATCH", body: JSON.stringify({ title: "nope", version: 1 }) }, token)).status, expected);
    check(
      `POST /events/:id/stage (SMM's) as ${role} -> ${expected}`,
      (await req(`/events/${ev?.id}/stage`, { method: "POST", body: JSON.stringify({ stageId: ev?.stages?.[1]?.id, version: 1 }) }, token)).status,
      expected,
    );
  }
  check("PATCH /events/:id (own) as SMM -> 200", (await req(`/events/${ev?.id}`, { method: "PATCH", body: JSON.stringify({ location: "Studio 2", version: 1 }) }, smm.token)).status, 200);
  check(
    "POST /events/:id/stage (own) as SMM -> 200",
    (await req(`/events/${ev?.id}/stage`, { method: "POST", body: JSON.stringify({ stageId: ev?.stages?.[1]?.id, note: "Shoot day", visibleToClient: true, version: 2 }) }, smm.token)).status,
    200,
  );
  check(
    "POST /events/:id/stage with the stale version -> 409",
    (await req(`/events/${ev?.id}/stage`, { method: "POST", body: JSON.stringify({ stageId: ev?.stages?.[2]?.id, version: 2 }) }, smm.token)).status,
    409,
  );
  check(
    "POST /events/:id/stage (SMM's) as admin -> 200",
    (await req(`/events/${ev?.id}/stage`, { method: "POST", body: JSON.stringify({ stageId: ev?.stages?.[2]?.id, version: 3 }) }, admin.token)).status,
    200,
  );
  // Leave the fixtures inert: archive the client (its events become read-only), deactivate the template.
  if (evClient) await req(`/clients/${evClient.id}/archive`, { method: "POST", body: "{}" }, admin.token);
  if (tplId) await req(`/stage-templates/${tplId}`, { method: "PATCH", body: JSON.stringify({ active: false, version: 1 }) }, admin.token);

  console.log("\n--- users:manage (admin only) ---");
  for (const [role, token] of everyone) {
    const expected = role === "admin" ? 200 : 403;
    check(`GET /users as ${role} -> ${expected}`, (await req("/users", {}, token)).status, expected);
    check(`GET /users/:id as ${role} -> ${expected}`, (await req(`/users/${target.id}`, {}, token)).status, expected);
  }
  for (const [role, token] of everyone.filter(([r]) => r !== "admin")) {
    const body = JSON.stringify({ email: `rbac-denied-${role}-${stamp}@hok.test`, fullName: "Denied", role: "editor" });
    check(`POST /users as ${role} -> 403`, (await req("/users", { method: "POST", body }, token)).status, 403);
    check(`PATCH /users/:id as ${role} -> 403`, (await req(`/users/${target.id}`, { method: "PATCH", body: JSON.stringify({ fullName: "Hacked" }) }, token)).status, 403);
    check(`POST /users/:id/generate-password as ${role} -> 403`, (await req(`/users/${target.id}/generate-password`, { method: "POST" }, token)).status, 403);
    check(`POST /users/:id/deactivate as ${role} -> 403`, (await req(`/users/${target.id}/deactivate`, { method: "POST" }, token)).status, 403);
    check(`POST /users/:id/reactivate as ${role} -> 403`, (await req(`/users/${target.id}/reactivate`, { method: "POST" }, token)).status, 403);
  }
  check("PATCH /users/:id as admin -> 204", (await req(`/users/${target.id}`, { method: "PATCH", body: JSON.stringify({ timeZone: "Asia/Dubai" }) }, admin.token)).status, 204);
  check("POST /users/:id/generate-password (editor) as admin -> 201", (await req(`/users/${target.id}/generate-password`, { method: "POST" }, admin.token)).status, 201);

  console.log("\n--- admin self-protection ---");
  const self = admin.profile.id;
  check("POST /users/:self/deactivate as admin -> 400", (await req(`/users/${self}/deactivate`, { method: "POST" }, admin.token)).status, 400);
  check("PATCH /users/:self { active: false } as admin -> 400", (await req(`/users/${self}`, { method: "PATCH", body: JSON.stringify({ active: false }) }, admin.token)).status, 400);
  check("PATCH /users/:self { role: editor } as admin -> 400", (await req(`/users/${self}`, { method: "PATCH", body: JSON.stringify({ role: "editor" }) }, admin.token)).status, 400);
  check("POST /users/:self/generate-password as admin -> 403", (await req(`/users/${self}/generate-password`, { method: "POST" }, admin.token)).status, 403);

  console.log("\n--- deactivate / reactivate ---");
  const agent = staff.marketing_agent;
  check("POST /users/:id/deactivate (agent) as admin -> 204", (await req(`/users/${agent.id}/deactivate`, { method: "POST" }, admin.token)).status, 204);
  check("deactivated agent's live token on GET /auth/me -> 401", (await req("/auth/me", {}, agent.token)).status, 401);
  check(
    "deactivated agent cannot sign in -> 401",
    (await req("/auth/login", { method: "POST", body: JSON.stringify({ email: agent.email, password: agent.password }) })).status,
    401,
  );
  check("POST /users/:id/reactivate (agent) as admin -> 204", (await req(`/users/${agent.id}/reactivate`, { method: "POST" }, admin.token)).status, 204);

  // Leave nothing that can sign in: fixtures are deactivated (there is no delete endpoint).
  for (const role of NON_ADMIN_ROLES) await req(`/users/${staff[role].id}/deactivate`, { method: "POST" }, admin.token);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log("\nFailed checks:");
    for (const f of failed) console.log(`  - ${f.label}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
