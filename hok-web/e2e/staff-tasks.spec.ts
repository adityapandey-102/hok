import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "Hok@2026";

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

test.setTimeout(180_000);

/** Admin: a new TASK template (stages in order), offered for the given role only. */
async function createTaskTemplate(admin: Page, name: string, stages: string[], roleLabel: string) {
  await admin.goto("/app/templates");
  await admin.waitForLoadState("networkidle");
  await admin.getByRole("tab", { name: "Tasks" }).click();
  await admin.getByRole("button", { name: "New template" }).click();
  await admin.locator("#tpl-name").fill(name);
  await expect(admin.getByText("Empty = any role.")).toBeVisible();
  await admin.getByText(roleLabel, { exact: true }).click(); // the "For roles" chip
  await admin.getByLabel("Stage 1 name").fill(stages[0]!);
  await admin.getByLabel("Stage 2 name").fill(stages[1]!);
  for (let i = 2; i < stages.length; i++) {
    await admin.getByRole("button", { name: "Add stage" }).click();
    await admin.getByLabel(`Stage ${i + 1} name`).fill(stages[i]!);
  }
  await admin.getByRole("button", { name: "Create template" }).click();
  await admin.getByLabel("Search templates").fill(name);
  const chain = admin.getByRole("list", { name: `${name} stages` });
  await expect(chain.getByRole("listitem")).toHaveCount(stages.length, { timeout: 15_000 });
  await expect(admin.locator("li", { hasText: name }).getByText(`For: ${roleLabel}`)).toBeVisible();
}

/** Admin: switch a task template off so e2e runs don't pile up in every picker. */
async function deactivateTaskTemplate(admin: Page, name: string) {
  await admin.goto("/app/templates");
  await admin.waitForLoadState("networkidle");
  await admin.getByRole("tab", { name: "Tasks" }).click();
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
  // The template waits for an assignee: its role decides which templates are offered.
  await expect(page.locator("#tf-template")).toBeDisabled();
  await page.locator("#tf-assignee").fill(opts.assigneeSearch);
  await page.getByRole("option", { name: opts.assignee }).click();
  await page.locator("#tf-template").fill(opts.template);
  await page.locator('[role="listbox"] [role="option"]').filter({ hasText: opts.template }).first().click();
  await page.locator("#tf-title").fill(opts.title);
}

/** The SMM opens the client "Chai Point Cafe" and creates a short event; returns its title. */
async function createEvent(page: Page, title: string) {
  await page.goto("/app/clients");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Search clients").fill("Chai Point Cafe");
  await page.getByRole("link", { name: /Chai Point Cafe/ }).first().click();
  await page.getByRole("tab", { name: "events" }).click();
  await page.getByRole("link", { name: "New event" }).click();
  await page.locator("#ev-title").fill(title);
  await page.locator("#ev-start").fill("2026-11-21T10:00");
  await page.locator("#ev-end").fill("2026-11-21T12:00");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
}

/** The SMM generates a fresh portal link for Chai Point Cafe and returns its token. */
async function newPortalToken(page: Page): Promise<string> {
  await page.goto("/app/clients");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Search clients").fill("Chai Point Cafe");
  await page.getByRole("link", { name: /Chai Point Cafe/ }).first().click();
  await page.getByRole("tab", { name: "portal" }).click();
  await expect(page.getByRole("button", { name: /^(Re)?generate link$/i })).toBeVisible({ timeout: 15_000 });
  const hasActive = await page.getByRole("button", { name: "Regenerate link" }).isVisible().catch(() => false);
  await page.getByRole("button", { name: hasActive ? "Regenerate link" : "Generate link" }).click();
  await page.getByRole("dialog").getByRole("button", { name: hasActive ? "Regenerate" : "Generate", exact: true }).click();
  const urlText = (await page.getByTestId("portal-url").textContent({ timeout: 15_000 })) ?? "";
  return urlText.trim().split("/").pop()!;
}

/** The client's side: open /p/<token> and the named event's page (the hero card or a list row). */
async function openPortalEvent(portal: Page, token: string, eventTitle: string) {
  await portal.goto(`/p/${token}`);
  await expect(portal.getByRole("heading", { name: "Happening now / next" })).toBeVisible({ timeout: 30_000 });
  const row = portal.getByRole("button", { name: new RegExp(eventTitle) }).first();
  if (!(await row.isVisible())) {
    for (const more of await portal.getByRole("button", { name: /^Show all/ }).all()) if (await more.isVisible()) await more.click();
  }
  if (await row.isVisible()) await row.click();
  else await portal.getByRole("button", { name: "See updates" }).click(); // the event is the hero card
  await expect(portal.getByRole("dialog").getByRole("heading", { name: eventTitle })).toBeVisible({ timeout: 15_000 });
}

/**
 * Round 2: the Admin makes a task template for Editors; an SMM assigns a task with it; the editor
 * flags it blocked, unblocks it, moves it through the stages, adds a delivered link and completes
 * it; the SMM sees it done. The template picker only offers templates for the assignee's role.
 */
test("a task template drives a task: the SMM assigns, the editor moves it through the stages and completes it, the SMM sees it done", async ({ browser }) => {
  const stamp = Date.now();
  const template = `E2E Reel edit ${stamp}`;
  const title = `E2E reel ${stamp}`;
  const admin = await signedIn(browser, "admin@hok.test");
  await createTaskTemplate(admin.page, template, ["Rough cut", "Review", "Final"], "Editor");

  // Rohan (SMM) assigns it to Meera (Editor). The template is only offered once the assignee is known.
  const smm = await signedIn(browser, "rohan.smm@hok.test");
  await startNewTask(smm.page, { assignee: /Meera Nair/, assigneeSearch: "Meera", template, title });
  await expect(smm.page.getByRole("list", { name: "Stages of the chosen template" }).getByRole("listitem")).toHaveText([/Rough cut/, /Review/, /Final/]);
  await smm.page.locator("#tf-brief").fill("Open on the product, end on the logo.");
  await smm.page.getByRole("button", { name: "Add link" }).click();
  await smm.page.getByLabel("Link 1 address").fill("https://drive.google.com/drive/folders/e2e-raw");
  await smm.page.getByLabel("Link 1 label").fill("Raw files");
  await smm.page.getByRole("button", { name: "Create task" }).click();
  await expect(smm.page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
  const taskUrl = smm.page.url();
  expect(taskUrl).toMatch(/\/app\/tasks\/[0-9a-f-]{36}$/);
  await expect(smm.page.getByText("Open on the product, end on the logo.")).toBeVisible();
  const briefLinks = smm.page.getByRole("region", { name: "Brief and inputs" });
  await expect(briefLinks.getByRole("link", { name: "Raw files" })).toHaveAttribute("rel", "noopener noreferrer");
  await expect(smm.page.getByRole("list", { name: "Task stages" })).toBeVisible();
  await expect(smm.page.getByText("Stage 1 of 3")).toBeVisible();

  // Meera finds it in "My tasks".
  const meera = await signedIn(browser, "meera.editor@hok.test");
  await meera.page.goto("/app/tasks");
  await expect(meera.page.getByRole("heading", { name: "My tasks" })).toBeVisible();
  await meera.page.getByLabel("Search tasks").fill(title);
  await expect(meera.page.getByText("Rough cut · 1/3").filter({ visible: true })).toBeVisible({ timeout: 15_000 }); // the list row shows the stage
  await meera.page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(meera.page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
  // The assignee can't add brief links or edit, but can deliver.
  await expect(meera.page.getByRole("region", { name: "Brief and inputs" }).getByRole("button", { name: "Add link" })).toHaveCount(0);
  await expect(meera.page.getByRole("button", { name: /Edit or reassign/ })).toHaveCount(0);

  // Blocked needs a reason; unblocking clears the banner.
  await meera.page.getByRole("button", { name: "Mark blocked" }).click();
  await expect(meera.page.getByRole("button", { name: "Mark blocked" }).last()).toBeDisabled();
  await meera.page.locator("#task-block-reason").fill("Waiting for the raw files");
  await meera.page.getByRole("button", { name: "Mark blocked" }).last().click();
  const banner = meera.page.getByTestId("blocked-banner");
  await expect(banner).toContainText("Waiting for the raw files", { timeout: 15_000 });
  await banner.getByRole("button", { name: "Unblock" }).click();
  await expect(banner).toHaveCount(0, { timeout: 15_000 });

  // Move through the stages: next, then the last, then complete.
  await meera.page.locator("#task-comment").fill("Starting the cut now.");
  await meera.page.getByRole("button", { name: "Move to Review" }).click();
  await expect(meera.page.getByText("Starting the cut now.")).toBeVisible({ timeout: 15_000 });
  await expect(meera.page.getByText("Stage 2 of 3")).toBeVisible();
  await expect(meera.page.getByText("moved it Rough cut → Review")).toBeVisible();
  await meera.page.getByLabel("Jump to a stage").selectOption({ label: "3. Final" });
  await meera.page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(meera.page.getByText("Stage 3 of 3")).toBeVisible({ timeout: 15_000 });

  // A delivered link, then complete. The assignee has no "Share with client" (no event on this task).
  const delivered = meera.page.getByRole("region", { name: "Delivered work" });
  await delivered.getByRole("button", { name: "Add link" }).click();
  await delivered.getByLabel("Address").fill("https://drive.google.com/file/d/e2e-final");
  await delivered.getByLabel("Label (optional)").fill("Final cut");
  await delivered.getByLabel("Stage (optional)").selectOption({ label: "3. Final" });
  await delivered.getByRole("button", { name: "Add link", exact: true }).last().click();
  await expect(delivered.getByRole("link", { name: "Final cut" })).toBeVisible({ timeout: 15_000 });
  await expect(delivered.getByRole("button", { name: /Share with client/ })).toHaveCount(0);
  await meera.page.getByRole("button", { name: "Mark complete" }).click();
  await expect(meera.page.getByText("This task is done. Only the person who gave it (or the Admin) can reopen it.")).toBeVisible({ timeout: 15_000 });
  await expect(meera.page.getByText("completed it")).toBeVisible();

  // Arjun (Developer) can't open Meera's task.
  const arjun = await signedIn(browser, "arjun.dev@hok.test");
  expect((await arjun.page.goto(taskUrl))?.status()).toBe(404);

  // Rohan sees it done, and reopens it at the first stage.
  await smm.page.reload();
  await expect(smm.page.getByText("Complete", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(smm.page.getByText("completed it")).toBeVisible();
  await smm.page.getByLabel("Reopen at").selectOption({ label: "1. Rough cut" });
  await smm.page.getByRole("button", { name: "Reopen", exact: true }).click();
  await smm.page.getByRole("dialog").getByRole("button", { name: "Reopen" }).click();
  await expect(smm.page.getByText("reopened it at Rough cut")).toBeVisible({ timeout: 15_000 });

  // Clean up: Rohan (who gave it) deletes the task; the Admin switches the template off.
  await smm.page.getByRole("button", { name: "Delete" }).click();
  await smm.page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(smm.page).toHaveURL(/\/app\/tasks$/, { timeout: 30_000 });
  await deactivateTaskTemplate(admin.page, template);

  await Promise.all([admin.ctx.close(), smm.ctx.close(), meera.ctx.close(), arjun.ctx.close()]);
});

/**
 * Round 2: the delivered link of a task that belongs to an event is shared with the client by the
 * manager (not by the editor), and the client's portal shows it under "Shared with you".
 */
test("the SMM shares a delivered link with the client; the portal event page shows it under Shared with you", async ({ browser }) => {
  const stamp = Date.now();
  const eventTitle = `E2E Reel shoot ${stamp}`;
  const title = `E2E shared reel ${stamp}`;
  const shared = `E2E Final reel ${stamp}`;

  const smm = await signedIn(browser, "rohan.smm@hok.test");
  await createEvent(smm.page, eventTitle);

  // Rohan gives Meera a task on that event, with any template offered for editors.
  await startNewTask(smm.page, { assignee: /Meera Nair/, assigneeSearch: "Meera", template: "", title });
  await smm.page.locator("#tf-client").fill("Chai Point Cafe");
  await smm.page.getByRole("option", { name: /Chai Point Cafe/ }).first().click();
  await smm.page.locator("#tf-event").fill(eventTitle);
  await smm.page.getByRole("option", { name: new RegExp(eventTitle) }).click();
  await smm.page.getByRole("button", { name: "Create task" }).click();
  await expect(smm.page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
  const taskUrl = smm.page.url();

  // Meera delivers a link. She can't share it.
  const meera = await signedIn(browser, "meera.editor@hok.test");
  await meera.page.goto(taskUrl);
  const delivered = meera.page.getByRole("region", { name: "Delivered work" });
  await delivered.getByRole("button", { name: "Add link" }).click();
  await delivered.getByLabel("Address").fill("https://drive.google.com/file/d/e2e-share");
  await delivered.getByLabel("Label (optional)").fill("Final reel");
  await delivered.getByRole("button", { name: "Add link", exact: true }).last().click();
  await expect(delivered.getByRole("link", { name: "Final reel" })).toBeVisible({ timeout: 15_000 });
  await expect(delivered.getByRole("button", { name: /Share with client/ })).toHaveCount(0);

  // Rohan shares it with a title and an event stage.
  await smm.page.reload();
  const smmDelivered = smm.page.getByRole("region", { name: "Delivered work" });
  await smmDelivered.getByRole("button", { name: "Share with client" }).click();
  const dialog = smm.page.getByRole("dialog");
  await dialog.getByLabel("Title the client sees").fill(shared);
  await expect(dialog.getByLabel("Event stage (optional)")).toBeEnabled({ timeout: 15_000 });
  await dialog.getByLabel("Event stage (optional)").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Share with client" }).click();
  await expect(smmDelivered.getByText("Shared with client")).toBeVisible({ timeout: 15_000 });
  await expect(smmDelivered.getByRole("button", { name: "Share with client" })).toHaveCount(0);

  // The client opens the portal and the event: the link is under "Shared with you".
  const token = await newPortalToken(smm.page);
  const clientCtx = await browser.newContext();
  const portal = await clientCtx.newPage();
  await openPortalEvent(portal, token, eventTitle);
  const section = portal.getByRole("region", { name: "Shared with you" });
  await expect(section).toBeVisible({ timeout: 15_000 });
  const link = section.getByRole("link", { name: shared });
  await expect(link).toHaveAttribute("href", "https://drive.google.com/file/d/e2e-share");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  // Nothing internal comes along.
  await expect(section).not.toContainText("Meera");
  await expect(section).not.toContainText("Rohan");

  // Clean up: Rohan deletes the task and the shared asset.
  await smm.page.goto(taskUrl);
  await smm.page.getByRole("button", { name: "Delete" }).click();
  await smm.page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(smm.page).toHaveURL(/\/app\/tasks$/, { timeout: 30_000 });
  await smm.page.goto("/app/assets");
  await smm.page.getByLabel("Search assets").fill(shared);
  await smm.page.getByRole("button", { name: `Delete ${shared}` }).click();
  await smm.page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(smm.page.getByRole("button", { name: `Delete ${shared}` })).toHaveCount(0, { timeout: 15_000 });

  await Promise.all([smm.ctx.close(), meera.ctx.close(), clientCtx.close()]);
});

/**
 * Round 2: "Show to client" on an asset puts it on the event page in the portal; an asset left
 * unmarked (even on the same event) never appears there.
 */
test("only an asset marked Show to client appears in the portal; an unmarked one never does", async ({ browser }) => {
  const stamp = Date.now();
  const eventTitle = `E2E Portal assets ${stamp}`;
  const visible = `E2E visible ${stamp}`;
  const hidden = `E2E hidden ${stamp}`;

  const smm = await signedIn(browser, "rohan.smm@hok.test");
  const page = smm.page;
  await createEvent(page, eventTitle);

  async function addAsset(title: string, showToClient: boolean) {
    await page.goto("/app/clients");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Search clients").fill("Chai Point Cafe");
    await page.getByRole("link", { name: /Chai Point Cafe/ }).first().click();
    await page.getByRole("tab", { name: "assets" }).click();
    await page.getByRole("button", { name: "Add asset" }).first().click();
    await page.locator("#asset-title").fill(title);
    await page.locator("#asset-url").fill(`https://drive.google.com/drive/folders/${showToClient ? "e2e-visible" : "e2e-hidden"}`);
    // The switch stays off until an event is picked.
    await expect(page.getByRole("switch", { name: "Show to client" })).toBeDisabled();
    await page.locator("#asset-event").fill(eventTitle);
    await page.getByRole("option", { name: new RegExp(eventTitle) }).click();
    await expect(page.getByRole("switch", { name: "Show to client" })).toBeEnabled();
    if (showToClient) {
      await page.getByRole("switch", { name: "Show to client" }).click();
      await expect(page.getByRole("switch", { name: "Show to client" })).toHaveAttribute("aria-checked", "true");
      await expect(page.getByLabel("Event stage (optional)")).toBeEnabled({ timeout: 15_000 });
      await page.getByLabel("Event stage (optional)").selectOption({ index: 1 });
    }
    await page.getByRole("button", { name: "Add asset" }).last().click();
    await page.getByLabel("Search assets").fill(title);
    await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible({ timeout: 15_000 });
    const row = page.locator("li", { hasText: title });
    if (showToClient) await expect(row.getByText("Client can see")).toBeVisible();
    else await expect(row.getByText("Client can see")).toHaveCount(0);
  }
  await addAsset(visible, true);
  await addAsset(hidden, false);

  const token = await newPortalToken(page);
  const clientCtx = await browser.newContext();
  const portal = await clientCtx.newPage();
  await openPortalEvent(portal, token, eventTitle);
  const section = portal.getByRole("region", { name: "Shared with you" });
  await expect(section.getByRole("link", { name: visible })).toBeVisible({ timeout: 15_000 });
  await expect(portal.getByText(hidden)).toHaveCount(0);
  await expect(section.getByRole("listitem")).toHaveCount(1);

  // Clean up the two assets (the filter "Client can see" finds the visible one).
  await page.goto("/app/assets");
  for (const title of [visible, hidden]) {
    await page.getByLabel("Search assets").fill(title);
    await page.getByRole("button", { name: `Delete ${title}` }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name: `Delete ${title}` })).toHaveCount(0, { timeout: 15_000 });
  }

  await Promise.all([smm.ctx.close(), clientCtx.close()]);
});
