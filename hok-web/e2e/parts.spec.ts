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

type Kind = "Events" | "Tasks";

/** Admin: a new template with the given stage names (no approvals, any role). */
async function createTemplate(admin: Page, kind: Kind, name: string, stages: string[]) {
  await admin.goto("/app/templates");
  await admin.waitForLoadState("networkidle");
  await admin.getByRole("tab", { name: kind }).click();
  await admin.getByRole("button", { name: "New template" }).click();
  await admin.locator("#tpl-name").fill(name);
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

/** Rohan (SMM) creates a short event for Chai Point Cafe from the named event template. */
async function createEvent(page: Page, title: string, template: string) {
  await page.goto("/app/clients");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Search clients").fill("Chai Point Cafe");
  await page.getByRole("link", { name: /Chai Point Cafe/ }).first().click();
  await page.getByRole("tab", { name: "events" }).click();
  await page.getByRole("link", { name: "New event" }).click();
  await page.locator("#ev-title").fill(title);
  await pickTemplate(page, template);
  await page.locator("#ev-start").fill("2026-11-21T10:00");
  await page.locator("#ev-end").fill("2026-11-21T12:00");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
}

async function pickTemplate(page: Page, template: string) {
  await page.locator("#ev-template").fill(template);
  await page.locator('[role="listbox"] [role="option"]').filter({ hasText: template }).first().click();
}

/** Sets the Parts panel's stage picker to `stage` (options read "3. Production"). */
async function pickPartStage(page: Page, stage: string) {
  const select = page.getByLabel("Stage for the new part");
  const value = await select.locator("option").filter({ hasText: new RegExp(`^\\d+\\. ${stage}$`) }).getAttribute("value");
  await select.selectOption(value!);
}

/**
 * On an event page: "Add part" under `stage`, choose Event, say how many, fill the form once and create.
 * With `expectBack` the page returns to the parent; otherwise the form stays (a refusal) and the caller checks it.
 */
async function addEventParts(page: Page, stage: string, count: number, title: string, template: string, expectBack = true) {
  const parentUrl = page.url();
  await pickPartStage(page, stage);
  await page.getByRole("button", { name: `Add part at ${stage}` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Add a part" })).toBeVisible();
  await dialog.locator("#part-count").fill(String(count));
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: count > 1 ? `New parts (${count} events)` : "New part (event)" })).toBeVisible({ timeout: 15_000 });
  await page.locator("#ev-title").fill(title);
  await pickTemplate(page, template);
  await page.locator("#ev-start").fill("2026-11-22T10:00");
  await page.locator("#ev-end").fill("2026-11-22T11:00");
  await page.getByRole("button", { name: count > 1 ? `Create ${count} events` : "Create event" }).click();
  if (expectBack) {
    await expect(page).toHaveURL(parentUrl, { timeout: 60_000 });
    await expect(page.getByTestId("parts-panel")).toBeVisible({ timeout: 15_000 });
  }
}

/** Move the event on its page to a stage ("3. Delivered"). */
async function moveEvent(page: Page, label: string, reached: string) {
  await page.locator("#mv-stage").selectOption({ label });
  await page.getByRole("button", { name: "Move stage" }).click();
  await expect(page.getByText(reached)).toBeVisible({ timeout: 15_000 });
}

test.describe.serial("parts (parent and child work)", () => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const eventTemplate = `Parts shoot ${stamp}`;
  const taskTemplate = `Parts task ${stamp}`;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000); // hooks have their own timeout
    const admin = await signedIn(browser, "admin@hok.test");
    await createTemplate(admin.page, "Events", eventTemplate, ["Planned", "Production", "Delivered"]);
    await createTemplate(admin.page, "Tasks", taskTemplate, ["Plan", "Make", "Wrap up"]);
    await admin.ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    test.setTimeout(240_000);
    const admin = await signedIn(browser, "admin@hok.test");
    await deactivateTemplate(admin.page, "Events", eventTemplate);
    await deactivateTemplate(admin.page, "Tasks", taskTemplate);
    await admin.ctx.close();
  });

  /** The user's example: "10 reels" (3 here). The parent can't pass Production until every reel reaches its last stage. */
  test("an SMM adds 3 child events at stage 2; the parent can't pass it until all 3 reach their last stage", async ({ browser }) => {
    const title = `E2E reels ${stamp}`;
    const smm = await signedIn(browser, "rohan.smm@hok.test");
    const page = smm.page;
    await createEvent(page, title, eventTemplate);
    const parentUrl = page.url();
    await moveEvent(page, "2. Production", "Stage 2 of 3");

    // "How many = 3": three events are made one after another, then the page returns to the parent.
    await addEventParts(page, "Production", 3, `E2E reel ${stamp}`, eventTemplate);
    const rows = page.getByTestId("part-row");
    for (const n of [1, 2, 3]) await expect(rows.filter({ hasText: `E2E reel ${stamp} ${n}` })).toHaveCount(1);
    await expect(page.getByTestId("parts-stage").filter({ hasText: "Production" })).toContainText("3 unfinished");
    await expect(page.getByTestId("stage-parts-badge")).toHaveText("3");

    // Locked: the next stage can't be chosen and the reason names the parts.
    await expect(page.locator("#mv-stage option", { hasText: "3. Delivered" })).toBeDisabled();
    await expect(page.getByTestId("move-blocked-reason")).toContainText("Waiting for 3 parts at Production");

    // Each reel: its page says "Part of: <parent> › Production"; moving it to its last stage finishes it.
    const hrefs = await rows.getByRole("link").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!));
    expect(hrefs).toHaveLength(3);
    for (const [i, href] of hrefs.entries()) {
      await page.goto(href);
      await expect(page.getByTestId("part-of")).toContainText(title);
      await expect(page.getByTestId("part-of")).toContainText("Production");
      await moveEvent(page, "3. Delivered", "Stage 3 of 3");
      // After the last one, the parent has nothing holding it.
      if (i < hrefs.length - 1) {
        await page.goto(parentUrl);
        await expect(page.getByTestId("move-blocked-reason")).toContainText(`Waiting for ${hrefs.length - 1 - i} part`);
      }
    }

    await page.goto(parentUrl);
    await expect(page.getByTestId("parts-stage").filter({ hasText: "Production" })).toContainText("All finished", { timeout: 15_000 });
    await expect(page.getByTestId("move-blocked-reason")).toHaveCount(0);
    await expect(page.locator("#mv-stage option", { hasText: "3. Delivered" })).toBeEnabled();
    await moveEvent(page, "3. Delivered", "Stage 3 of 3");
    await smm.ctx.close();
  });

  /** A task parent: its assignee (an SMM) hands a child task to an editor; the parent waits until the editor completes it. */
  test("an SMM adds a child task for an editor; the parent task waits until the editor completes it", async ({ browser }) => {
    const title = `E2E parent task ${stamp}`;
    const childTitle = `E2E child task ${stamp}`;

    // The Admin gives Rohan the parent task.
    const admin = await signedIn(browser, "admin@hok.test");
    await admin.page.goto("/app/tasks");
    await admin.page.waitForLoadState("networkidle");
    await admin.page.getByRole("button", { name: "New task" }).click();
    await admin.page.locator("#tf-assignee").fill("Rohan");
    await admin.page.getByRole("option", { name: /Rohan Mehta/ }).click();
    await admin.page.locator("#tf-template").fill(taskTemplate);
    await admin.page.locator('[role="listbox"] [role="option"]').filter({ hasText: taskTemplate }).first().click();
    await admin.page.locator("#tf-title").fill(title);
    await admin.page.getByRole("button", { name: "Create task" }).click();
    await expect(admin.page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
    const parentUrl = admin.page.url();
    await admin.ctx.close();

    // Rohan adds a child task under stage 1 ("Plan"): the only kind offered, since the parent has no client for an event.
    const smm = await signedIn(browser, "rohan.smm@hok.test");
    const page = smm.page;
    await page.goto(parentUrl);
    await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
    await pickPartStage(page, "Plan");
    await page.getByRole("button", { name: "Add part at Plan" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("An event part needs a client, and this task has none.")).toBeVisible();
    await dialog.getByRole("button", { name: "Continue" }).click();
    const form = page.getByRole("dialog");
    await expect(form.getByText(/Part of E2E parent task .* › Plan/)).toBeVisible();
    await form.locator("#tf-assignee").fill("Meera");
    await page.getByRole("option", { name: /Meera Nair/ }).click();
    await form.locator("#tf-template").fill(taskTemplate);
    await page.locator('[role="listbox"] [role="option"]').filter({ hasText: taskTemplate }).first().click();
    await form.locator("#tf-title").fill(childTitle);
    await form.getByRole("button", { name: "Create task" }).click();
    const row = page.getByTestId("part-row").filter({ hasText: childTitle });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("parts-stage").filter({ hasText: "Plan" })).toContainText("1 unfinished");

    // The parent can't leave Plan.
    await expect(page.getByRole("button", { name: "Move to Make" })).toBeDisabled();
    await expect(page.getByTestId("move-blocked-reason")).toContainText("Waiting for 1 part at Plan");

    // Meera does the child task through to the end.
    const childUrl = await row.getByRole("link").getAttribute("href");
    const meera = await signedIn(browser, "meera.editor@hok.test");
    await meera.page.goto(childUrl!);
    await expect(meera.page.getByRole("heading", { name: childTitle })).toBeVisible({ timeout: 30_000 });
    // Meera can't see Rohan's parent task, so the API sends no parent and nothing about it shows.
    await expect(meera.page.getByTestId("part-of")).toHaveCount(0);
    await meera.page.getByRole("button", { name: "Move to Make" }).click();
    await expect(meera.page.getByText("Stage 2 of 3")).toBeVisible({ timeout: 15_000 });
    await meera.page.getByRole("button", { name: "Move to Wrap up" }).click();
    await expect(meera.page.getByText("Stage 3 of 3")).toBeVisible({ timeout: 15_000 });
    await meera.page.getByRole("button", { name: "Mark complete" }).click();
    await expect(meera.page.getByText("All stages done")).toBeVisible({ timeout: 15_000 });
    await meera.ctx.close();

    // Rohan's parent is free to move on.
    await page.goto(parentUrl);
    await expect(page.getByTestId("part-row").filter({ hasText: childTitle })).toContainText("Done", { timeout: 15_000 });
    await expect(page.getByTestId("move-blocked-reason")).toHaveCount(0);
    await page.getByRole("button", { name: "Move to Make" }).click();
    await expect(page.getByText("Stage 2 of 3")).toBeVisible({ timeout: 15_000 });
    await smm.ctx.close();
  });

  /** Depth: a part of a part of a part is refused, and the message shows on the form. */
  test("a part of a part of a part is refused with a message", async ({ browser }) => {
    const smm = await signedIn(browser, "rohan.smm@hok.test");
    const page = smm.page;
    await createEvent(page, `E2E depth top ${stamp}`, eventTemplate);

    // Level 2, then level 3, each opened from its parent's Parts section.
    await addEventParts(page, "Planned", 1, `E2E depth child ${stamp}`, eventTemplate);
    await page.getByTestId("part-row").filter({ hasText: `E2E depth child ${stamp}` }).getByRole("link").click();
    await expect(page.getByRole("heading", { name: `E2E depth child ${stamp}` })).toBeVisible({ timeout: 30_000 });
    await addEventParts(page, "Planned", 1, `E2E depth grandchild ${stamp}`, eventTemplate);
    await page.getByTestId("part-row").filter({ hasText: `E2E depth grandchild ${stamp}` }).getByRole("link").click();
    await expect(page.getByRole("heading", { name: `E2E depth grandchild ${stamp}` })).toBeVisible({ timeout: 30_000 });

    // Level 4: refused.
    await addEventParts(page, "Planned", 1, `E2E depth too deep ${stamp}`, eventTemplate, false);
    await expect(page.getByText(/Parts can only go 3 levels deep/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "New part (event)" })).toBeVisible();
    await smm.ctx.close();
  });
});
