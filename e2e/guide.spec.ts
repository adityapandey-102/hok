import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "Hok@2026";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
}

test.setTimeout(90_000);

test("the guide opens on the page's topic and searches everything", async ({ page }) => {
  await login(page, "rohan.smm@hok.test");
  await page.goto("/app/clients");
  await page.getByRole("button", { name: "Guide me" }).click();
  const box = page.getByRole("searchbox", { name: "Search the guide" });
  await expect(box).toHaveValue("Clients");
  await expect(page.getByRole("heading", { name: "Clients: add, edit, archive" })).toBeVisible();
  await box.fill("portal link");
  await expect(page.getByRole("heading", { name: "Client portal link" })).toBeVisible();
});

test("an editor's guide hides what their role can't use", async ({ page }) => {
  await login(page, "meera.editor@hok.test");
  await page.getByRole("button", { name: "Guide me" }).click();
  const box = page.getByRole("searchbox", { name: "Search the guide" });
  await box.fill("");
  const topics = page.getByRole("list", { name: "Guide topics" });
  await expect(topics.getByRole("button", { name: "Staff tasks" })).toBeVisible();
  await expect(topics.getByRole("button", { name: "Users and roles (Admin)" })).toHaveCount(0);
  await expect(topics.getByRole("button", { name: "Clients: add, edit, archive" })).toHaveCount(0);
});
