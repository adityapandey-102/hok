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

test.setTimeout(150_000);

test("a manager adds a to-do to a client, marks it done, finds it under Done, then deletes it", async ({ page }) => {
  const title = `E2E To-do ${Date.now()}`;
  await login(page, "rohan.smm@hok.test");
  await page.goto("/app/clients");
  await page.waitForLoadState("networkidle"); // typed before hydration, the search would be lost
  await page.getByLabel("Search clients").fill("Chai Point Cafe"); // e2e runs leave newer clients, so it may not be on the first page
  await page.getByRole("link", { name: /Chai Point Cafe/ }).first().click();
  await page.getByRole("tab", { name: "To-dos" }).click();

  // Create one (an empty title is refused first).
  await page.getByRole("button", { name: "New to-do" }).first().click();
  await page.getByRole("button", { name: "Add to-do" }).click();
  await expect(page.getByText("Please enter a title")).toBeVisible();
  await page.locator("#ctd-title").fill(title);
  await page.locator("#ctd-priority").selectOption("high");
  await page.getByRole("button", { name: "Add to-do" }).click();

  // It is on the Open list.
  await page.getByLabel("Search to-dos").fill(title);
  const check = page.getByRole("checkbox", { name: `Mark ${title} done` });
  await expect(check).toBeVisible({ timeout: 15_000 });

  // Mark it done: it leaves Open and shows up under Done (and All).
  await check.click();
  await expect(check).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole("tab", { name: "Done", exact: true }).click();
  const reopen = page.getByRole("checkbox", { name: `Reopen ${title}` });
  await expect(reopen).toBeVisible({ timeout: 15_000 });
  await expect(reopen).toHaveAttribute("aria-checked", "true");
  await page.getByRole("tab", { name: "All", exact: true }).click();
  await expect(reopen).toBeVisible({ timeout: 15_000 });

  // Clean up: open it and delete it.
  await page.getByRole("button", { name: `Edit ${title}` }).click();
  await page.getByRole("button", { name: `Delete ${title}` }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(reopen).toHaveCount(0, { timeout: 15_000 });
});
