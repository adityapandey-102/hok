import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "Hok@2026";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle"); // submitted before hydration, the form does nothing
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
}

test.setTimeout(90_000);

test("a manager finds a client with Ctrl+K and opens it", async ({ page }) => {
  await login(page, "rohan.smm@hok.test");
  await page.keyboard.press("Control+k");
  const box = page.getByRole("combobox", { name: /Search clients, events, tasks/ });
  await expect(box).toBeFocused();
  await box.fill("Chai");
  await expect(page.getByRole("option", { name: /Chai Point Cafe/ }).first()).toBeVisible({ timeout: 15_000 });
  await box.press("Enter");
  await expect(page).toHaveURL(/\/app\/(clients|events|tasks)\//, { timeout: 30_000 });
});

test("an editor's search only offers their own tasks", async ({ page }) => {
  await login(page, "meera.editor@hok.test");
  await page.getByRole("button", { name: /Search/ }).first().click();
  await page.getByRole("combobox", { name: /Search clients, events, tasks/ }).fill("the");
  // Within the search window: the page around it (menu, tab bar) has its own "Tasks".
  const results = page.getByRole("dialog");
  await expect(results.getByText("Tasks", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(results.getByText("Clients", { exact: true })).toHaveCount(0);
});
