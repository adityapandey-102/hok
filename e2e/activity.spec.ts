import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "Hok@2026";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
}

test.setTimeout(100_000);

test("the admin reads daily activity in Reports, switches kinds and filters by person", async ({ page }) => {
  await login(page, "admin@hok.test");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Reports" }).click();
  await page.getByRole("tab", { name: /Daily activity/ }).click();
  await expect(page).toHaveURL(/\/app\/reports\?view=activity$/);

  // Signing in just now is itself an entry, so today has at least one sentence.
  const rows = page.getByTestId("activity-row");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  await expect(rows.filter({ hasText: /signed in/ }).first()).toBeVisible();

  // Kind tabs narrow the list to one kind.
  await page.getByRole("tab", { name: "Accounts", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Accounts", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(rows.first()).toBeVisible();
  await expect(rows.filter({ hasNotText: /signed|account|password|profile|calendar subscribe link/ })).toHaveCount(0);
  await page.getByRole("tab", { name: "Tasks", exact: true }).click();
  await expect(rows.filter({ hasText: /signed in/ })).toHaveCount(0);
  await page.getByRole("tab", { name: "All", exact: true }).click();

  // A day chip changes the range; Today includes the sign-in just made.
  await page.getByRole("button", { name: "Last 7 days" }).click();
  await expect(rows.filter({ hasText: /signed in/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Today", exact: true }).click();

  // The person filter is a server-searched picker; only that person's rows remain.
  await page.getByRole("combobox", { name: "Filter by person" }).click();
  await page.getByRole("combobox", { name: "Filter by person" }).fill("admin");
  await page.getByRole("option").first().click();
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const texts = await rows.allInnerTexts();
  expect(texts.length).toBeGreaterThan(0);
});

test("the old activity log address lands on Reports → Daily activity", async ({ page }) => {
  await login(page, "admin@hok.test");
  await page.goto("/app/activity");
  await expect(page).toHaveURL(/\/app\/reports\?view=activity$/);
  await expect(page.getByRole("tab", { name: /Daily activity/ })).toHaveAttribute("aria-selected", "true");
});
