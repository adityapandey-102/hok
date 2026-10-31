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

test("admin creates a stage template", async ({ page }) => {
  const name = `E2E Template ${Date.now()}`;
  await login(page, "admin@hok.test");
  await page.goto("/app/templates");
  await page.getByRole("button", { name: "New template" }).click();
  await page.locator("#tpl-name").fill(name);
  await page.getByLabel("Stage 1 name").fill("Brief");
  await page.getByLabel("Stage 2 name").fill("Done");
  await page.getByRole("button", { name: "Add stage" }).click();
  await page.getByLabel("Stage 3 name").fill("Review");
  await page.getByLabel("Move stage 3 up").click();
  await page.getByRole("button", { name: "Create template" }).click();
  await page.getByLabel("Search templates").fill(name);
  // The template's stages show as an ordered chain.
  const chain = page.getByRole("list", { name: `${name} stages` });
  await expect(chain.getByRole("listitem")).toHaveText([/Brief/, /Review/, /Done/], { timeout: 15_000 });
});

test("a manager creates an event from a template and moves its stage with a client-visible note", async ({ page }) => {
  const title = `E2E Shoot ${Date.now()}`;
  await login(page, "rohan.smm@hok.test");
  await page.goto("/app/clients");
  await page.waitForLoadState("networkidle"); // typed before hydration, the search would be lost
  await page.getByLabel("Search clients").fill("Chai Point Cafe"); // e2e runs leave newer clients, so it may not be on the first page
  await page.getByRole("link", { name: /Chai Point Cafe/ }).first().click();
  await page.getByRole("tab", { name: "events" }).click();
  await page.getByRole("link", { name: "New event" }).click();

  await page.locator("#ev-title").fill(title);
  await page.locator("#ev-start").fill("2026-11-20T10:00");
  await page.locator("#ev-end").fill("2026-11-20T12:00");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("list", { name: "Event stages" })).toBeVisible();

  // Move to the next stage with a note shown to the client.
  const options = page.locator("#mv-stage option");
  const firstTarget = await options.nth(1).getAttribute("value");
  await page.locator("#mv-stage").selectOption(firstTarget!);
  await page.locator("#mv-note").fill("Shoot locked in with the client");
  await page.getByLabel("Visible to the client").check();
  await page.getByRole("button", { name: "Move stage" }).click();

  const history = page.getByRole("list", { name: "Stage history" });
  await expect(history.getByText("Shoot locked in with the client")).toBeVisible({ timeout: 15_000 });
  await expect(history.getByText(/visible to client/)).toBeVisible();
});
