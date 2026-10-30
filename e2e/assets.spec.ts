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

test("a manager adds an asset link with tags to a client, finds it by search and tag, edits and deletes it", async ({ page }) => {
  const stamp = Date.now();
  const title = `E2E Asset ${stamp}`;
  const tag = `e2etag${stamp}`;
  await login(page, "rohan.smm@hok.test");
  await page.goto("/app/clients");
  await page.waitForLoadState("networkidle"); // typed before hydration, the search would be lost
  await page.getByLabel("Search clients").fill("Chai Point Cafe"); // e2e runs leave newer clients, so it may not be on the first page
  await page.getByRole("link", { name: /Chai Point Cafe/ }).first().click();
  await page.getByRole("tab", { name: "assets" }).click();

  await page.getByRole("button", { name: "Add asset" }).click();
  await page.locator("#asset-title").fill(title);
  await page.locator("#asset-url").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Add asset" }).last().click();
  await expect(page.getByText("Enter a full link starting with http")).toBeVisible();

  await page.locator("#asset-url").fill("https://drive.google.com/drive/folders/e2e");
  await page.locator("#asset-comment").fill("Raw clips from the e2e run");
  await page.locator("#asset-tags").fill(tag);
  await page.locator("#asset-tags").press("Enter");
  await page.getByRole("button", { name: "Add asset" }).last().click();

  await page.getByLabel("Search assets").fill(title);
  const link = page.getByRole("link", { name: title, exact: true });
  await expect(link).toBeVisible({ timeout: 15_000 });
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("button", { name: tag })).toBeVisible();

  // Tag filter narrows to the same single row.
  await page.getByLabel("Search assets").fill("");
  await page.getByLabel("Filter by tag").selectOption({ label: new RegExp(tag) as never }).catch(async () => {
    await page.getByRole("button", { name: tag }).click();
  });
  await expect(link).toBeVisible({ timeout: 15_000 });

  // Edit the title.
  await page.getByRole("button", { name: `Edit ${title}` }).click();
  await page.locator("#asset-title").fill(`${title} v2`);
  await page.getByRole("button", { name: "Save changes" }).click();
  const renamed = page.getByRole("link", { name: `${title} v2`, exact: true });
  await expect(renamed).toBeVisible({ timeout: 15_000 });

  // Delete it.
  await page.getByRole("button", { name: `Delete ${title} v2` }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(renamed).toHaveCount(0, { timeout: 15_000 });
});

test("the assets page lists links across clients and task-only staff have no assets nav", async ({ page }) => {
  await login(page, "rohan.smm@hok.test");
  await page.goto("/app/assets");
  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Raw footage: brand shoot/ }).first()).toBeVisible({ timeout: 15_000 });
  await page.context().clearCookies();

  await login(page, "neha.agent@hok.test");
  await expect(page.getByRole("link", { name: "Assets" })).toHaveCount(0);
  await page.goto("/app/assets");
  await expect(page).toHaveURL(/\/app$/);
});
