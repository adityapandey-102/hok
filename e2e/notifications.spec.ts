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

test("adding someone to a client's team puts a notification in their bell; they see the client but not its portal controls", async ({
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

  // A team member who isn't the Admin can't archive or change the team.
  await expect(rohan.getByRole("button", { name: "Archive" })).toHaveCount(0);
  await expect(rohan.getByRole("button", { name: "Edit team" })).toHaveCount(0);

  // Admin adds Sara to the team (Rohan stays the lead).
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, "admin@hok.test");
  await admin.goto(clientUrl);
  await admin.getByRole("button", { name: "Edit team" }).click();
  await admin.locator("#team-add").fill("Sara");
  await admin.getByRole("option", { name: /Sara Ali/ }).click();
  await expect(admin.getByRole("radio", { name: "Make Sara Ali the lead" })).toBeVisible();
  await admin.getByRole("button", { name: "Save team" }).click();
  await expect(admin.getByText("Team saved.")).toBeVisible({ timeout: 30_000 });
  await expect(admin.getByText("Team of 2")).toBeVisible();

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

  // On the team but not the lead: the portal tab shows the link's state, not the controls.
  await sara.getByRole("tab", { name: "Portal" }).click();
  await expect(sara.getByText(/Only the client.s lead \(Rohan Mehta\) or the Admin/)).toBeVisible();
  await expect(sara.getByRole("button", { name: "Generate link" })).toHaveCount(0);

  // The full page lists it too.
  await sara.goto("/app/notifications");
  await expect(sara.getByText(new RegExp(name)).first()).toBeVisible();

  await Promise.all([rohanCtx.close(), adminCtx.close(), saraCtx.close()]);
});
