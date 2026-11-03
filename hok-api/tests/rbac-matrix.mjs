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
 *       archive/unarchive, team): Admin all, SMM/MM/PM the clients whose team
 *       they're on (others are 404), archive and team Admin only, portal
 *       link lead only, task-only 403. Needs migration 20261013000003_clients.sql. Its fixture
 *       clients are archived at the end (no delete endpoint).
 *   M4: /stage-templates (Admin writes; managers read) and /events (create,
 *       list, get, edit, stage move + stale version) for all six roles. Needs
 *       migration 20261013000004. Its template is deactivated at the end.
 *   M6: /assets (create incl. URL validation, list, tag suggest, get, edit + stale
 *       version, soft delete) for all six roles. Needs migration 20261014100001.
 *   Phase 2: /clients/:id/todos + /client-todos/:id (create, list, edit + stale version, delete, scope, archive)
 *   M7: /staff-tasks (list, create, get, status + stale version, comments,
 *       edit, done -> reopen, delete). Round 1 (2026-11-02): assignment goes down the
 *       role ladder (Admin -> anyone below, managers -> task-only roles); the
 *       Admin or a task's creator manages it; a caller sees tasks assigned to
 *       them, created by them and (managers) their clients' (others are 404; a
 *       visible task they may not write to is 403). Needs migration 20261014200001.
 *       Its fixture tasks are deleted at the end.
 *   Round 1: /todos (private per person, the Admin included), /calendar for every
 *       role, /team-members?assignable=true. Needs migration 20261102000001.
 *   Round 2: task templates (/stage-templates?kind=task: managers read, task-only 403,
 *       Admin manages), tasks moving through stages (/stage, /block, /unblock, /reopen;
 *       the removed /status is 404 for everyone), /links (brief: creator or Admin;
 *       delivered: assignee or Admin; delete: whoever added it or manages the task) and
 *       /links/:id/share (the Admin or a manager on the client's team). Needs migration
 *       20261103000001.
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

const NON_ADMIN_ROLES = ["social_media_manager", "marketing_manager", "project_manager", "marketing_agent", "developer", "editor", "content_writer"];

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
    "POST /auth/bootstrap without the right setup key (or once an admin exists) -> 403",
    (await req("/auth/bootstrap", { method: "POST", body: JSON.stringify({ setupKey: "not-the-key", email: `rbac-boot-${stamp}@hok.test`, password: "Secret-123", fullName: "Nope" }) })).status,
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
  const TASK_ONLY = ["marketing_agent", "developer", "editor", "content_writer"];
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
  const readExpect = { admin: 200, social_media_manager: 200, marketing_manager: 404, project_manager: 404, marketing_agent: 403, developer: 403, editor: 403, content_writer: 403 };
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
  check("POST /clients/:id/archive (own team) as SMM -> 403 (Admin only)", (await req(`/clients/${cid}/archive`, { method: "POST", body: "{}" }, smm.token)).status, 403);
  check("POST /clients/:id/archive as admin -> 200", (await req(`/clients/${cid}/archive`, { method: "POST", body: "{}" }, admin.token)).status, 200);
  check("POST /clients/:id/unarchive as admin -> 200", (await req(`/clients/${cid}/unarchive`, { method: "POST", body: "{}" }, admin.token)).status, 200);
  check(
    "PATCH /clients/:id (SMM's) as admin -> 200",
    (await req(`/clients/${cid}`, { method: "PATCH", body: JSON.stringify({ industry: "Retail", version: 4 }) }, admin.token)).status,
    200,
  );

  const pm = staff.project_manager;
  const team = (body) => ({ method: "PUT", body: JSON.stringify(body) });
  for (const [role, token] of everyone.filter(([r]) => r !== "admin")) {
    check(`PUT /clients/:id/team as ${role} -> 403`, (await req(`/clients/${cid}/team`, team({ leadId: mm.id, memberIds: [] }), token)).status, 403);
  }
  check("PUT /clients/:id/team with an editor as admin -> 400", (await req(`/clients/${cid}/team`, team({ leadId: smm.id, memberIds: [target.id] }), admin.token)).status, 400);
  check("PUT /clients/:id/team (SMM leads, + project manager) as admin -> 200", (await req(`/clients/${cid}/team`, team({ leadId: smm.id, memberIds: [pm.id] }), admin.token)).status, 200);
  check("... the project manager now sees it -> 200", (await req(`/clients/${cid}`, {}, pm.token)).status, 200);
  const pmView = await req(`/clients/${cid}`, {}, pm.token);
  check("... and may edit it -> 200", (await req(`/clients/${cid}`, { method: "PATCH", body: JSON.stringify({ notes: "pm was here", version: pmView.body?.client?.version }) }, pm.token)).status, 200);
  check("... but not change its portal link (lead only) -> 403", (await req(`/portal-links/${cid}`, { method: "POST" }, pm.token)).status, 403);
  check("... while the lead can -> 201", (await req(`/portal-links/${cid}`, { method: "POST" }, smm.token)).status, 201);
  check("... the MM (not on the team) still gets 404", (await req(`/clients/${cid}`, {}, mm.token)).status, 404);
  check("PUT /clients/:id/team (MM leads alone) as admin -> 200", (await req(`/clients/${cid}/team`, team({ leadId: mm.id, memberIds: [] }), admin.token)).status, 200);
  check("... the SMM no longer sees it -> 404", (await req(`/clients/${cid}`, {}, smm.token)).status, 404);
  check("... nor the project manager -> 404", (await req(`/clients/${cid}`, {}, pm.token)).status, 404);
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
  // Round 2: task templates (kind=task). Managers read the ACTIVE ones for the task picker; task-only roles never; the Admin manages.
  for (const [role, token] of everyone) {
    const expected = TASK_ONLY.includes(role) ? 403 : 200;
    check(`GET /stage-templates?kind=task&role=editor as ${role} -> ${expected}`, (await req("/stage-templates?kind=task&role=editor", {}, token)).status, expected);
  }
  for (const [role, token] of everyone.filter(([r]) => r !== "admin")) {
    check(
      `POST /stage-templates (a task template) as ${role} -> 403`,
      (await req("/stage-templates", { method: "POST", body: JSON.stringify({ name: `RBAC no ${role} ${stamp}`, stages: ["A", "B"], kind: "task" }) }, token)).status,
      403,
    );
  }
  const taskTpl = await req("/stage-templates", { method: "POST", body: JSON.stringify({ name: `RBAC task tpl ${stamp}`, stages: ["To do", "In progress", "Done"], kind: "task" }) }, admin.token);
  check("POST /stage-templates (a task template) as admin -> 201", taskTpl.status, 201);
  const taskTplId = taskTpl.body?.template?.id;
  const editorTpl = await req("/stage-templates", { method: "POST", body: JSON.stringify({ name: `RBAC editor tpl ${stamp}`, stages: ["Cut", "Done"], kind: "task", roles: ["editor"] }) }, admin.token);
  check("POST /stage-templates (a task template for editors) as admin -> 201", editorTpl.status, 201);
  check("POST /stage-templates (roles on an event template) as admin -> 400", (await req("/stage-templates", { method: "POST", body: JSON.stringify({ name: `RBAC bad roles ${stamp}`, stages: ["A"], roles: ["editor"] }) }, admin.token)).status, 400);
  for (const [role, token] of everyone.filter(([r]) => r !== "admin")) {
    check(`PATCH /stage-templates/:id (a task template) as ${role} -> 403`, (await req(`/stage-templates/${taskTplId}`, { method: "PATCH", body: JSON.stringify({ name: "Hacked", version: 1 }) }, token)).status, 403);
  }
  check("PATCH /stage-templates/:id (changing kind) as admin -> 400", (await req(`/stage-templates/${taskTplId}`, { method: "PATCH", body: JSON.stringify({ kind: "event", version: 1 }) }, admin.token)).status, 400);

  console.log("\n--- events (admin: all; SMM / MM: their clients' events, others' are 404; task-only: 403) ---");
  const evClient = (await req("/clients", { method: "POST", body: newClient("events-client") }, smm.token)).body?.client;
  const evBody = JSON.stringify({ clientId: evClient?.id, templateId: tplId, title: `RBAC event ${stamp}`, type: "shoot", startsAt: "2026-12-01T10:00:00+05:30", endsAt: "2026-12-01T12:00:00+05:30" });
  const evCreateExpect = { admin: 201, social_media_manager: 201, marketing_manager: 404, project_manager: 404, marketing_agent: 403, developer: 403, editor: 403, content_writer: 403 };
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

  console.log("\n--- personal events + calendar + team members (M5; admin / SMM / MM; task-only: 403) ---");
  const peBody = JSON.stringify({ title: `RBAC personal ${stamp}`, startsAt: "2026-12-02T09:00:00Z", endsAt: "2026-12-02T10:00:00Z" });
  let smmEntry = null;
  for (const [role, token] of everyone) {
    const expected = TASK_ONLY.includes(role) ? 403 : 201;
    const r = await req("/personal-events", { method: "POST", body: peBody }, token);
    check(`POST /personal-events as ${role} -> ${expected}`, r.status, expected);
    if (role === "social_media_manager") smmEntry = r.body?.personalEvent;
    const listExpected = TASK_ONLY.includes(role) ? 403 : 200;
    check(`GET /personal-events as ${role} -> ${listExpected}`, (await req("/personal-events", {}, token)).status, listExpected);
  }
  for (const [role, token] of everyone) {
    check(`GET /personal-events/:id (SMM's) as ${role} -> ${readExpect[role]}`, (await req(`/personal-events/${smmEntry?.id}`, {}, token)).status, readExpect[role]);
  }
  for (const [role, token] of everyone.filter(([r]) => r !== "admin" && r !== "social_media_manager")) {
    const expected = readExpect[role];
    check(`PATCH /personal-events/:id (SMM's) as ${role} -> ${expected}`, (await req(`/personal-events/${smmEntry?.id}`, { method: "PATCH", body: JSON.stringify({ title: "x", version: 1 }) }, token)).status, expected);
    check(`DELETE /personal-events/:id (SMM's) as ${role} -> ${expected}`, (await req(`/personal-events/${smmEntry?.id}`, { method: "DELETE" }, token)).status, expected);
  }
  check(
    "POST /personal-events linking the SMM's client as MM -> 404",
    (await req("/personal-events", { method: "POST", body: JSON.stringify({ title: "x", startsAt: "2026-12-02T09:00:00Z", endsAt: "2026-12-02T10:00:00Z", clientId: evClient?.id }) }, mm.token)).status,
    404,
  );
  check("PATCH /personal-events/:id (own) as SMM -> 200", (await req(`/personal-events/${smmEntry?.id}`, { method: "PATCH", body: JSON.stringify({ title: "Mine", version: 1 }) }, smm.token)).status, 200);
  check("DELETE /personal-events/:id (own) as SMM -> 204", (await req(`/personal-events/${smmEntry?.id}`, { method: "DELETE" }, smm.token)).status, 204);
  const calRange = "from=2026-12-01T00:00:00Z&to=2026-12-31T00:00:00Z";
  for (const [role, token] of everyone) {
    const expected = TASK_ONLY.includes(role) ? 403 : 200;
    // Round 1: every role has a calendar (tasks and to-dos at least).
    check(`GET /calendar as ${role} -> 200`, (await req(`/calendar?${calRange}`, {}, token)).status, 200);
    check(`GET /team-members as ${role} -> ${expected}`, (await req("/team-members", {}, token)).status, expected);
    check(`GET /team-members?assignable=true as ${role} -> ${expected}`, (await req("/team-members?assignable=true", {}, token)).status, expected);
  }
  const mmCal = await req(`/calendar?${calRange}&ownerId=${smm.id}`, {}, mm.token);
  check(
    "GET /calendar as MM never shows the SMM's events or entries (ownerId ignored)",
    mmCal.body?.items?.filter((i) => i.kind === "event" || i.kind === "personal").every((i) => i.ownerId === mm.id),
    true,
  );
  const edCal = await req(`/calendar?${calRange}`, {}, target.token);
  check("GET /calendar as editor holds no events or personal entries", edCal.body?.items?.every((i) => i.kind === "task" || i.kind === "todo"), true);
  check("GET /calendar with include=nope -> 400", (await req(`/calendar?${calRange}&include=nope`, {}, admin.token)).status, 400);
  const asgSmm = await req("/team-members?assignable=true&limit=100", {}, smm.token);
  check("GET /team-members?assignable=true as SMM lists task-only roles only", asgSmm.body?.members?.every((m) => TASK_ONLY.includes(m.role)) && asgSmm.body?.members?.length > 0, true);
  const asgAdmin = await req("/team-members?assignable=true&limit=100", {}, admin.token);
  check("GET /team-members?assignable=true as admin lists no admin", asgAdmin.body?.members?.every((m) => m.role !== "admin"), true);

  console.log("\n--- calendar subscribe link (FR-CAL-08; own link only; task-only: 403; public feed: token only) ---");
  for (const [role, token] of everyone) {
    const ok = !TASK_ONLY.includes(role);
    check(`GET /calendar/feed-link as ${role} -> ${ok ? 200 : 403}`, (await req("/calendar/feed-link", {}, token)).status, ok ? 200 : 403);
    check(`POST /calendar/feed-link as ${role} -> ${ok ? 201 : 403}`, (await req("/calendar/feed-link", { method: "POST" }, token)).status, ok ? 201 : 403);
  }
  check("POST /calendar/feed-link without a login -> 401", (await req("/calendar/feed-link", { method: "POST" })).status, 401);
  const feed = await req("/calendar/feed-link", { method: "POST" }, smm.token);
  check("POST /calendar/feed-link returns the absolute feed url", /^https?:\/\/.+\/api\/v1\/calendar-feed\/[A-Za-z0-9_-]{43}\.ics$/.test(feed.body?.url ?? ""), true);
  const feedRes = await fetch(`${BASE}/calendar-feed/${feed.body?.token}.ics`);
  const feedText = await feedRes.text();
  check("GET /calendar-feed/<token>.ics (public) -> 200 text/calendar", `${feedRes.status} ${feedRes.headers.get("content-type")?.split(";")[0]}`, "200 text/calendar");
  check("the SMM's feed is a calendar", feedText.startsWith("BEGIN:VCALENDAR"), true);
  check("GET /calendar-feed/<unknown>.ics -> 404", (await req(`/calendar-feed/${"x".repeat(43)}.ics`)).status, 404);
  check("GET /calendar-feed/<malformed> -> 404", (await req("/calendar-feed/nope")).status, 404);
  check("DELETE /calendar/feed-link as SMM -> 204", (await req("/calendar/feed-link", { method: "DELETE" }, smm.token)).status, 204);
  check("the turned-off link -> 404", (await req(`/calendar-feed/${feed.body?.token}.ics`)).status, 404);

  console.log("\n--- portal links + client comments (admin: all; SMM / MM: own clients, others' 404; task-only: 403; public: token only) ---");
  const porClient = (await req("/clients", { method: "POST", body: newClient("portal-client") }, smm.token)).body?.client;
  const linkExpect = { admin: 201, social_media_manager: 201, marketing_manager: 404, project_manager: 404, marketing_agent: 403, developer: 403, editor: 403, content_writer: 403 };
  let porToken = null;
  for (const [role, token] of everyone) {
    const r = await req(`/portal-links/${porClient?.id}`, { method: "POST" }, token);
    check(`POST /portal-links/:clientId (SMM's) as ${role} -> ${linkExpect[role]}`, r.status, linkExpect[role]);
    if (r.status === 201) porToken = r.body.token; // the last 201 wins; earlier tokens are revoked
  }
  check("GET /portal/:token (no login) -> 200", (await req(`/portal/${porToken}`)).status, 200);
  check("GET /portal/<made-up token> -> 404", (await req(`/portal/${"A".repeat(43)}`)).status, 404);
  const posted = await req(`/portal/${porToken}/comments`, { method: "POST", body: JSON.stringify({ body: `RBAC comment ${stamp}` }) });
  check("POST /portal/:token/comments (no login) -> 201", posted.status, 201);
  const commentId = posted.body?.comment?.id;
  for (const [role, token] of everyone) {
    const listExpect = TASK_ONLY.includes(role) ? 403 : 200;
    check(`GET /client-comments as ${role} -> ${listExpect}`, (await req("/client-comments", {}, token)).status, listExpect);
    check(`GET /client-comments/counts as ${role} -> ${listExpect}`, (await req("/client-comments/counts", {}, token)).status, listExpect);
    const oneExpect = { admin: 200, social_media_manager: 200, marketing_manager: 404, project_manager: 404, marketing_agent: 403, developer: 403, editor: 403, content_writer: 403 }[role];
    check(`GET /client-comments/:id (SMM's) as ${role} -> ${oneExpect}`, (await req(`/client-comments/${commentId}`, {}, token)).status, oneExpect);
  }
  for (const [role, token] of everyone) {
    if (role === "admin" || role === "social_media_manager") continue; // writers checked below
    const expected = (role === "marketing_manager" || role === "project_manager") ? 404 : 403;
    const r = await req(`/client-comments/${commentId}`, { method: "PATCH", body: JSON.stringify({ status: "in_progress", version: 1 }) }, token);
    check(`PATCH /client-comments/:id (SMM's) as ${role} -> ${expected}`, r.status, expected);
  }
  check(
    "PATCH /client-comments/:id as SMM (own) -> 200",
    (await req(`/client-comments/${commentId}`, { method: "PATCH", body: JSON.stringify({ status: "in_progress", version: 1 }) }, smm.token)).status,
    200,
  );
  check("POST /portal-links/:clientId/disable as SMM -> 200", (await req(`/portal-links/${porClient?.id}/disable`, { method: "POST" }, smm.token)).status, 200);
  check("GET /portal/:token after disable -> 404", (await req(`/portal/${porToken}`)).status, 404);

  console.log("\n--- assets (admin: all; SMM / MM: their clients' assets, others' are 404; task-only: 403) ---");
  const astClient = (await req("/clients", { method: "POST", body: newClient("assets-client") }, smm.token)).body?.client;
  const astBody = JSON.stringify({ clientId: astClient?.id, title: `RBAC asset ${stamp}`, url: "https://drive.google.com/drive/folders/rbac", type: "photo", tags: ["rbac"] });
  const astCreateExpect = { admin: 201, social_media_manager: 201, marketing_manager: 404, project_manager: 404, marketing_agent: 403, developer: 403, editor: 403, content_writer: 403 };
  let asset = null;
  for (const [role, token] of everyone) {
    const r = await req("/assets", { method: "POST", body: astBody }, token);
    check(`POST /assets (SMM's client) as ${role} -> ${astCreateExpect[role]}`, r.status, astCreateExpect[role]);
    if (role === "social_media_manager" && r.status === 201) asset = r.body.asset;
  }
  check(
    "POST /assets with a javascript: URL as SMM -> 400",
    (await req("/assets", { method: "POST", body: JSON.stringify({ clientId: astClient?.id, title: "x", url: "javascript:alert(1)", type: "other" }) }, smm.token)).status,
    400,
  );
  for (const [role, token] of everyone) {
    const expected = TASK_ONLY.includes(role) ? 403 : 200;
    check(`GET /assets as ${role} -> ${expected}`, (await req("/assets", {}, token)).status, expected);
    check(`GET /assets/tags as ${role} -> ${expected}`, (await req("/assets/tags", {}, token)).status, expected);
  }
  const smmAssets = await req("/assets?limit=100", {}, smm.token);
  check("GET /assets as SMM includes the SMM's own asset", smmAssets.body?.assets?.some((a) => a.id === asset?.id), true);
  check("GET /assets as MM does not include the SMM's asset", (await req("/assets?limit=100", {}, mm.token)).body?.assets?.some((a) => a.id === asset?.id), false);
  for (const [role, token] of everyone) {
    check(`GET /assets/:id (SMM's) as ${role} -> ${readExpect[role]}`, (await req(`/assets/${asset?.id}`, {}, token)).status, readExpect[role]);
  }
  for (const [role, token] of everyone.filter(([r]) => r !== "admin" && r !== "social_media_manager")) {
    const expected = readExpect[role];
    check(`PATCH /assets/:id (SMM's) as ${role} -> ${expected}`, (await req(`/assets/${asset?.id}`, { method: "PATCH", body: JSON.stringify({ title: "nope", version: 1 }) }, token)).status, expected);
    check(`DELETE /assets/:id (SMM's) as ${role} -> ${expected}`, (await req(`/assets/${asset?.id}`, { method: "DELETE" }, token)).status, expected);
  }
  check("PATCH /assets/:id (own) as SMM -> 200", (await req(`/assets/${asset?.id}`, { method: "PATCH", body: JSON.stringify({ comment: "mine", tags: ["rbac", "ok"], version: 1 }) }, smm.token)).status, 200);
  check("PATCH /assets/:id with the stale version -> 409", (await req(`/assets/${asset?.id}`, { method: "PATCH", body: JSON.stringify({ comment: "again", version: 1 }) }, smm.token)).status, 409);
  check("PATCH /assets/:id (SMM's) as admin -> 200", (await req(`/assets/${asset?.id}`, { method: "PATCH", body: JSON.stringify({ title: "Admin edit", version: 2 }) }, admin.token)).status, 200);
  check("DELETE /assets/:id (own) as SMM -> 204", (await req(`/assets/${asset?.id}`, { method: "DELETE" }, smm.token)).status, 204);
  check("... a deleted asset is 404 for the admin", (await req(`/assets/${asset?.id}`, {}, admin.token)).status, 404);
  // Leave the fixtures inert: archive the client (its assets become read-only).
  if (astClient) await req(`/clients/${astClient.id}/archive`, { method: "POST", body: "{}" }, admin.token);

  console.log("\n--- client to-dos (admin: all; SMM / MM: their clients' to-dos, others' are 404; task-only: 403) ---");
  const tdClient = (await req("/clients", { method: "POST", body: newClient("todos-client") }, smm.token)).body?.client;
  const tdBody = JSON.stringify({ title: `RBAC todo ${stamp}`, priority: "high", dueAt: "2031-01-01T10:00:00Z" });
  const tdCreateExpect = { admin: 201, social_media_manager: 201, marketing_manager: 404, project_manager: 404, marketing_agent: 403, developer: 403, editor: 403, content_writer: 403 };
  let todo = null;
  for (const [role, token] of everyone) {
    const r = await req(`/clients/${tdClient?.id}/todos`, { method: "POST", body: tdBody }, token);
    check(`POST /clients/:id/todos (SMM's client) as ${role} -> ${tdCreateExpect[role]}`, r.status, tdCreateExpect[role]);
    if (role === "social_media_manager" && r.status === 201) todo = r.body.todo;
  }
  check("POST /clients/:id/todos with an empty title as SMM -> 400", (await req(`/clients/${tdClient?.id}/todos`, { method: "POST", body: JSON.stringify({ title: " " }) }, smm.token)).status, 400);
  for (const [role, token] of everyone) {
    check(`GET /clients/:id/todos (SMM's client) as ${role} -> ${readExpect[role]}`, (await req(`/clients/${tdClient?.id}/todos`, {}, token)).status, readExpect[role]);
  }
  check("GET /clients/:id/todos as SMM includes the SMM's own to-do", (await req(`/clients/${tdClient?.id}/todos?limit=100`, {}, smm.token)).body?.todos?.some((t) => t.id === todo?.id), true);
  for (const [role, token] of everyone.filter(([r]) => r !== "admin" && r !== "social_media_manager")) {
    const expected = readExpect[role];
    check(`PATCH /client-todos/:id (SMM's) as ${role} -> ${expected}`, (await req(`/client-todos/${todo?.id}`, { method: "PATCH", body: JSON.stringify({ title: "nope", version: 1 }) }, token)).status, expected);
    check(`DELETE /client-todos/:id (SMM's) as ${role} -> ${expected}`, (await req(`/client-todos/${todo?.id}`, { method: "DELETE" }, token)).status, expected);
  }
  check("PATCH /client-todos/:id (own) as SMM -> 200", (await req(`/client-todos/${todo?.id}`, { method: "PATCH", body: JSON.stringify({ status: "done", version: 1 }) }, smm.token)).status, 200);
  check("PATCH /client-todos/:id with the stale version -> 409", (await req(`/client-todos/${todo?.id}`, { method: "PATCH", body: JSON.stringify({ title: "again", version: 1 }) }, smm.token)).status, 409);
  check("PATCH /client-todos/:id (SMM's) as admin -> 200", (await req(`/client-todos/${todo?.id}`, { method: "PATCH", body: JSON.stringify({ status: "todo", version: 2 }) }, admin.token)).status, 200);
  check("DELETE /client-todos/:id (own) as SMM -> 204", (await req(`/client-todos/${todo?.id}`, { method: "DELETE" }, smm.token)).status, 204);
  check("... a deleted to-do is 404 for the admin", (await req(`/client-todos/${todo?.id}`, { method: "PATCH", body: JSON.stringify({ title: "x", version: 1 }) }, admin.token)).status, 404);
  // Leave the fixtures inert: archive the client (its to-dos become read-only).
  if (tdClient) {
    check("POST /clients/:id/todos on an archived client as SMM -> 409", (await req(`/clients/${tdClient.id}/archive`, { method: "POST", body: "{}" }, admin.token)).status === 200 && (await req(`/clients/${tdClient.id}/todos`, { method: "POST", body: tdBody }, smm.token)).status, 409);
  }

  console.log("\n--- staff tasks (ladder: admin -> anyone below, managers -> task-only; admin or creator manages; assignee / creator / team see them) ---");
  // Runs before the users section: that section regenerates the editor's password, revoking its token.
  const NON_ADMIN = everyone.filter(([r]) => r !== "admin");
  const MANAGERS = ["social_media_manager", "marketing_manager", "project_manager"];
  const taskBody = (extra = {}) => JSON.stringify({ title: `RBAC task ${stamp}`, assigneeId: target.id, templateId: taskTplId, brief: "RBAC brief", links: [{ url: "https://drive.google.com/drive/folders/rbac", label: "Raw files" }], ...extra });
  const extraTasks = []; // every fixture task, deleted at the end
  const track = (r) => (r.body?.task?.id && extraTasks.push(r.body.task.id), r);
  for (const [role, token] of everyone) {
    check(`GET /staff-tasks as ${role} -> 200`, (await req("/staff-tasks", {}, token)).status, 200);
  }
  // Create, to a task-only person (the editor): Admin and the managers; task-only roles never.
  for (const [role, token] of everyone) {
    const expected = TASK_ONLY.includes(role) ? 403 : 201;
    check(`POST /staff-tasks (to the editor) as ${role} -> ${expected}`, track(await req("/staff-tasks", { method: "POST", body: taskBody() }, token)).status, expected);
  }
  // Create, to a manager (the SMM): only the Admin; a manager is refused by the ladder.
  const toManager = JSON.stringify({ title: `RBAC to-manager ${stamp}`, assigneeId: smm.id, templateId: taskTplId });
  for (const [role, token] of everyone) {
    const expected = TASK_ONLY.includes(role) ? 403 : role === "admin" ? 201 : 400;
    check(`POST /staff-tasks (to the SMM) as ${role} -> ${expected}`, track(await req("/staff-tasks", { method: "POST", body: toManager }, token)).status, expected);
  }
  check(
    "POST /staff-tasks (to the admin) as admin -> 400 (the ladder is strictly downwards)",
    (await req("/staff-tasks", { method: "POST", body: JSON.stringify({ title: "x", assigneeId: admin.profile.id, templateId: taskTplId }) }, admin.token)).status,
    400,
  );
  check(
    "POST /staff-tasks (to the admin) as SMM -> 400",
    (await req("/staff-tasks", { method: "POST", body: JSON.stringify({ title: "x", assigneeId: admin.profile.id, templateId: taskTplId }) }, smm.token)).status,
    400,
  );
  const ladder = await req("/staff-tasks", { method: "POST", body: JSON.stringify({ title: "x", assigneeId: mm.id, templateId: taskTplId }) }, smm.token);
  check("... the refusal is STAFF_TASK_ASSIGNEE_NOT_ALLOWED", ladder.body?.code, "STAFF_TASK_ASSIGNEE_NOT_ALLOWED");
  check("POST /staff-tasks (no templateId) as admin -> 400", (await req("/staff-tasks", { method: "POST", body: JSON.stringify({ title: "x", assigneeId: target.id }) }, admin.token)).status, 400);
  check("POST /staff-tasks (an event template) as admin -> 400", (await req("/staff-tasks", { method: "POST", body: taskBody({ templateId: tplId }) }, admin.token)).status, 400);
  check("POST /staff-tasks (a template for editors, to the developer) as admin -> 400", (await req("/staff-tasks", { method: "POST", body: taskBody({ templateId: editorTpl.body?.template?.id, assigneeId: staff.developer.id }) }, admin.token)).status, 400);
  check("POST /staff-tasks (a template for editors, to the editor) as admin -> 201", track(await req("/staff-tasks", { method: "POST", body: taskBody({ templateId: editorTpl.body?.template?.id }) }, admin.token)).status, 201);
  const taskRes = track(await req("/staff-tasks", { method: "POST", body: taskBody() }, admin.token));
  check("POST /staff-tasks (to the editor) as admin -> 201", taskRes.status, 201);
  const tid = taskRes.body?.task?.id;
  const tStages = taskRes.body?.task?.stages ?? []; // To do / In progress / Done
  check("... the task starts at stage 1 as todo", [taskRes.body?.task?.currentStage?.position, taskRes.body?.task?.status].join(","), "1,todo");

  // The Admin's task has no client: only the Admin and the editor (assignee) can see it.
  const taskReadExpect = { admin: 200, social_media_manager: 404, marketing_manager: 404, project_manager: 404, marketing_agent: 404, developer: 404, editor: 200, content_writer: 404 };
  for (const [role, token] of everyone) {
    check(`GET /staff-tasks/:id (editor's, admin-created) as ${role} -> ${taskReadExpect[role]}`, (await req(`/staff-tasks/${tid}`, {}, token)).status, taskReadExpect[role]);
  }
  const devList = await req("/staff-tasks?limit=100", {}, staff.developer.token);
  check("GET /staff-tasks as developer never lists the editor's task", devList.body?.tasks?.some((t) => t.id === tid), false);
  const edList = await req(`/staff-tasks?assigneeId=${staff.developer.id}&limit=100`, {}, target.token);
  check("GET /staff-tasks as editor with another assigneeId lists nothing outside their scope", edList.body?.tasks?.every((t) => t.assigneeId === target.id), true);
  check("GET /staff-tasks?relation=team as developer -> 400 (managers only)", (await req("/staff-tasks?relation=team", {}, staff.developer.token)).status, 400);
  check("GET /staff-tasks?relation=bogus -> 400", (await req("/staff-tasks?relation=bogus", {}, admin.token)).status, 400);

  // The old /status endpoint is gone for everyone.
  for (const [role, token] of everyone) {
    check(`POST /staff-tasks/:id/status (removed) as ${role} -> 404`, (await req(`/staff-tasks/${tid}/status`, { method: "POST", body: JSON.stringify({ status: "done", version: 1 }) }, token)).status, 404);
  }
  // Stage moves: the assignee, the creator and the Admin; a stranger 404.
  for (const [role, token] of NON_ADMIN.filter(([r]) => r !== "editor")) {
    check(`POST /staff-tasks/:id/stage (editor's) as ${role} -> 404`, (await req(`/staff-tasks/${tid}/stage`, { method: "POST", body: JSON.stringify({ stageId: tStages[1]?.id, version: 1 }) }, token)).status, 404);
    check(`POST /staff-tasks/:id/block (editor's) as ${role} -> 404`, (await req(`/staff-tasks/${tid}/block`, { method: "POST", body: JSON.stringify({ reason: "x", version: 1 }) }, token)).status, 404);
    check(`POST /staff-tasks/:id/unblock (editor's) as ${role} -> 404`, (await req(`/staff-tasks/${tid}/unblock`, { method: "POST", body: JSON.stringify({ version: 1 }) }, token)).status, 404);
    check(`POST /staff-tasks/:id/links (editor's) as ${role} -> 404`, (await req(`/staff-tasks/${tid}/links`, { method: "POST", body: JSON.stringify({ kind: "delivered", url: "https://example.test/a" }) }, token)).status, 404);
    check(`POST /staff-tasks/:id/comments (editor's) as ${role} -> 404`, (await req(`/staff-tasks/${tid}/comments`, { method: "POST", body: JSON.stringify({ body: "hi" }) }, token)).status, 404);
  }
  check("POST /staff-tasks/:id/stage (own) as editor -> 200", (await req(`/staff-tasks/${tid}/stage`, { method: "POST", body: JSON.stringify({ stageId: tStages[1]?.id, comment: "Starting", version: 1 }) }, target.token)).status, 200);
  check("POST /staff-tasks/:id/stage with the stale version -> 409", (await req(`/staff-tasks/${tid}/stage`, { method: "POST", body: JSON.stringify({ stageId: tStages[0]?.id, version: 1 }) }, target.token)).status, 409);
  check("POST /staff-tasks/:id/stage to the current stage -> 409", (await req(`/staff-tasks/${tid}/stage`, { method: "POST", body: JSON.stringify({ stageId: tStages[1]?.id, version: 2 }) }, target.token)).status, 409);
  check("POST /staff-tasks/:id/stage complete from the middle -> 409", (await req(`/staff-tasks/${tid}/stage`, { method: "POST", body: JSON.stringify({ complete: true, version: 2 }) }, target.token)).status, 409);
  check("POST /staff-tasks/:id/stage with neither stageId nor complete -> 400", (await req(`/staff-tasks/${tid}/stage`, { method: "POST", body: JSON.stringify({ version: 2 }) }, target.token)).status, 400);
  check("POST /staff-tasks/:id/block (own) as editor -> 200", (await req(`/staff-tasks/${tid}/block`, { method: "POST", body: JSON.stringify({ reason: "Waiting for music", version: 2 }) }, target.token)).status, 200);
  check("POST /staff-tasks/:id/block when already blocked -> 409", (await req(`/staff-tasks/${tid}/block`, { method: "POST", body: JSON.stringify({ reason: "again", version: 3 }) }, target.token)).status, 409);
  check("POST /staff-tasks/:id/unblock (own) as editor -> 200", (await req(`/staff-tasks/${tid}/unblock`, { method: "POST", body: JSON.stringify({ comment: "Music arrived", version: 3 }) }, target.token)).status, 200);
  check("POST /staff-tasks/:id/unblock when not blocked -> 409", (await req(`/staff-tasks/${tid}/unblock`, { method: "POST", body: JSON.stringify({ version: 4 }) }, target.token)).status, 409);
  check("POST /staff-tasks/:id/comments (own) as editor -> 201", (await req(`/staff-tasks/${tid}/comments`, { method: "POST", body: JSON.stringify({ body: "Cut is up" }) }, target.token)).status, 201);
  check("POST /staff-tasks/:id/comments as admin -> 201", (await req(`/staff-tasks/${tid}/comments`, { method: "POST", body: JSON.stringify({ body: "Thanks" }) }, admin.token)).status, 201);

  // Edit / reopen / delete on the Admin's task: managers can't see it (404); task-only roles lack staff_tasks:assign (403).
  const manageExpect = (role) => (role === "admin" ? null : MANAGERS.includes(role) ? 404 : 403);
  for (const [role, token] of NON_ADMIN) {
    check(`PATCH /staff-tasks/:id (admin's task) as ${role} -> ${manageExpect(role)}`, (await req(`/staff-tasks/${tid}`, { method: "PATCH", body: JSON.stringify({ priority: "urgent", version: 4 }) }, token)).status, manageExpect(role));
  }
  check("PATCH /staff-tasks/:id as admin -> 200", (await req(`/staff-tasks/${tid}`, { method: "PATCH", body: JSON.stringify({ priority: "urgent", brief: "New brief", version: 4 }) }, admin.token)).status, 200);
  check("PATCH /staff-tasks/:id with a templateId as admin -> 400 (stages are fixed)", (await req(`/staff-tasks/${tid}`, { method: "PATCH", body: JSON.stringify({ templateId: taskTplId, version: 5 }) }, admin.token)).status, 400);
  check("POST /staff-tasks/:id/stage to the last stage (own) as editor -> 200", (await req(`/staff-tasks/${tid}/stage`, { method: "POST", body: JSON.stringify({ stageId: tStages[2]?.id, version: 5 }) }, target.token)).status, 200);
  check("POST /staff-tasks/:id/stage complete (own) as editor -> 200", (await req(`/staff-tasks/${tid}/stage`, { method: "POST", body: JSON.stringify({ complete: true, version: 6 }) }, target.token)).status, 200);
  check("POST /staff-tasks/:id/stage on a done task as editor -> 409", (await req(`/staff-tasks/${tid}/stage`, { method: "POST", body: JSON.stringify({ stageId: tStages[0]?.id, version: 7 }) }, target.token)).status, 409);
  check("POST /staff-tasks/:id/block on a done task as editor -> 409", (await req(`/staff-tasks/${tid}/block`, { method: "POST", body: JSON.stringify({ reason: "x", version: 7 }) }, target.token)).status, 409);
  for (const [role, token] of NON_ADMIN) {
    check(`POST /staff-tasks/:id/reopen (admin's task) as ${role} -> ${manageExpect(role)}`, (await req(`/staff-tasks/${tid}/reopen`, { method: "POST", body: JSON.stringify({ version: 7 }) }, token)).status, manageExpect(role));
  }
  check("POST /staff-tasks/:id/reopen to a stage as admin -> 200", (await req(`/staff-tasks/${tid}/reopen`, { method: "POST", body: JSON.stringify({ stageId: tStages[1]?.id, version: 7 }) }, admin.token)).status, 200);

  // A manager receives tasks too (from the Admin), and sees only their own.
  const smmTask = track(await req("/staff-tasks", { method: "POST", body: JSON.stringify({ title: `RBAC smm task ${stamp}`, assigneeId: smm.id, templateId: taskTplId }) }, admin.token));
  check("POST /staff-tasks (to the SMM) as admin -> 201", smmTask.status, 201);
  check("GET /staff-tasks/:id (SMM's) as SMM -> 200", (await req(`/staff-tasks/${smmTask.body?.task?.id}`, {}, smm.token)).status, 200);
  check("GET /staff-tasks/:id (SMM's) as MM -> 404", (await req(`/staff-tasks/${smmTask.body?.task?.id}`, {}, mm.token)).status, 404);

  // A task the SMM created: the SMM (creator) manages it, other managers don't see it, task-only roles can't write.
  const smmMade = track(await req("/staff-tasks", { method: "POST", body: taskBody({ title: `RBAC smm-made ${stamp}` }) }, smm.token));
  const mid = smmMade.body?.task?.id;
  check("... the creator's canManage is true", smmMade.body?.task?.canManage, true);
  check("GET /staff-tasks/:id (SMM-created) as admin -> 200", (await req(`/staff-tasks/${mid}`, {}, admin.token)).status, 200);
  check("GET /staff-tasks/:id (SMM-created) as MM -> 404", (await req(`/staff-tasks/${mid}`, {}, mm.token)).status, 404);
  check("PATCH /staff-tasks/:id (SMM-created) as MM -> 404", (await req(`/staff-tasks/${mid}`, { method: "PATCH", body: JSON.stringify({ title: "x", version: 1 }) }, mm.token)).status, 404);
  check("PATCH /staff-tasks/:id (SMM-created) as editor (the assignee) -> 403", (await req(`/staff-tasks/${mid}`, { method: "PATCH", body: JSON.stringify({ title: "x", version: 1 }) }, target.token)).status, 403);
  check("PATCH /staff-tasks/:id (SMM-created) as SMM (creator) -> 200", (await req(`/staff-tasks/${mid}`, { method: "PATCH", body: JSON.stringify({ title: `RBAC smm-made ${stamp} b`, version: 1 }) }, smm.token)).status, 200);
  check("PATCH /staff-tasks/:id reassigning sideways (to the MM) as SMM -> 400", (await req(`/staff-tasks/${mid}`, { method: "PATCH", body: JSON.stringify({ assigneeId: mm.id, version: 2 }) }, smm.token)).status, 400);
  check("PATCH /staff-tasks/:id (SMM-created) as admin -> 200", (await req(`/staff-tasks/${mid}`, { method: "PATCH", body: JSON.stringify({ title: `RBAC smm-made ${stamp} c`, version: 2 }) }, admin.token)).status, 200);
  check("POST /staff-tasks/:id/comments (SMM-created) as SMM (creator) -> 201", (await req(`/staff-tasks/${mid}/comments`, { method: "POST", body: JSON.stringify({ body: "Please hurry" }) }, smm.token)).status, 201);
  const mStages = smmMade.body?.task?.stages ?? [];
  check("POST /staff-tasks/:id/stage (SMM-created) as SMM (the creator) -> 200", (await req(`/staff-tasks/${mid}/stage`, { method: "POST", body: JSON.stringify({ stageId: mStages[1]?.id, version: 3 }) }, smm.token)).status, 200);
  check("POST /staff-tasks/:id/block (SMM-created) as SMM (the creator, not the assignee) -> 403", (await req(`/staff-tasks/${mid}/block`, { method: "POST", body: JSON.stringify({ reason: "x", version: 5 }) }, smm.token)).status, 403);
  check("POST /staff-tasks/:id/stage (SMM-created) as MM -> 404", (await req(`/staff-tasks/${mid}/stage`, { method: "POST", body: JSON.stringify({ stageId: mStages[2]?.id, version: 5 }) }, mm.token)).status, 404);
  check("POST /staff-tasks/:id/block (SMM-created) as editor (the assignee) -> 200", (await req(`/staff-tasks/${mid}/block`, { method: "POST", body: JSON.stringify({ reason: "Waiting", version: 4 }) }, target.token)).status, 200);
  check("POST /staff-tasks/:id/unblock (SMM-created) as SMM (the creator) -> 200", (await req(`/staff-tasks/${mid}/unblock`, { method: "POST", body: JSON.stringify({ version: 5 }) }, smm.token)).status, 200);

  // Links: brief = the creator or Admin; delivered = the assignee or Admin; delete = whoever added it or manages the task.
  const addLink = (id, body, token) => req(`/staff-tasks/${id}/links`, { method: "POST", body: JSON.stringify(body) }, token);
  check("POST /staff-tasks/:id/links (brief) as SMM (the creator) -> 201", (await addLink(mid, { kind: "brief", url: "https://example.test/brief", label: "Inputs" }, smm.token)).status, 201);
  check("POST /staff-tasks/:id/links (brief) as editor (the assignee) -> 403", (await addLink(mid, { kind: "brief", url: "https://example.test/brief2" }, target.token)).status, 403);
  check("POST /staff-tasks/:id/links (brief) as admin -> 201", (await addLink(mid, { kind: "brief", url: "https://example.test/brief3" }, admin.token)).status, 201);
  const dlv = await addLink(mid, { kind: "delivered", url: "https://example.test/final", label: "Final" }, target.token);
  check("POST /staff-tasks/:id/links (delivered) as editor (the assignee) -> 201", dlv.status, 201);
  check("POST /staff-tasks/:id/links (delivered) as SMM (the creator) -> 403", (await addLink(mid, { kind: "delivered", url: "https://example.test/x" }, smm.token)).status, 403);
  check("POST /staff-tasks/:id/links (delivered) as admin -> 201", (await addLink(mid, { kind: "delivered", url: "https://example.test/y" }, admin.token)).status, 201);
  check("POST /staff-tasks/:id/links (not http) as editor -> 400", (await addLink(mid, { kind: "delivered", url: "javascript:alert(1)" }, target.token)).status, 400);
  check("POST /staff-tasks/:id/links (SMM-created) as MM -> 404", (await addLink(mid, { kind: "brief", url: "https://example.test/z" }, mm.token)).status, 404);
  const mLinks = dlv.body?.task?.links ?? [];
  const deliveredLink = mLinks.find((l) => l.kind === "delivered");
  const briefLink = mLinks.find((l) => l.kind === "brief");
  check("DELETE /staff-tasks/:id/links/:linkId (SMM's brief link) as editor -> 403", (await req(`/staff-tasks/${mid}/links/${briefLink?.id}`, { method: "DELETE" }, target.token)).status, 403);
  check("DELETE /staff-tasks/:id/links/:linkId as MM -> 404", (await req(`/staff-tasks/${mid}/links/${briefLink?.id}`, { method: "DELETE" }, mm.token)).status, 404);
  check("DELETE /staff-tasks/:id/links/:linkId (SMM's brief link) as SMM (who added it) -> 200", (await req(`/staff-tasks/${mid}/links/${briefLink?.id}`, { method: "DELETE" }, smm.token)).status, 200);
  check("DELETE /staff-tasks/:id/links/:linkId (a missing link) as SMM -> 404", (await req(`/staff-tasks/${mid}/links/${briefLink?.id}`, { method: "DELETE" }, smm.token)).status, 404);
  check("DELETE /staff-tasks/:id/links/:linkId (the editor's delivered link) as SMM (manages the task) -> 200", (await req(`/staff-tasks/${mid}/links/${deliveredLink?.id}`, { method: "DELETE" }, smm.token)).status, 200);

  // A client's team sees its tasks read-only (403 on writes); a manager off the team gets 404.
  const teamClient = (await req("/clients", { method: "POST", body: newClient("task-team-client") }, smm.token)).body?.client;
  const mmClient = (await req("/clients", { method: "POST", body: newClient("task-mm-client") }, mm.token)).body?.client;
  const teamTask = track(await req("/staff-tasks", { method: "POST", body: taskBody({ title: `RBAC team task ${stamp}`, clientId: teamClient?.id }) }, admin.token));
  const ttid = teamTask.body?.task?.id;
  check("POST /staff-tasks linking a client as admin -> 201", teamTask.status, 201);
  check("GET /staff-tasks/:id (client's task) as SMM on the team -> 200", (await req(`/staff-tasks/${ttid}`, {}, smm.token)).status, 200);
  check("... canManage is false for the team manager", (await req(`/staff-tasks/${ttid}`, {}, smm.token)).body?.task?.canManage, false);
  check("GET /staff-tasks/:id (client's task) as MM off the team -> 404", (await req(`/staff-tasks/${ttid}`, {}, mm.token)).status, 404);
  const teamList = await req(`/staff-tasks?relation=team&limit=100`, {}, smm.token);
  check("GET /staff-tasks?relation=team as SMM lists the client's task", teamList.body?.tasks?.some((t) => t.id === ttid), true);
  check("PATCH /staff-tasks/:id (client's task) as SMM on the team -> 403", (await req(`/staff-tasks/${ttid}`, { method: "PATCH", body: JSON.stringify({ title: "x", version: 1 }) }, smm.token)).status, 403);
  const forbidden = await req(`/staff-tasks/${ttid}`, { method: "PATCH", body: JSON.stringify({ title: "x", version: 1 }) }, smm.token);
  check("... the refusal is STAFF_TASK_FORBIDDEN", forbidden.body?.code, "STAFF_TASK_FORBIDDEN");
  check("POST /staff-tasks/:id/reopen (client's task) as SMM on the team -> 403", (await req(`/staff-tasks/${ttid}/reopen`, { method: "POST", body: JSON.stringify({ version: 1 }) }, smm.token)).status, 403);
  check("POST /staff-tasks/:id/comments (client's task) as SMM on the team -> 403", (await req(`/staff-tasks/${ttid}/comments`, { method: "POST", body: JSON.stringify({ body: "hi" }) }, smm.token)).status, 403);
  const ttStages = teamTask.body?.task?.stages ?? [];
  check("POST /staff-tasks/:id/stage (client's task) as SMM on the team -> 403", (await req(`/staff-tasks/${ttid}/stage`, { method: "POST", body: JSON.stringify({ stageId: ttStages[1]?.id, version: 1 }) }, smm.token)).status, 403);
  check("POST /staff-tasks/:id/block (client's task) as SMM on the team -> 403", (await req(`/staff-tasks/${ttid}/block`, { method: "POST", body: JSON.stringify({ reason: "x", version: 1 }) }, smm.token)).status, 403);
  check("POST /staff-tasks/:id/unblock (client's task) as SMM on the team -> 403", (await req(`/staff-tasks/${ttid}/unblock`, { method: "POST", body: JSON.stringify({ version: 1 }) }, smm.token)).status, 403);
  check("POST /staff-tasks/:id/links (client's task) as SMM on the team -> 403", (await addLink(ttid, { kind: "brief", url: "https://example.test/t" }, smm.token)).status, 403);
  check("POST /staff-tasks/:id/stage (client's task) as MM off the team -> 404", (await req(`/staff-tasks/${ttid}/stage`, { method: "POST", body: JSON.stringify({ stageId: ttStages[1]?.id, version: 1 }) }, mm.token)).status, 404);

  // Share with the client: the Admin or a manager on the client's team; never the assignee; the task needs an event.
  const shareTpl = await req("/stage-templates", { method: "POST", body: JSON.stringify({ name: `RBAC share tpl ${stamp}`, stages: ["Plan", "Shoot"] }) }, admin.token);
  const shareEvent = await req("/events", { method: "POST", body: JSON.stringify({ clientId: teamClient?.id, templateId: shareTpl.body?.template?.id, title: `RBAC share event ${stamp}`, type: "shoot", startsAt: "2026-12-01T10:00:00Z", endsAt: "2026-12-01T12:00:00Z" }) }, smm.token);
  check("POST /events (for the share checks) as SMM -> 201", shareEvent.status, 201);
  const shareTask = track(await req("/staff-tasks", { method: "POST", body: taskBody({ title: `RBAC share task ${stamp}`, clientId: teamClient?.id, eventId: shareEvent.body?.event?.id }) }, smm.token));
  const shid = shareTask.body?.task?.id;
  const shLink = (await addLink(shid, { kind: "delivered", url: "https://example.test/share-me", label: "Final reel" }, target.token)).body?.task?.links?.find((l) => l.kind === "delivered");
  const doShare = (id, linkId, token, body = {}) => req(`/staff-tasks/${id}/links/${linkId}/share`, { method: "POST", body: JSON.stringify(body) }, token);
  check("POST /staff-tasks/:id/links/:linkId/share as editor (the assignee) -> 403", (await doShare(shid, shLink?.id, target.token)).status, 403);
  check("POST /staff-tasks/:id/links/:linkId/share as MM (off the team) -> 404", (await doShare(shid, shLink?.id, mm.token)).status, 404);
  check("POST /staff-tasks/:id/links/:linkId/share as developer (a stranger) -> 404", (await doShare(shid, shLink?.id, staff.developer.token)).status, 404);
  const shared = await doShare(shid, shLink?.id, smm.token, { title: "Final reel" });
  check("POST /staff-tasks/:id/links/:linkId/share as SMM (creator, on the team) -> 201", shared.status, 201);
  check("... and the response names the new asset", typeof shared.body?.assetId, "string");
  check("POST /staff-tasks/:id/links/:linkId/share again -> 409", (await doShare(shid, shLink?.id, smm.token)).status, 409);
  const noEventTask = track(await req("/staff-tasks", { method: "POST", body: taskBody({ title: `RBAC no-event task ${stamp}` }) }, admin.token));
  const neid = noEventTask.body?.task?.id;
  const neLink = (await addLink(neid, { kind: "delivered", url: "https://example.test/no-event" }, target.token)).body?.task?.links?.find((l) => l.kind === "delivered");
  check("POST /staff-tasks/:id/links/:linkId/share (a task with no event) as admin -> 409", (await doShare(neid, neLink?.id, admin.token)).status, 409);
  check("POST /staff-tasks/:id/links/:linkId/share (a missing link) as admin -> 404", (await doShare(neid, "00000000-0000-4000-8000-000000000000", admin.token)).status, 404);
  if (shareTpl.body?.template?.id) await req(`/stage-templates/${shareTpl.body.template.id}`, { method: "PATCH", body: JSON.stringify({ active: false, version: 1 }) }, admin.token);
  check("DELETE /staff-tasks/:id (client's task) as SMM on the team -> 403", (await req(`/staff-tasks/${ttid}`, { method: "DELETE" }, smm.token)).status, 403);
  check(
    "POST /staff-tasks linking another team's client as SMM -> 400",
    (await req("/staff-tasks", { method: "POST", body: taskBody({ clientId: mmClient?.id }) }, smm.token)).status,
    400,
  );
  check("POST /staff-tasks linking their own client as SMM -> 201", track(await req("/staff-tasks", { method: "POST", body: taskBody({ clientId: teamClient?.id }) }, smm.token)).status, 201);

  for (const [role, token] of NON_ADMIN) {
    check(`DELETE /staff-tasks/:id (admin's task) as ${role} -> ${manageExpect(role)}`, (await req(`/staff-tasks/${tid}`, { method: "DELETE" }, token)).status, manageExpect(role));
  }
  check("DELETE /staff-tasks/:id (SMM-created) as MM -> 404", (await req(`/staff-tasks/${mid}`, { method: "DELETE" }, mm.token)).status, 404);
  check("DELETE /staff-tasks/:id (SMM-created) as SMM (creator) -> 204", (await req(`/staff-tasks/${mid}`, { method: "DELETE" }, smm.token)).status, 204);
  // Fixture tasks are deleted (the API has a task delete); the fixture clients are archived (they have no delete).
  check("DELETE /staff-tasks/:id as admin -> 204", (await req(`/staff-tasks/${tid}`, { method: "DELETE" }, admin.token)).status, 204);
  check("... a deleted task is 404 for the admin", (await req(`/staff-tasks/${tid}`, {}, admin.token)).status, 404);
  for (const id of extraTasks) await req(`/staff-tasks/${id}`, { method: "DELETE" }, admin.token);
  for (const c of [teamClient, mmClient]) if (c) await req(`/clients/${c.id}/archive`, { method: "POST", body: "{}" }, admin.token);
  for (const t of [taskTpl, editorTpl]) if (t.body?.template?.id) await req(`/stage-templates/${t.body.template.id}`, { method: "PATCH", body: JSON.stringify({ active: false, version: t.body.template.version }) }, admin.token);

  console.log("\n--- my to-dos (round 1: todos:manage is own for every role; nobody, the Admin included, reaches another person's) ---");
  check("GET /todos without a token -> 401", (await req("/todos")).status, 401);
  const myTodos = {};
  for (const [role, token] of everyone) {
    const created = await req("/todos", { method: "POST", body: JSON.stringify({ title: `RBAC todo ${role} ${stamp}`, urgency: "high", dueAt: "2026-12-05T09:00:00Z" }) }, token);
    check(`POST /todos as ${role} -> 201`, created.status, 201);
    myTodos[role] = created.body?.todo;
    check(`GET /todos as ${role} -> 200`, (await req("/todos?status=all&limit=100", {}, token)).status, 200);
    const mine = await req("/todos?status=all&limit=100", {}, token);
    check(`GET /todos as ${role} lists only their own`, mine.body?.todos?.every((t) => !t.title.endsWith(String(stamp)) || t.title === `RBAC todo ${role} ${stamp}`), true);
  }
  // Everyone against the editor's to-do: only the editor reaches it; the Admin gets a 404 too.
  const editorTodo = myTodos.editor;
  for (const [role, token] of everyone) {
    const expected = role === "editor" ? 200 : 404;
    check(`PATCH /todos/:id (editor's) as ${role} -> ${expected}`, (await req(`/todos/${editorTodo?.id}`, { method: "PATCH", body: JSON.stringify({ notes: `by ${role}`, version: 1 }) }, token)).status, expected);
  }
  const fromAdmin = await req(`/todos/${editorTodo?.id}`, { method: "PATCH", body: JSON.stringify({ notes: "x", version: 2 }) }, admin.token);
  check("... the Admin's refusal is TODO_NOT_FOUND", fromAdmin.body?.code, "TODO_NOT_FOUND");
  for (const [role, token] of everyone.filter(([r]) => r !== "editor")) {
    check(`DELETE /todos/:id (editor's) as ${role} -> 404`, (await req(`/todos/${editorTodo?.id}`, { method: "DELETE" }, token)).status, 404);
  }
  check("PATCH /todos/:id with a stale version as editor -> 409", (await req(`/todos/${editorTodo?.id}`, { method: "PATCH", body: JSON.stringify({ notes: "again", version: 1 }) }, target.token)).status, 409);
  check("PATCH /todos/:id done as editor -> 200", (await req(`/todos/${editorTodo?.id}`, { method: "PATCH", body: JSON.stringify({ done: true, version: 2 }) }, target.token)).status, 200);
  check("POST /todos with a blank title -> 400", (await req("/todos", { method: "POST", body: JSON.stringify({ title: "  " }) }, target.token)).status, 400);
  check("GET /todos?status=nope -> 400", (await req("/todos?status=nope", {}, target.token)).status, 400);
  for (const [role, token] of everyone) {
    check(`DELETE /todos/:id (own) as ${role} -> 204`, (await req(`/todos/${myTodos[role]?.id}`, { method: "DELETE" }, token)).status, 204);
  }
  check("... a deleted to-do is 404", (await req(`/todos/${editorTodo?.id}`, { method: "DELETE" }, target.token)).status, 404);

  console.log("\n--- dashboard (M10: every role; own tasks for all, own clients for admin / SMM / MM, the firm for admin only) ---");
  check("GET /dashboard without a token -> 401", (await req("/dashboard")).status, 401);
  for (const [role, token] of everyone) {
    const r = await req("/dashboard", {}, token);
    check(`GET /dashboard as ${role} -> 200`, r.status, 200);
    // The Admin's overview is the firm alone; their own clients are on view=mine.
    const managesClients = ["social_media_manager", "marketing_manager", "project_manager"].includes(role);
    check(`  ${role}: clients section ${managesClients ? "present" : "absent"}`, r.body?.clients != null, managesClients);
    check(`  ${role}: firm section ${role === "admin" ? "present" : "absent"}`, r.body?.firm != null, role === "admin");
    if (role === "admin") {
      const mine = await req("/dashboard?view=mine", {}, token);
      check("GET /dashboard?view=mine as admin -> own clients, no firm", mine.status === 200 && mine.body?.clients != null && mine.body?.firm == null, true);
    }
    const t = await req("/dashboard/team", {}, token);
    check(`GET /dashboard/team as ${role} -> ${role === "admin" ? 200 : 403}`, t.status, role === "admin" ? 200 : 403);
  }

  console.log("\n--- global search (every role; groups scoped by capability) ---");
  check("GET /search without a token -> 401", (await req("/search?q=ab")).status, 401);
  for (const [role, token] of everyone) {
    const s = await req("/search?q=ab", {}, token);
    check(`GET /search as ${role} -> 200`, s.status, 200);
    const taskOnly = ["marketing_agent", "developer", "editor", "content_writer"].includes(role);
    check(`  ${role}: clients group ${taskOnly ? "hidden" : "present"}`, s.body?.groups?.clients === null, taskOnly);
  }

  console.log("\n--- activity log (dashboard:global: admin only) ---");
  check("GET /activity without a token -> 401", (await req("/activity")).status, 401);
  for (const [role, token] of everyone) {
    const expected = role === "admin" ? 200 : 403;
    check(`GET /activity as ${role} -> ${expected}`, (await req("/activity", {}, token)).status, expected);
  }
  check("GET /activity span over 31 days -> 400", (await req("/activity?from=2020-01-01T00:00:00Z&to=2020-03-01T00:00:00Z", {}, admin.token)).status, 400);
  check("GET /activity bad kind -> 400", (await req("/activity?kind=bogus", {}, admin.token)).status, 400);

  console.log("\n--- reports (Phase 2: dashboard:global, Admin only; all six roles) ---");
  {
    const now = new Date();
    now.setUTCDate(1);
    now.setUTCMonth(now.getUTCMonth() - 1); // last month: allowed in every zone
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const reportPaths = [
      ["GET /reports/team-status", "/reports/team-status"],
      ["GET /reports/staff", `/reports/staff?userId=${target.id}&month=${month}`],
      ["GET /reports/client", `/reports/client?clientId=${cid}&month=${month}`],
    ];
    for (const [label, path] of reportPaths) {
      check(`${label} without a token -> 401`, (await req(path)).status, 401);
      for (const [role, token] of everyone) {
        const expected = role === "admin" ? 200 : 403;
        check(`${label} as ${role} -> ${expected}`, (await req(path, {}, token)).status, expected);
      }
    }
    check("GET /reports/staff with a month older than 6 -> 400", (await req(`/reports/staff?userId=${target.id}&month=2000-01`, {}, admin.token)).status, 400);
    check("GET /reports/client with a future month -> 400", (await req(`/reports/client?clientId=${cid}&month=2999-01`, {}, admin.token)).status, 400);
    check("GET /reports/team-status?status=busy -> 400", (await req("/reports/team-status?status=busy", {}, admin.token)).status, 400);
    check("GET /reports/staff for an unknown person -> 404", (await req(`/reports/staff?userId=00000000-0000-4000-8000-000000000000&month=${month}`, {}, admin.token)).status, 404);
  }

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
