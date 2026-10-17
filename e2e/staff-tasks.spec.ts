import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "Hok@2026";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
}

test.setTimeout(150_000);

/**
 * M7 critical flow: the Admin assigns an editor task (the editor brief is
 * required), the editor works it to Done with a comment, another staff member
 * can't open it, and the Admin reopens it. Needs migration 20261014200001 and
 * the seeded accounts.
 */
test("the Admin assigns an editor task; the editor closes it; the Admin reopens it", async ({ browser }) => {
  const title = `E2E edit ${Date.now()}`;

  // Aisha (Admin) creates the task for Meera (Editor).
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, "admin@hok.test");
  await admin.goto("/app/tasks");
  await admin.getByRole("button", { name: "New task" }).click();
  await admin.locator("#tf-title").fill(title);
  await admin.locator("#tf-assignee").fill("Meera");
  await admin.getByRole("option", { name: /Meera Nair/ }).click();
  // Picking an editor shows the brief, and the raw files link is required.
  await admin.getByRole("button", { name: "Create task" }).click();
  await expect(admin.getByText("An editor task needs the raw files (Google Drive) link")).toBeVisible();
  await admin.locator("#tf-raw").fill("https://drive.google.com/drive/folders/e2e-raw");
  await admin.locator("#tf-script").fill("Open on the product, end on the logo.");
  await admin.getByRole("button", { name: "Create task" }).click();
  await expect(admin.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
  const taskUrl = admin.url();
  expect(taskUrl).toMatch(/\/app\/tasks\/[0-9a-f-]{36}$/);
  await expect(admin.getByText("Editor brief")).toBeVisible();

  // Meera finds it in "My tasks" and works it to Done.
  const meeraCtx = await browser.newContext();
  const meera = await meeraCtx.newPage();
  await login(meera, "meera.editor@hok.test");
  await expect(meera.getByRole("link", { name: "Tasks" })).toBeVisible();
  await meera.goto("/app/tasks");
  await expect(meera.getByRole("heading", { name: "My tasks" })).toBeVisible();
  await meera.getByLabel("Search tasks").fill(title);
  await meera.getByRole("link", { name: new RegExp(title) }).click();
  await expect(meera.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
  await meera.locator("#task-comment").fill("Starting the cut now.");
  await meera.getByRole("button", { name: "Start / In progress" }).click();
  await expect(meera.getByText("Starting the cut now.")).toBeVisible();
  await meera.getByRole("button", { name: "Mark done" }).click();
  await expect(meera.getByText("This task is done. Only the Admin can reopen it.")).toBeVisible();

  // Arjun (Developer) can't open Meera's task.
  const arjunCtx = await browser.newContext();
  const arjun = await arjunCtx.newPage();
  await login(arjun, "arjun.dev@hok.test");
  const response = await arjun.goto(taskUrl);
  expect(response?.status()).toBe(404);

  // The Admin reopens it.
  await admin.reload();
  await expect(admin.getByText("Done").first()).toBeVisible();
  await admin.getByRole("button", { name: "Reopen (To do)" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Reopen" }).click();
  await expect(admin.getByText("reopened it (To do)")).toBeVisible();

  // Clean up: the Admin deletes the E2E task.
  await admin.getByRole("button", { name: "Delete" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(admin).toHaveURL(/\/app\/tasks$/, { timeout: 30_000 });

  await Promise.all([adminCtx.close(), meeraCtx.close(), arjunCtx.close()]);
});
