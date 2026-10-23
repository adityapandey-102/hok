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
  await rohan.waitForLoadState("networkidle"); // typed before the form is interactive, text would be lost
  await rohan.locator("#cf-name").fill(name);
  await rohan.locator("#cf-industry").fill("Testing");

  // Several contact people (phone / email optional), phones, websites and social accounts.
  await rohan.getByLabel("Contact 1 name").fill("Priya Shah");
  await rohan.getByLabel("Contact 1 phone", { exact: true }).fill("98200 55555"); // India (+91) is the default code
  await rohan.getByRole("button", { name: "Add contact person" }).click();
  await rohan.getByLabel("Contact 2 name").fill("Dev Mehta");
  await rohan.getByLabel("Contact 2 email").fill("dev@example.com");
  await rohan.getByLabel("Phone 1", { exact: true }).fill("22 4000 1111");
  await rohan.getByRole("button", { name: "Add phone number" }).click();
  await rohan.getByLabel("Phone 2 country code").selectOption("AE"); // pick another country's code
  await rohan.getByLabel("Phone 2", { exact: true }).fill("04 555 0000"); // the trunk 0 is dropped
  await rohan.getByLabel("Website 1", { exact: true }).fill("e2e-shop.example.com");
  await rohan.getByRole("button", { name: "Add website" }).click();
  await rohan.getByLabel("Website 2", { exact: true }).fill("e2e-blog.example.com");
  await rohan.getByRole("button", { name: "Add account" }).click();
  await rohan.getByLabel("Account 1 handle").fill("@e2e_main");
  await rohan.getByRole("button", { name: "Add account" }).click();
  await rohan.getByLabel("Account 2 handle").fill("@e2e_store"); // a second Instagram account
  await rohan.getByRole("button", { name: "Add account" }).click();
  await rohan.getByLabel("Account 3 platform").selectOption("youtube");
  await rohan.getByLabel("Account 3 handle").fill("https://youtube.com/@e2e");

  // The time zone picker finds another country's zone by city.
  await rohan.locator("#cf-tz").click();
  await rohan.locator("#cf-tz").fill("Dubai");
  await rohan.getByRole("option", { name: /Dubai/ }).first().click();

  await rohan.getByRole("button", { name: "Create client" }).click();
  await expect(rohan.getByRole("heading", { name })).toBeVisible({ timeout: 30_000 });
  const clientUrl = rohan.url();
  expect(clientUrl).toMatch(/\/app\/clients\/[0-9a-f-]{36}$/);
  for (const shown of ["Priya Shah", "+91 98200 55555", "Dev Mehta", "dev@example.com", "+971 4 555 0000", "https://e2e-blog.example.com", "@e2e_main", "@e2e_store"]) {
    await expect(rohan.getByText(shown, { exact: true }).first(), shown).toBeVisible();
  }
  await expect(rohan.getByText(/Dubai/).first()).toBeVisible();

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
