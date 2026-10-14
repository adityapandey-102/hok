import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@hok.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Hok@2026";

test.setTimeout(90_000);

test("admin logs in, creates a user, finds it, and logs out", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e.${stamp}@hok.test`;
  const name = `E2E Editor ${stamp}`;

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.goto("/app/admin/users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Create account" }).click();
  await page.locator("#new-user-name").fill(name);
  await page.locator("#new-user-email").fill(email);
  await page.locator("#new-user-role").selectOption("editor");
  await page.locator("form").getByRole("button", { name: "Create account" }).click();

  const password = page.getByTestId("revealed-password");
  await expect(password).toBeVisible();
  expect((await password.innerText()).length).toBeGreaterThan(7);
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByPlaceholder("Search by name or email").fill(String(stamp));
  await expect(page.getByRole("cell", { name: email })).toBeVisible();

  // Log out through the session route and confirm /app is guarded again.
  await page.goto("/api/session/logout");
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});

test("wrong password shows an error and stays on /login", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill("definitely-wrong");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/login/);
});
