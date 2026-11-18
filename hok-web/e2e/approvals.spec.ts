import { expect, test, type Browser, type Page } from "@playwright/test";
import { newPortalToken, openPortalEvent } from "./portalHelpers";

const PASSWORD = process.env.E2E_PASSWORD ?? "Hok@2026";
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100/api/v1";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle"); // submitted before hydration, the form does nothing
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
}

async function signedIn(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, email);
  return { ctx, page };
}

test.setTimeout(240_000);

type Kind = "Events" | "Tasks";

/**
 * Admin: a new template with the given stage names. `approvers` maps a 1-based stage number to the
 * approver chips to pick ("Admin", "Social Media Manager", "The client", …). `forRole` limits a task template.
 */
async function createTemplate(admin: Page, kind: Kind, name: string, stages: string[], approvers: Record<number, string[]>, forRole?: string) {
  await admin.goto("/app/templates");
  await admin.waitForLoadState("networkidle");
  await admin.getByRole("tab", { name: kind }).click();
  await admin.getByRole("button", { name: "New template" }).click();
  await admin.locator("#tpl-name").fill(name);
  if (forRole) await admin.getByText(forRole, { exact: true }).first().click(); // the "For roles" chip
  await admin.getByLabel("Stage 1 name").fill(stages[0]!);
  await admin.getByLabel("Stage 2 name").fill(stages[1]!);
  for (let i = 2; i < stages.length; i++) {
    await admin.getByRole("button", { name: "Add stage" }).click();
    await admin.getByLabel(`Stage ${i + 1} name`).fill(stages[i]!);
  }
  for (const [n, chips] of Object.entries(approvers)) {
    const stage = Number(n);
    await admin.getByRole("switch", { name: "Needs approval" }).nth(stage - 1).click();
    for (const chip of chips) await admin.getByLabel(`Stage ${stage} approver: ${chip}`).check({ force: true });
  }
  await admin.getByRole("button", { name: "Create template" }).click();
  await admin.getByLabel("Search templates").fill(name);
  const chain = admin.getByRole("list", { name: `${name} stages` });
  await expect(chain.getByRole("listitem")).toHaveCount(stages.length, { timeout: 15_000 });
  const count = Object.keys(approvers).length;
  const row = admin.locator("li", { hasText: name });
  if (count > 0) await expect(row.getByTestId("approval-stage-count")).toHaveText(`${count} approval ${count === 1 ? "stage" : "stages"}`);
}

/** Admin: switch a template off so e2e runs don't pile up in every picker. */
async function deactivateTemplate(admin: Page, kind: Kind, name: string) {
  await admin.goto("/app/templates");
  await admin.waitForLoadState("networkidle");
  await admin.getByRole("tab", { name: kind }).click();
  await admin.getByLabel("Search templates").fill(name);
  await admin.locator("li", { hasText: name }).getByRole("button", { name: "Deactivate" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Deactivate" }).click();
  await expect(admin.getByText("Template deactivated.")).toBeVisible({ timeout: 15_000 });
}

/** A manager opens the New task form from /app/tasks and fills the assignee, template and title. */
async function startNewTask(page: Page, opts: { assignee: RegExp; assigneeSearch: string; template: string; title: string }) {
  await page.goto("/app/tasks");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "New task" }).click();
  await page.locator("#tf-assignee").fill(opts.assigneeSearch);
  await page.getByRole("option", { name: opts.assignee }).click();
  await page.locator("#tf-template").fill(opts.template);
  await page.locator('[role="listbox"] [role="option"]').filter({ hasText: opts.template }).first().click();
  await page.locator("#tf-title").fill(opts.title);
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByRole("heading", { name: opts.title })).toBeVisible({ timeout: 30_000 });
}

/** The editor (or anyone who can move the task) asks for approval of the current stage. */
async function requestApproval(page: Page, note?: string, link?: string) {
  await page.getByRole("button", { name: /^Request approval( again)?$/ }).click();
  const dialog = page.getByRole("dialog");
  if (note) await dialog.getByLabel("Note (optional)").fill(note);
  if (link) await dialog.getByLabel("Link to the work (optional)").fill(link);
  await dialog.getByRole("button", { name: "Request approval" }).click();
  await expect(page.getByTestId("approval-card").getByText("Waiting for approval")).toBeVisible({ timeout: 15_000 });
}

/** The row for an item on the Approvals page ("To decide" tab). */
function approvalRow(page: Page, title: string) {
  return page.getByTestId("approval-row").filter({ hasText: title });
}

/**
 * The user's example (round 3): a task template with 5 stages; stage 4 is approved by a Social Media
 * Manager or the Admin, stage 5 by the Admin only. The task can't pass 4 or be completed from 5
 * without those approvals.
 */
test("a 5-stage task template: stage 4 needs an SMM or the Admin, stage 5 needs the Admin; the editor can't pass either without a yes", async ({ browser }) => {
  const stamp = Date.now();
  const template = `Reel edit (approvals) ${stamp}`;
  const title = `E2E approval reel ${stamp}`;
  const stages = ["Brief", "Rough cut", "Fine cut", "Review", "Final"];

  const admin = await signedIn(browser, "admin@hok.test");
  await createTemplate(admin.page, "Tasks", template, stages, { 4: ["Social Media Manager", "Admin"], 5: ["Admin"] }, "Editor");

  // Rohan (SMM) gives Meera (Editor) a task from it.
  const smm = await signedIn(browser, "rohan.smm@hok.test");
  await startNewTask(smm.page, { assignee: /Meera Nair/, assigneeSearch: "Meera", template, title });
  const taskUrl = smm.page.url();
  await expect(smm.page.getByRole("list", { name: "Task stages" })).toBeVisible();

  // Meera jumps from stage 1 to stage 4: entering an approval stage is allowed; passing it is not.
  const meera = await signedIn(browser, "meera.editor@hok.test");
  await meera.page.goto(taskUrl);
  await expect(meera.page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
  await meera.page.getByLabel("Jump to a stage").selectOption({ label: "4. Review" });
  await meera.page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(meera.page.getByText("Stage 4 of 5").filter({ visible: true })).toBeVisible({ timeout: 15_000 });
  const forward = meera.page.getByRole("button", { name: "Move to Final" });
  await expect(forward).toBeDisabled();
  await expect(meera.page.getByTestId("move-blocked-reason")).toHaveText(/Needs approval at Review/);
  const card = meera.page.getByTestId("approval-card");
  await expect(card).toContainText("Needs approval from: Social Media Manager or Admin");

  // She asks; she can't answer her own request.
  await requestApproval(meera.page, "Please check the pacing.", "https://drive.google.com/file/d/e2e-review");
  await expect(card.getByRole("link", { name: /Open the work/ })).toHaveAttribute("rel", "noopener noreferrer");
  await expect(card.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Cancel request" })).toBeVisible(); // the requester can withdraw it

  // Rohan finds it on the Approvals page and approves.
  await smm.page.goto("/app/approvals");
  const rohanRow = approvalRow(smm.page, title);
  await expect(rohanRow).toBeVisible({ timeout: 15_000 });
  await expect(rohanRow).toContainText("Please check the pacing.");
  await rohanRow.getByRole("button", { name: "Approve" }).click();
  await expect(approvalRow(smm.page, title)).toHaveCount(0, { timeout: 15_000 });

  // Meera moves on to stage 5, which only the Admin can approve.
  await meera.page.reload();
  await expect(card).toContainText("Approved");
  await expect(card).toContainText("by Rohan Mehta");
  await meera.page.getByRole("button", { name: "Move to Final" }).click();
  await expect(meera.page.getByText("Stage 5 of 5").filter({ visible: true })).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText("Needs approval from: Admin");
  await expect(meera.page.getByRole("button", { name: "Mark complete" })).toBeDisabled();
  await expect(meera.page.getByTestId("move-blocked-reason")).toHaveText(/Needs approval at Final/);
  await requestApproval(meera.page);

  // Rohan is not an approver of stage 5: no row on his page and no Approve button on the task.
  await smm.page.goto("/app/approvals");
  await expect(smm.page.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible();
  await expect(approvalRow(smm.page, title)).toHaveCount(0);
  await smm.page.goto(taskUrl);
  await expect(smm.page.getByTestId("approval-card")).toContainText("Waiting for approval", { timeout: 15_000 });
  await expect(smm.page.getByTestId("approval-card").getByRole("button", { name: "Approve" })).toHaveCount(0);

  // The Admin approves; the dashboard lists what waits (only the 3 oldest, so just check the panel).
  await admin.page.goto("/app");
  await expect(admin.page.getByTestId("dashboard-approvals")).toBeVisible({ timeout: 30_000 });
  await admin.page.goto("/app/approvals");
  await approvalRow(admin.page, title).getByRole("button", { name: "Approve" }).click();
  await expect(approvalRow(admin.page, title)).toHaveCount(0, { timeout: 15_000 });

  // Now Meera can complete it.
  await meera.page.reload();
  await expect(meera.page.getByRole("button", { name: "Mark complete" })).toBeEnabled({ timeout: 15_000 });
  await meera.page.getByRole("button", { name: "Mark complete" }).click();
  await expect(meera.page.getByText("This task is done.")).toBeVisible({ timeout: 15_000 });
  await expect(meera.page.getByRole("list", { name: "Approval history" }).getByRole("listitem")).toHaveCount(2);

  // Clean up: Rohan deletes the task, the Admin switches the template off.
  await smm.page.getByRole("button", { name: "Delete" }).click();
  await smm.page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(smm.page).toHaveURL(/\/app\/tasks$/, { timeout: 30_000 });
  await deactivateTemplate(admin.page, "Tasks", template);
  await Promise.all([admin.ctx.close(), smm.ctx.close(), meera.ctx.close()]);
});

/** Rohan (SMM) creates a short event for Chai Point Cafe from the named event template. */
async function createEvent(page: Page, title: string, template: string) {
  await page.goto("/app/clients");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Search clients").fill("Chai Point Cafe");
  await page.getByRole("link", { name: /Chai Point Cafe/ }).first().click();
  await page.getByRole("tab", { name: "events" }).click();
  await page.getByRole("link", { name: "New event" }).click();
  await page.locator("#ev-title").fill(title);
  await page.locator("#ev-template").fill(template);
  await page.locator('[role="listbox"] [role="option"]').filter({ hasText: template }).first().click();
  await page.locator("#ev-start").fill("2026-11-21T10:00");
  await page.locator("#ev-end").fill("2026-11-21T12:00");
  await page.locator("#ev-location").fill("Video call: https://meet.google.com/e2e-shoot");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
}

/** Round 3: the client approves from the portal. Changes need a comment; after the fix the client approves and the event can move on. */
test("an event stage approved by the client: changes need a comment, then the client approves in the portal and the manager moves on", async ({ browser }) => {
  const stamp = Date.now();
  const template = `Shoot with sign-off ${stamp}`;
  const title = `E2E sign-off shoot ${stamp}`;

  const admin = await signedIn(browser, "admin@hok.test");
  await createTemplate(admin.page, "Events", template, ["Planned", "Client review", "Completed"], { 2: ["The client"] });

  const smm = await signedIn(browser, "rohan.smm@hok.test");
  await createEvent(smm.page, title, template);
  const eventUrl = smm.page.url();

  // Move to the client's stage; the way on is locked until the client says yes.
  await smm.page.locator("#mv-stage").selectOption({ label: "2. Client review" });
  await smm.page.getByRole("button", { name: "Move stage" }).click();
  await expect(smm.page.getByText("Stage 2 of 3")).toBeVisible({ timeout: 15_000 });
  await expect(smm.page.getByTestId("approval-card")).toContainText("Needs approval from: The client");
  await expect(smm.page.locator("#mv-stage option", { hasText: "3. Completed" })).toBeDisabled();
  await expect(smm.page.getByTestId("move-blocked-reason")).toContainText("Needs approval at Client review");
  await requestApproval(smm.page, "Here is the final cut, <b>please</b> review.", "https://drive.google.com/file/d/e2e-client-review");

  // The client asks for changes: a comment is required.
  const token = await newPortalToken(smm.page);
  const clientCtx = await browser.newContext();
  const portal = await clientCtx.newPage();
  await openPortalEvent(portal, token, title);
  // The event's "Location or link" is clickable for the client, in a new tab.
  const meet = portal.getByRole("dialog").getByRole("link", { name: "https://meet.google.com/e2e-shoot" });
  await expect(meet).toHaveAttribute("href", "https://meet.google.com/e2e-shoot");
  await expect(meet).toHaveAttribute("target", "_blank");
  const box = portal.getByTestId("portal-approval");
  await expect(box).toContainText("Your approval is needed: Client review");
  await expect(box).toContainText("<b>please</b>"); // shown as text, never as HTML
  await expect(box.getByRole("link", { name: /Open the work/ })).toHaveAttribute("rel", "noopener noreferrer");
  await box.getByRole("button", { name: "Request changes" }).click();
  await box.getByRole("button", { name: "Send changes" }).click();
  await expect(box.getByText("Please tell us what you would like changed.")).toBeVisible();
  await box.getByLabel("What would you like changed?").fill("Make the logo bigger.");
  await box.getByRole("button", { name: "Send changes" }).click();
  await expect(portal.getByTestId("portal-approval-thanks")).toBeVisible({ timeout: 15_000 });
  await expect(portal.getByTestId("portal-approval-history")).toContainText("Changes requested by you", { timeout: 15_000 });
  await expect(portal.getByTestId("portal-approval")).toHaveCount(0);

  // The manager sees the comment, moves the work back, and asks again (back to the event: making the portal link left the client page open).
  await smm.page.goto(eventUrl);
  await expect(smm.page.getByTestId("approval-card")).toContainText("Make the logo bigger.", { timeout: 15_000 });
  await expect(smm.page.getByTestId("approval-card")).toContainText("Move the work back to fix it, then request approval again.");
  await smm.page.locator("#mv-stage").selectOption({ label: "1. Planned" });
  await smm.page.getByRole("button", { name: "Move stage" }).click();
  await expect(smm.page.getByText("Stage 1 of 3")).toBeVisible({ timeout: 15_000 });
  await smm.page.locator("#mv-stage").selectOption({ label: "2. Client review" });
  await smm.page.getByRole("button", { name: "Move stage" }).click();
  await expect(smm.page.getByText("Stage 2 of 3")).toBeVisible({ timeout: 15_000 });
  await requestApproval(smm.page, "Logo is bigger now.");

  // The client approves.
  await openPortalEvent(portal, token, title);
  await portal.getByTestId("portal-approval").getByRole("button", { name: "Approve" }).click();
  await expect(portal.getByTestId("portal-approval-thanks")).toContainText("your approval is saved", { timeout: 15_000 });
  await expect(portal.getByTestId("portal-approval-history")).toContainText("Approved by you", { timeout: 15_000 });

  // The manager can move on now.
  await smm.page.reload();
  await expect(smm.page.getByTestId("approval-card")).toContainText("by the client", { timeout: 15_000 });
  await expect(smm.page.locator("#mv-stage option", { hasText: "3. Completed" })).toBeEnabled();
  await smm.page.locator("#mv-stage").selectOption({ label: "3. Completed" });
  await smm.page.getByRole("button", { name: "Move stage" }).click();
  await expect(smm.page.getByText("Stage 3 of 3")).toBeVisible({ timeout: 15_000 });
  await expect(smm.page.getByRole("list", { name: "Approval history" }).getByRole("listitem")).toHaveCount(2);

  await deactivateTemplate(admin.page, "Events", template);
  await Promise.all([admin.ctx.close(), smm.ctx.close(), clientCtx.close()]);
});

/** Round 3: nobody approves their own request. The screen offers no button and the API refuses with 403 STAGE_APPROVAL_SELF. */
test("an editor can't approve their own request: no button, and the API answers 403", async ({ browser }) => {
  const stamp = Date.now();
  const template = `Self check ${stamp}`;
  const title = `E2E self check ${stamp}`;

  const admin = await signedIn(browser, "admin@hok.test");
  // Stage 2 may be approved by any Editor or the Admin, so Meera is an approver of her own request.
  await createTemplate(admin.page, "Tasks", template, ["Draft", "Check"], { 2: ["Editor", "Admin"] }, "Editor");

  const smm = await signedIn(browser, "rohan.smm@hok.test");
  await startNewTask(smm.page, { assignee: /Meera Nair/, assigneeSearch: "Meera", template, title });
  const taskUrl = smm.page.url();

  const meera = await signedIn(browser, "meera.editor@hok.test");
  await meera.page.goto(taskUrl);
  await meera.page.getByRole("button", { name: "Move to Check" }).click();
  await expect(meera.page.getByText("Stage 2 of 2")).toBeVisible({ timeout: 15_000 });
  const posted = meera.page.waitForResponse((r) => r.url().endsWith("/approvals") && r.request().method() === "POST");
  await requestApproval(meera.page);
  const { approval } = (await (await posted).json()) as { approval: { id: string; version: number } };

  // No Approve / Request changes buttons for her.
  const card = meera.page.getByTestId("approval-card");
  await expect(card.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Request changes" })).toHaveCount(0);
  await meera.page.goto("/app/approvals");
  await expect(approvalRow(meera.page, title)).toHaveCount(0);

  // The API refuses even when asked directly.
  const status = await meera.page.evaluate(
    async ({ api, id, version }) => {
      const token = decodeURIComponent(document.cookie.match(/(?:^|; )hok_at=([^;]*)/)?.[1] ?? "");
      const res = await fetch(`${api}/approvals/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ version, decision: "approve" }),
      });
      return { status: res.status, body: (await res.json()) as { code?: string } };
    },
    { api: API, id: approval.id, version: approval.version },
  );
  expect(status.status).toBe(403);
  expect(status.body.code).toBe("STAGE_APPROVAL_SELF");

  // The Admin can approve it.
  await admin.page.goto("/app/approvals");
  await approvalRow(admin.page, title).getByRole("button", { name: "Approve" }).click();
  await expect(approvalRow(admin.page, title)).toHaveCount(0, { timeout: 15_000 });

  await smm.page.reload();
  await smm.page.getByRole("button", { name: "Delete" }).click();
  await smm.page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(smm.page).toHaveURL(/\/app\/tasks$/, { timeout: 30_000 });
  await deactivateTemplate(admin.page, "Tasks", template);
  await Promise.all([admin.ctx.close(), smm.ctx.close(), meera.ctx.close()]);
});
