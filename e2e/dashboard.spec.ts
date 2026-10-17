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

const region = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const heading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true });

test("the admin sees the firm dashboard, their clients and their tasks", async ({ page }) => {
  await login(page, "admin@hok.test");
  await expect(heading(page, "Firm")).toBeVisible({ timeout: 15_000 });
  const totals = page.getByRole("group", { name: "Firm totals" });
  await expect(totals.getByRole("link", { name: /^Clients:/ })).toHaveAttribute("href", "/app/clients");
  await expect(totals.getByRole("link", { name: /^Active events:/ })).toHaveAttribute("href", "/app/calendar");
  await expect(totals.getByRole("link", { name: /^Open tasks:/ })).toHaveAttribute("href", "/app/tasks");
  await expect(totals.getByRole("link", { name: /^Unresolved comments:/ })).toHaveAttribute("href", "/app/comments");
  for (const name of ["Firm tasks by status", "Overdue tasks", "This week's firm events", "Latest unresolved comments", "Team workload"]) {
    await expect(region(page, name)).toBeVisible();
  }
  await expect(heading(page, "My clients")).toBeVisible();
  await expect(region(page, "Today's events")).toBeVisible();
  await expect(heading(page, "My tasks")).toBeVisible();
});

test("a social media manager sees their clients and tasks, not the firm", async ({ page }) => {
  await login(page, "rohan.smm@hok.test");
  await expect(heading(page, "My clients")).toBeVisible({ timeout: 15_000 });
  for (const name of ["Today's events", "Next 7 days", "Upcoming events", "Events by stage", "Latest comments"]) {
    await expect(region(page, name)).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /^Unresolved comments:/ })).toBeVisible();
  await expect(heading(page, "My tasks")).toBeVisible();
  await expect(heading(page, "Firm")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Firm totals" })).toHaveCount(0);
  await expect(region(page, "Team workload")).toHaveCount(0);
});

test("an editor sees only their tasks", async ({ page }) => {
  await login(page, "meera.editor@hok.test");
  await expect(heading(page, "My tasks")).toBeVisible({ timeout: 15_000 });
  await expect(region(page, "Open tasks")).toBeVisible();
  await expect(region(page, "Recent comments on my tasks")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Due today:/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Overdue:/ })).toBeVisible();
  await expect(heading(page, "My clients")).toHaveCount(0);
  await expect(heading(page, "Firm")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Firm totals" })).toHaveCount(0);
  await expect(region(page, "Today's events")).toHaveCount(0);
});
