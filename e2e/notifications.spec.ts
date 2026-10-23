import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "Hok@2026";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
}

test.setTimeout(150_000);

test("reassigning a client puts a notification in the new owner's bell", async ({
  browser,
}) => {
  const name = `E2E Notify ${Date.now()}`;

  // Rohan creates a client.
  const rohanCtx = await browser.newContext();
  const rohan = await rohanCtx.newPage();
  await login(rohan, "rohan.smm@hok.test");
  await rohan.goto("/app/clients/new");
  await rohan.waitForLoadState("networkidle"); // typed before the form is interactive, text would be lost
  await rohan.locator("#cf-name").fill(name);
  await rohan.getByRole("button", { name: "Create client" }).click();
  await expect(rohan.getByRole("heading", { name })).toBeVisible({
    timeout: 30_000,
  });
  const clientUrl = rohan.url();

  // Admin reassigns it to Sara.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, "admin@hok.test");
  await admin.goto(clientUrl);
  await admin.getByRole("button", { name: "Reassign owner" }).click();
  await admin.locator("#reassign-owner").fill("Sara");
  await admin.getByRole("option", { name: /Sara Ali/ }).click();
  await admin.getByRole("button", { name: "Reassign", exact: true }).click();
  await expect(admin.getByText("Reassigned to Sara Ali.")).toBeVisible({
    timeout: 30_000,
  });

  // Sara sees it in her bell and the click opens the client.
  const saraCtx = await browser.newContext({
    viewport: { width: 800, height: 900 },
  }); // below xl: the header bell shows
  const sara = await saraCtx.newPage();
  await login(sara, "sara.smm@hok.test");
  await expect(
    sara.locator('[data-testid="bell-badge"]:visible').first(),
  ).toBeVisible({
    timeout: 30_000,
  });
  await sara.locator('button[aria-haspopup="dialog"]:visible').first().click();
  const item = sara
    .getByRole("dialog", { name: "Notifications" })
    .getByRole("button", { name: new RegExp(name) });
  await expect(item).toBeVisible();
  await item.click();
  await expect(sara).toHaveURL(clientUrl);

  // The full page lists it too.
  await sara.goto("/app/notifications");
  await expect(sara.getByText(new RegExp(name)).first()).toBeVisible();

  await Promise.all([rohanCtx.close(), adminCtx.close(), saraCtx.close()]);
});
