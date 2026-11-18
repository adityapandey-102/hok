import { expect, test, type Browser, type Page } from "@playwright/test";
import { newPortalToken, openPortalEvent, openPortalTab } from "./portalHelpers";

const PASSWORD = process.env.E2E_PASSWORD ?? "Hok@2026";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle"); // submitted before hydration, the form does nothing
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
}

async function signedIn(browser: Browser, email: string, options: Parameters<Browser["newContext"]>[0] = {}) {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  await login(page, email);
  return { ctx, page };
}

test.setTimeout(240_000);

/** Round 5, part 1: staff can copy the portal link on every visit; a new link switches the old one off at once. */
test("the portal link can be copied again on a later visit, and a new link switches the old one off", async ({ browser }) => {
  const smm = await signedIn(browser, "rohan.smm@hok.test", { permissions: ["clipboard-read", "clipboard-write"] });
  const tokenA = await newPortalToken(smm.page);

  // Come back later: the link is still there, with Copy and Open.
  await openPortalTab(smm.page);
  const shown = smm.page.getByTestId("portal-url");
  await expect(shown).toContainText(tokenA);
  const urlA = ((await shown.textContent()) ?? "").trim();
  await smm.page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(smm.page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await smm.page.evaluate(() => navigator.clipboard.readText())).toBe(urlA);
  await expect(smm.page.getByRole("link", { name: "Open", exact: true })).toHaveAttribute("target", "_blank");

  // Make a new link: the confirm says the old one stops working.
  await smm.page.getByRole("button", { name: "Make a new link" }).click();
  await expect(smm.page.getByRole("dialog")).toContainText("The current link will stop working immediately. Make a new one?");
  await smm.page.getByRole("dialog").getByRole("button", { name: "Make a new link" }).click();
  await expect(shown).not.toContainText(tokenA, { timeout: 15_000 });
  const tokenB = ((await shown.textContent()) ?? "").trim().split("/").pop()!;

  const clientCtx = await browser.newContext();
  const client = await clientCtx.newPage();
  await client.goto(`/p/${tokenA}`);
  await expect(client.getByRole("heading", { name: "This link isn't active" })).toBeVisible({ timeout: 30_000 });
  await client.goto(`/p/${tokenB}`);
  await expect(client.getByRole("heading", { name: "Your current project" })).toBeVisible({ timeout: 30_000 });

  await Promise.all([smm.ctx.close(), clientCtx.close()]);
});

/**
 * Round 5, parts 2 and 3: a file shared on an event step and an approval waiting for the client are
 * up front in the portal (attention card, ring and count on the step, the event sheet's order), the
 * client comments from the sheet, and a six-step list is a dropdown on a phone.
 */
test("shared files and approvals are up front in the portal; the client comments from the event; the phone shows steps as a dropdown", async ({ browser }) => {
  const stamp = Date.now();
  const template = `Portal six ${stamp}`;
  const title = `E2E up front ${stamp}`;
  const asset = `E2E reel ${stamp}`;
  const comment = `Please add a caption ${stamp}`;
  const steps = ["Brief", "Shoot", "Edit", "Client review", "Revisions", "Delivered"];

  const admin = await signedIn(browser, "admin@hok.test");
  await admin.page.goto("/app/templates");
  await admin.page.waitForLoadState("networkidle");
  await admin.page.getByRole("tab", { name: "Events" }).click();
  await admin.page.getByRole("button", { name: "New template" }).click();
  await admin.page.locator("#tpl-name").fill(template);
  await admin.page.getByLabel("Stage 1 name").fill(steps[0]!);
  await admin.page.getByLabel("Stage 2 name").fill(steps[1]!);
  for (let i = 2; i < steps.length; i++) {
    await admin.page.getByRole("button", { name: "Add stage" }).click();
    await admin.page.getByLabel(`Stage ${i + 1} name`).fill(steps[i]!);
  }
  await admin.page.getByRole("switch", { name: "Needs approval" }).nth(3).click();
  await admin.page.getByLabel("Stage 4 approver: The client").check({ force: true });
  await admin.page.getByRole("button", { name: "Create template" }).click();
  await admin.page.getByLabel("Search templates").fill(template);
  await expect(admin.page.getByRole("list", { name: `${template} stages` }).getByRole("listitem")).toHaveCount(steps.length, { timeout: 15_000 });

  const smm = await signedIn(browser, "rohan.smm@hok.test");
  const page = smm.page;
  await page.goto("/app/clients");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Search clients").fill("Chai Point Cafe");
  await page.getByRole("link", { name: /Chai Point Cafe/ }).first().click();
  await page.getByRole("tab", { name: "events" }).click();
  await page.getByRole("link", { name: "New event" }).click();
  await page.locator("#ev-title").fill(title);
  await page.locator("#ev-template").fill(template);
  await page.locator('[role="listbox"] [role="option"]').filter({ hasText: template }).first().click();
  await page.locator("#ev-start").fill("2026-11-21T10:00");
  await page.locator("#ev-end").fill("2026-11-21T12:00");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
  const eventUrl = page.url();

  // A reel is shared with the client on the first step ("Show to client" on the event's stage).
  await page.goto("/app/clients");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Search clients").fill("Chai Point Cafe");
  await page.getByRole("link", { name: /Chai Point Cafe/ }).first().click();
  await page.getByRole("tab", { name: "assets" }).click();
  await page.getByRole("button", { name: "Add asset" }).first().click();
  await page.locator("#asset-title").fill(asset);
  await page.locator("#asset-url").fill("https://drive.google.com/drive/folders/e2e-portal-reel");
  await page.locator("#asset-event").fill(title);
  await page.getByRole("option", { name: new RegExp(title) }).click();
  await page.getByRole("switch", { name: "Show to client" }).click();
  await expect(page.getByLabel("Event stage (optional)")).toBeEnabled({ timeout: 15_000 });
  await page.getByLabel("Event stage (optional)").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Add asset" }).last().click();
  await page.getByLabel("Search assets").fill(asset);
  await expect(page.getByRole("link", { name: asset, exact: true })).toBeVisible({ timeout: 15_000 });

  // The event moves to the client's stage and asks for approval.
  await page.goto(eventUrl);
  await page.locator("#mv-stage").selectOption({ label: "4. Client review" });
  await page.getByRole("button", { name: "Move stage" }).click();
  await expect(page.getByTestId("approval-card")).toContainText("Needs approval from: The client", { timeout: 15_000 });
  await page.getByRole("button", { name: /^Request approval( again)?$/ }).click();
  await page.getByRole("dialog").getByLabel("Note (optional)").fill("Please check the reel.");
  await page.getByRole("dialog").getByRole("button", { name: "Request approval" }).click();
  await expect(page.getByTestId("approval-card").getByText("Waiting for approval")).toBeVisible({ timeout: 15_000 });

  const token = await newPortalToken(page);

  // ---- The client, on a desktop ----
  const clientCtx = await browser.newContext();
  const portal = await clientCtx.newPage();
  await portal.goto(`/p/${token}`);
  await expect(portal.getByRole("heading", { name: "Your current project" })).toBeVisible({ timeout: 30_000 });
  await expect(portal.getByText("Needs your attention")).toHaveCount(0); // no up-front list: files and approvals live on the event card
  for (const more of await portal.getByRole("button", { name: /^Show all/ }).all()) if (await more.isVisible()) await more.click();
  // The event's card (the current project, or its row) carries a green "1 file shared" tag and the amber approval chip.
  const card = portal.locator("li").filter({ hasText: title }).or(portal.getByRole("region", { name: "Your current project" }).filter({ hasText: title }));
  await expect(card.getByText(/^Needs (your )?approval$/).first()).toBeVisible({ timeout: 15_000 });
  const tag = card.getByRole("button", { name: "1 file shared" });
  await expect(tag).toBeVisible();
  await expect(tag).toHaveClass(/bg-success-bg/);
  await tag.click(); // opens the event at its files
  const sheet = portal.getByRole("dialog");
  await expect(sheet.getByRole("region", { name: "Shared with you" })).toBeVisible({ timeout: 15_000 });
  await expect(sheet.getByRole("button", { name: "1 file shared" })).toBeVisible(); // the sheet header carries it too
  await expect(sheet.getByTestId("portal-approval")).toBeVisible({ timeout: 15_000 });
  const files = sheet.getByRole("region", { name: "Shared with you" });
  await expect(files.getByRole("link", { name: asset })).toHaveAttribute("target", "_blank");
  const progress = sheet.getByRole("region", { name: "Progress" });
  // The step waiting for approval has the amber ring, the step with the reel has the file count.
  await expect(progress.locator(".ring-warning:visible")).toHaveCount(1);
  await expect(progress.locator('[data-testid="stage-files-badge"]:visible')).toHaveText("1");
  // The sheet reads: your action, then the files, then the progress.
  const y = async (l: ReturnType<Page["locator"]>) => (await l.boundingBox())?.y ?? 0;
  expect((await y(sheet.getByTestId("portal-approval"))) < (await y(files))).toBe(true);
  expect((await y(files)) < (await y(progress))).toBe(true);

  // The client comments right from the event; the manager finds it in the inbox with the event's name.
  await sheet.locator("#pe-comment-text").fill(comment);
  await sheet.getByRole("button", { name: "Send", exact: true }).click();
  await expect(sheet.getByText("Sent. Your account manager has been notified.")).toBeVisible({ timeout: 15_000 });
  await expect(sheet.getByTestId("event-comments")).toContainText(comment);
  await page.goto("/app/comments");
  await expect(page.getByRole("button", { name: new RegExp(comment) })).toBeVisible({ timeout: 15_000 });

  // ---- The client, on a phone (390 px): the six steps are a dropdown ----
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await phoneCtx.newPage();
  await openPortalEvent(phone, token, title);
  const phoneSheet = phone.getByRole("dialog");
  await expect(phoneSheet.getByTestId("portal-approval")).toBeVisible({ timeout: 15_000 });
  await expect(phoneSheet.getByTestId("portal-sheet-bar")).toBeVisible();
  const caption = phoneSheet.getByTestId("stage-rail-caption");
  await caption.scrollIntoViewIfNeeded();
  await expect(caption).toHaveText("Step 4 of 6");
  const list = phoneSheet.getByRole("list", { name: "Progress" });
  await expect(list).toBeHidden(); // closed: only the summary shows
  await caption.click();
  await expect(list.getByRole("listitem")).toHaveCount(steps.length);
  await expect(list).toContainText("Delivered");

  // ---- Clean up ----
  await page.goto("/app/assets");
  await page.getByLabel("Search assets").fill(asset);
  await page.getByRole("button", { name: `Delete ${asset}` }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: `Delete ${asset}` })).toHaveCount(0, { timeout: 15_000 });
  await admin.page.goto("/app/templates");
  await admin.page.waitForLoadState("networkidle");
  await admin.page.getByRole("tab", { name: "Events" }).click();
  await admin.page.getByLabel("Search templates").fill(template);
  await admin.page.locator("li", { hasText: template }).getByRole("button", { name: "Deactivate" }).click();
  await admin.page.getByRole("dialog").getByRole("button", { name: "Deactivate" }).click();
  await expect(admin.page.getByText("Template deactivated.")).toBeVisible({ timeout: 15_000 });

  await Promise.all([admin.ctx.close(), smm.ctx.close(), clientCtx.close(), phoneCtx.close()]);
});
