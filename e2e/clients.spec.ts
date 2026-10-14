import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "Hok@2026";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
}

test.setTimeout(120_000);

test("a manager creates and edits a client; another manager cannot see it", async ({ browser }) => {
  const name = `E2E Client ${Date.now()}`;

  // Rohan (Social Media Manager) creates the client.
  const rohanCtx = await browser.newContext();
  const rohan = await rohanCtx.newPage();
  await login(rohan, "rohan.smm@hok.test");
  await rohan.goto("/app/clients/new");
  await rohan.locator("#cf-name").fill(name);
  await rohan.locator("#cf-industry").fill("Testing");
  await rohan.getByRole("button", { name: "Create client" }).click();
  await expect(rohan.getByRole("heading", { name })).toBeVisible({ timeout: 30_000 });
  const clientUrl = rohan.url();
  expect(clientUrl).toMatch(/\/app\/clients\/[0-9a-f-]{36}$/);

  // Edit it.
  await rohan.getByRole("button", { name: "Edit client" }).click();
  await rohan.locator("#cf-industry").fill("Edited Industry");
  await rohan.locator("#cf-status").selectOption("paused");
  await rohan.getByRole("button", { name: "Save changes" }).click();
  await expect(rohan.getByText("Edited Industry").first()).toBeVisible();
  await expect(rohan.getByText("Paused").first()).toBeVisible();

  // It shows up in Rohan's list.
  await rohan.goto("/app/clients");
  await rohan.getByLabel("Search clients").fill(name);
  await expect(rohan.getByText(name)).toBeVisible();

  // Sara (another Social Media Manager) neither lists nor opens it.
  const saraCtx = await browser.newContext();
  const sara = await saraCtx.newPage();
  await login(sara, "sara.smm@hok.test");
  await sara.goto("/app/clients");
  await sara.getByLabel("Search clients").fill(name);
  await expect(sara.getByText("No clients match your filters.")).toBeVisible({ timeout: 15_000 });
  const response = await sara.goto(clientUrl);
  expect(response?.status()).toBe(404);

  // Task-only staff do not get the Clients page at all.
  const agentCtx = await browser.newContext();
  const agent = await agentCtx.newPage();
  await login(agent, "neha.agent@hok.test");
  await expect(agent.getByRole("link", { name: "Clients" })).toHaveCount(0);
  await agent.goto("/app/clients");
  await expect(agent).toHaveURL(/\/app$/);

  await Promise.all([rohanCtx.close(), saraCtx.close(), agentCtx.close()]);
});
