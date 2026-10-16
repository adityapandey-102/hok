import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "Hok@2026";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
}

test.setTimeout(100_000);

test("a manager sees an event in the right calendar slot, switches views and starts a new event from a day", async ({ page }) => {
  const title = `E2E Calendar ${Date.now()}`;
  await login(page, "rohan.smm@hok.test");

  // Create an event for 20 Nov 2026, 10:00 (Asia/Kolkata, the client zone).
  await page.goto("/app/clients");
  await page.getByText("Chai Point Cafe").first().click();
  await page.getByRole("tab", { name: "events" }).click();
  await page.getByRole("link", { name: "New event" }).click();
  await page.locator("#ev-title").fill(title);
  await page.locator("#ev-start").fill("2026-11-20T10:00");
  await page.locator("#ev-end").fill("2026-11-20T11:00");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });

  // Month view: step to November 2026 and find it in the 20 Nov cell.
  await page.goto("/app/calendar");
  await page.getByRole("button", { name: "Month" }).click();
  const heading = page.getByTestId("calendar-title");
  for (let i = 0; i < 36 && !(await heading.innerText()).includes("November 2026"); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(heading).toHaveText("November 2026");
  await expect(page.locator('[data-day="2026-11-20"]').getByText(title)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-day="2026-11-21"]').getByText(title)).toHaveCount(0);

  // List view shows it under the same day.
  await page.getByRole("button", { name: "List" }).click();
  await expect(page.locator('section[data-day="2026-11-20"]').getByText(title)).toBeVisible();

  // Week view: back to month, then open the event from its chip.
  await page.getByRole("button", { name: "Week" }).click();
  await expect(page.getByTestId("calendar-title")).toContainText("–");
  await page.getByRole("button", { name: "Month" }).click();
  await page.locator('[data-day="2026-11-20"]').getByText(title).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });

  // An empty day starts a new event prefilled with that date.
  await page.goto("/app/calendar");
  await page.getByRole("button", { name: "Month" }).click();
  for (let i = 0; i < 36 && !(await heading.innerText()).includes("November 2026"); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("link", { name: /Add an event on .*21 Nov/ }).first().click();
  await expect(page).toHaveURL(/date=2026-11-21/);
  await page.locator("#ne-client").selectOption({ label: "Chai Point Cafe" });
  await expect(page.locator("#ev-start")).toHaveValue("2026-11-21T09:00", { timeout: 30_000 });
});
