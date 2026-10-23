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

const hero = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test("the admin's dashboard is the firm alone, with previews that link to full lists", async ({ page }) => {
  await login(page, "admin@hok.test");
  const band = hero(page, "The firm at a glance");
  await expect(band).toBeVisible({ timeout: 15_000 });
  await expect(band.getByRole("link", { name: /Clients/ })).toHaveAttribute("href", "/app/clients");
  await expect(band.getByRole("link", { name: /Overdue/ })).toHaveAttribute("href", "/app/tasks?due=overdue");
  await expect(band.getByRole("link", { name: /Client comments/ })).toHaveAttribute("href", "/app/comments");
  for (const name of ["Tasks by status", "Overdue tasks", "This week", "Client comments", "Team workload"]) {
    await expect(region(page, name)).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Team workload" }).getByRole("link", { name: /^See all \d+$/ })).toHaveAttribute("href", "/app/team");
  // The Admin's own clients and tasks are on their own page.
  await expect(heading(page, "My clients")).toHaveCount(0);
  await expect(heading(page, "My tasks")).toHaveCount(0);
});

test("the admin's My clients page shows their own clients and tasks, not the firm", async ({ page }) => {
  await login(page, "admin@hok.test");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "My clients" }).click();
  await expect(page).toHaveURL(/\/app\/my-clients$/);
  await expect(hero(page, "Your work at a glance")).toBeVisible({ timeout: 15_000 });
  await expect(heading(page, "My tasks")).toBeVisible();
  await expect(hero(page, "The firm at a glance")).toHaveCount(0);
  await expect(region(page, "Team workload")).toHaveCount(0);
});

test("the admin's team page searches and pages the whole team", async ({ page }) => {
  await login(page, "admin@hok.test");
  await page.goto("/app/team");
  await expect(heading(page, "Team workload")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("searchbox", { name: "Search people" }).fill("Meera");
  await expect(page.getByRole("link", { name: "Meera Nair" }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Rohan Mehta" })).toHaveCount(0);
});

test("a social media manager sees their clients and tasks, not the firm", async ({ page }) => {
  await login(page, "rohan.smm@hok.test");
  await expect(hero(page, "Your work at a glance")).toBeVisible({ timeout: 15_000 });
  for (const name of ["This week", "Events by stage", "Client comments", "Open tasks"]) {
    await expect(region(page, name)).toBeVisible();
  }
  await expect(heading(page, "My clients")).toBeVisible();
  await expect(heading(page, "My tasks")).toBeVisible();
  await expect(hero(page, "The firm at a glance")).toHaveCount(0);
  await expect(region(page, "Team workload")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "My clients" })).toHaveCount(0);
});

test("an editor sees only their tasks", async ({ page }) => {
  await login(page, "meera.editor@hok.test");
  const band = hero(page, "Your tasks at a glance");
  await expect(band).toBeVisible({ timeout: 15_000 });
  await expect(band.getByRole("link", { name: /Due today/ })).toBeVisible();
  await expect(band.getByRole("link", { name: /Overdue/ })).toHaveAttribute("href", "/app/tasks?due=overdue");
  await expect(region(page, "Open tasks")).toBeVisible();
  await expect(region(page, "Comments on my tasks")).toBeVisible();
  await expect(heading(page, "My clients")).toHaveCount(0);
  await expect(hero(page, "The firm at a glance")).toHaveCount(0);
});
