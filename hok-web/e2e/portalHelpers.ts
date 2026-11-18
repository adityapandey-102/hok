import { expect, type Page } from "@playwright/test";

/** Shared by the e2e specs that make a portal link and open the client's side (comments, approvals, staff-tasks, portal). */

/** The SMM opens "Chai Point Cafe" and its Portal tab. */
export async function openPortalTab(page: Page) {
  await page.goto("/app/clients");
  await page.waitForLoadState("networkidle"); // typed before hydration, the search would be lost
  await page.getByLabel("Search clients").fill("Chai Point Cafe");
  await page.getByRole("link", { name: /Chai Point Cafe/ }).first().click();
  await page.getByRole("tab", { name: "portal" }).click();
  await expect(page.getByRole("button", { name: /^(Generate link|Make a new link)$/ })).toBeVisible({ timeout: 15_000 });
}

/** The SMM makes a fresh portal link for Chai Point Cafe (the old one stops working) and returns its token. */
export async function newPortalToken(page: Page): Promise<string> {
  await openPortalTab(page);
  const shown = page.getByTestId("portal-url");
  const old = (await shown.count()) > 0 ? ((await shown.textContent()) ?? "").trim() : null;
  const regenerate = (await page.getByRole("button", { name: "Make a new link" }).count()) > 0;
  await page.getByRole("button", { name: regenerate ? "Make a new link" : "Generate link" }).click();
  await page.getByRole("dialog").getByRole("button", { name: regenerate ? "Make a new link" : "Generate", exact: true }).click();
  // The link stays on screen now, so wait until it is the NEW one.
  if (old) await expect(shown).not.toHaveText(old, { timeout: 15_000 });
  else await expect(shown).toBeVisible({ timeout: 15_000 });
  return ((await shown.textContent()) ?? "").trim().split("/").pop()!;
}

/** The client's side: open /p/<token> and the named event (its row, or the current project's button). */
export async function openPortalEvent(portal: Page, token: string, eventTitle: string) {
  await portal.goto(`/p/${token}`);
  await expect(portal.getByRole("heading", { name: "Your current project" })).toBeVisible({ timeout: 30_000 });
  const row = portal.getByRole("button", { name: new RegExp(eventTitle) }).first();
  if (!(await row.isVisible())) {
    for (const more of await portal.getByRole("button", { name: /^Show all/ }).all()) if (await more.isVisible()) await more.click();
  }
  if (await row.isVisible()) await row.click();
  else await portal.getByRole("button", { name: /^(Open project|Review and approve)$/ }).click(); // the event is the current project
  await expect(portal.getByRole("dialog").getByRole("heading", { name: eventTitle })).toBeVisible({ timeout: 15_000 });
}
