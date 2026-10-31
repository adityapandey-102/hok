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

test.setTimeout(100_000);

test("the admin opens Reports: team status, then Meera Nair's month, then Chai Point Cafe's month", async ({ page }) => {
  await login(page, "admin@hok.test");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Reports" }).click();
  await expect(page).toHaveURL(/\/app\/reports$/);

  // Team status is the default tab: rows, the rule, and the filters.
  await expect(page.getByRole("tab", { name: /Team status/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Team status", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/means they have open tasks and were seen or did something/)).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByText("Meera Nair")).toBeVisible();
  await expect(table.getByText(/^(Working|Idle)$/).first()).toBeVisible();
  await page.getByLabel("Search staff by name").fill("Meera");
  await expect(page.getByText(/^1 person/)).toBeVisible();
  await expect(table.getByText("Meera Nair")).toBeVisible();

  // Staff report: pick a person, then the month and the figures.
  await page.getByRole("tab", { name: /Staff report/ }).click();
  await expect(page).toHaveURL(/view=staff/);
  await page.getByRole("combobox", { name: "Person" }).click();
  await page.getByRole("combobox", { name: "Person" }).fill("Meera");
  await page.getByRole("option", { name: /Meera Nair/ }).click();
  await expect(page.getByRole("region", { name: /^Meera Nair, / })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("img", { name: /Tasks assigned vs completed per week/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Month" })).toBeVisible();

  // Client report: pick a client, then the figures.
  await page.getByRole("tab", { name: /Client report/ }).click();
  await expect(page).toHaveURL(/view=client/);
  await page.getByRole("combobox", { name: "Client" }).click();
  await page.getByRole("combobox", { name: "Client" }).fill("Chai Point");
  await page.getByRole("option", { name: /Chai Point Cafe/ }).click();
  await expect(page.getByRole("region", { name: /^Chai Point Cafe, / })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("region", { name: "Events", exact: true })).toBeVisible();
});

test("Reports is for the admin only", async ({ page }) => {
  await login(page, "meera.editor@hok.test");
  await page.goto("/app/reports");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Reports" })).toHaveCount(0);
});
