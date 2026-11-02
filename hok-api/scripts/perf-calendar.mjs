/**
 * Calendar speed check (round 1, spec section 8). LOCAL ONLY: it refuses any
 * database that isn't on this machine, exactly as `src/db/seed.ts` does.
 *
 * What it does:
 *   1. Signs in as the seeded Admin and creates 50 extra test users through the
 *      API (two of them are the timed Social Media Manager and the timed Editor).
 *   2. Gives each of them 5 tasks and 5 to-dos due in the current month (about 10 a
 *      person); the manager's tasks sit on a client whose team is that manager, so
 *      the team-visibility branch of the feed is exercised.
 *   3. Times GET /calendar for the whole month as the Admin, the SMM and the Editor,
 *      20 calls each (after one untimed warm-up call each), and prints p50 / p95.
 *   4. Cleans up every row it created (also on a failure).
 *
 * Target: p95 under 150 ms locally.
 *
 * Usage (the local API must be running; `touch src/index.ts` clears the login
 * rate limit if logins start failing with 429):
 *   node scripts/perf-calendar.mjs
 *   API_BASE_URL=http://localhost:4100/api/v1 SEED_ADMIN_PASSWORD=... node scripts/perf-calendar.mjs
 */
import "dotenv/config";
import pg from "pg";

const BASE = process.env.API_BASE_URL ?? "http://localhost:4100/api/v1";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@hok.test";
// The local seed password is public (it is in this repo); this script only runs against a local database.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Hok@2026";
const USERS = 50;
const TASKS_PER_USER = 5;
const TODOS_PER_USER = 5;
const CALLS = 20;
const TARGET_P95_MS = 150;

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is not set (see .env)");
const host = new URL(dbUrl).hostname;
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(host)) {
  throw new Error(`perf-calendar refuses to run against ${host}; it is for the local database only`);
}
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(BASE).hostname)) {
  throw new Error("perf-calendar refuses a non-local API_BASE_URL");
}

const db = new pg.Client({ connectionString: dbUrl });

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // no body
  }
  return { status: res.status, body: json };
}

async function login(email, password) {
  const r = await api("/auth/login", { method: "POST", body: { email, password } });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.accessToken;
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function timeFeed(label, token, query) {
  await api(`/calendar?${query}`, { token }); // warm-up (connection, plan cache), not counted
  const times = [];
  let items = 0;
  let truncated = false;
  for (let i = 0; i < CALLS; i++) {
    const t0 = performance.now();
    const r = await api(`/calendar?${query}`, { token });
    times.push(performance.now() - t0);
    if (r.status !== 200) throw new Error(`GET /calendar as ${label} -> ${r.status} ${JSON.stringify(r.body)}`);
    items = r.body.items.length;
    truncated = r.body.truncated;
  }
  times.sort((a, b) => a - b);
  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);
  console.log(
    `${label.padEnd(8)} ${String(items).padStart(4)} items${truncated ? " (truncated)" : ""}   p50 ${p50.toFixed(1).padStart(6)} ms   p95 ${p95.toFixed(1).padStart(6)} ms   max ${times.at(-1).toFixed(1)} ms`,
  );
  return { label, p50, p95 };
}

async function main() {
  const stamp = Date.now();
  const created = { userIds: [], clientIds: [] };
  await db.connect();
  try {
    const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

    // -- 1. users
    const roles = ["editor", "developer", "marketing_agent", "content_writer"];
    const people = [];
    for (let i = 0; i < USERS; i++) {
      const role = i === 0 ? "social_media_manager" : i === 1 ? "editor" : roles[i % roles.length];
      const email = `perf-cal-${stamp}-${i}@hok.test`;
      const r = await api("/users", { method: "POST", token: adminToken, body: { email, fullName: `Perf Cal ${i}`, role } });
      if (r.status !== 201) throw new Error(`could not create ${role} #${i}: ${r.status} ${JSON.stringify(r.body)}`);
      created.userIds.push(r.body.userId);
      people.push({ id: r.body.userId, email, password: r.body.password, role });
    }
    const [smm, editor] = people;
    const smmToken = await login(smm.email, smm.password);
    const editorToken = await login(editor.email, editor.password);

    // -- 2. the manager's client (the manager is its team) and the month's data
    const c = await api("/clients", { method: "POST", token: smmToken, body: { businessName: `PERF cal client ${stamp}` } });
    if (c.status !== 201) throw new Error(`could not create the client: ${c.status} ${JSON.stringify(c.body)}`);
    const clientId = c.body.client.id;
    created.clientIds.push(clientId);
    const [{ admin_id: adminId }] = (await db.query("select id as admin_id from public.profiles where email = $1", [ADMIN_EMAIL])).rows;

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const from = new Date(Date.UTC(year, month, 1)).toISOString();
    const to = new Date(Date.UTC(year, month + 1, 1)).toISOString();
    const dueOf = (n) => new Date(Date.UTC(year, month, 1 + (n % 28), 9 + (n % 9))).toISOString();
    const statuses = ["todo", "in_progress", "blocked", "done"];
    const priorities = ["low", "medium", "high", "urgent"];
    const urgencies = ["low", "medium", "high", "urgent"];

    let n = 0;
    for (const [i, person] of people.entries()) {
      for (let k = 0; k < TASKS_PER_USER; k++, n++) {
        // Half of them created by the manager on their client, half by the Admin (some on the client too).
        const byManager = n % 2 === 0;
        await db.query(
          `insert into public.staff_tasks (title, assignee_id, assigned_by, client_id, due_at, priority, status, completed_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            `PERF cal task ${stamp} ${i}-${k}`,
            person.id,
            byManager ? smm.id : adminId,
            byManager || n % 3 === 0 ? clientId : null,
            dueOf(n),
            priorities[n % 4],
            statuses[n % 4],
            n % 4 === 3 ? dueOf(n) : null,
          ],
        );
      }
      for (let k = 0; k < TODOS_PER_USER; k++, n++) {
        await db.query(
          `insert into public.todos (owner_id, title, due_at, urgency, done_at) values ($1, $2, $3, $4, $5)`,
          [person.id, `PERF cal todo ${stamp} ${i}-${k}`, dueOf(n), urgencies[n % 4], n % 5 === 0 ? dueOf(n) : null],
        );
      }
    }
    const [{ tasks, todos }] = (
      await db.query(
        `select (select count(*)::int from public.staff_tasks where title like $1) as tasks,
                (select count(*)::int from public.todos where title like $1) as todos`,
        [`PERF cal % ${stamp} %`],
      )
    ).rows;
    console.log(`Created ${USERS} users, ${tasks} tasks and ${todos} to-dos for ${from.slice(0, 7)}.\n`);

    // -- 3. time it
    const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const results = [];
    results.push(await timeFeed("Admin", adminToken, query));
    results.push(await timeFeed("SMM", smmToken, query));
    results.push(await timeFeed("Editor", editorToken, query));

    const worst = Math.max(...results.map((r) => r.p95));
    console.log(`\nWorst p95: ${worst.toFixed(1)} ms (target: under ${TARGET_P95_MS} ms) -> ${worst < TARGET_P95_MS ? "OK" : "OVER TARGET"}`);
    process.exitCode = worst < TARGET_P95_MS ? 0 : 1;
  } finally {
    // -- 4. clean up what this run made (local database only, checked above)
    const ids = created.userIds;
    if (ids.length > 0) {
      await db.query("delete from public.staff_tasks where assignee_id = any($1) or assigned_by = any($1)", [ids]);
      if (created.clientIds.length > 0) {
        await db.query("delete from public.staff_tasks where client_id = any($1)", [created.clientIds]);
        await db.query("delete from public.clients where id = any($1)", [created.clientIds]);
      }
      await db.query("delete from auth.users where id = any($1)", [ids]); // profiles, to-dos, preferences cascade
      console.log(`Cleaned up ${ids.length} users and everything they owned.`);
    }
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
