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

// Client events can't be deleted (only cancelled), so each run picks a random
// day in 2027: its chip then never hides behind "+N more" from earlier runs.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const M = Math.floor(Math.random() * 12);
const D = 1 + Math.floor(Math.random() * 27);
const pad = (n: number) => String(n).padStart(2, "0");
const DAY = `2027-${pad(M + 1)}-${pad(D)}`;
const NEXT_DAY = `2027-${pad(M + 1)}-${pad(D + 1)}`;
const MONTH_TITLE = `${MONTHS[M]} 2027`;

test("a manager sees an event in the right calendar slot, switches views and starts a new event from a day", async ({ page }) => {
  const title = `E2E Calendar ${Date.now()}`;
  await login(page, "rohan.smm@hok.test");

  // Create an event on DAY, 10:00 (Asia/Kolkata, the client zone).
  await page.goto("/app/clients");
  await page.getByText("Chai Point Cafe").first().click();
  await page.getByRole("tab", { name: "events" }).click();
  await page.getByRole("link", { name: "New event" }).click();
  await page.locator("#ev-title").fill(title);
  await page.locator("#ev-start").fill(`${DAY}T10:00`);
  await page.locator("#ev-end").fill(`${DAY}T11:00`);
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });

  // Month view: step to that month and find it in the day's cell.
  await page.goto("/app/calendar");
  await page.getByRole("tab", { name: "Month" }).click();
  const heading = page.getByTestId("calendar-title");
  for (let i = 0; i < 36 && !(await heading.innerText()).includes(MONTH_TITLE); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(heading).toHaveText(MONTH_TITLE);
  await expect(page.locator(`[data-day="${DAY}"]`).getByText(title)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(`[data-day="${NEXT_DAY}"]`).getByText(title)).toHaveCount(0);

  // List view shows it under the same day.
  await page.getByRole("tab", { name: "List" }).click();
  await expect(page.locator(`section[data-day="${DAY}"]`).getByText(title)).toBeVisible();

  // Week view: back to month, then open the event from its chip.
  await page.getByRole("tab", { name: "Week" }).click();
  await expect(page.getByTestId("calendar-title")).toContainText("–");
  await page.getByRole("tab", { name: "Month" }).click();
  await page.locator(`[data-day="${DAY}"]`).getByText(title).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });

  // An empty day starts a new event prefilled with that date.
  await page.goto("/app/calendar");
  await page.getByRole("tab", { name: "Month" }).click();
  for (let i = 0; i < 36 && !(await heading.innerText()).includes(MONTH_TITLE); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("button", { name: new RegExp(`Add an event on .* ${D + 1} ${SHORT[M]}`) }).first().click();
  await page.getByRole("link", { name: "Client event" }).click();
  await expect(page).toHaveURL(new RegExp(`date=${NEXT_DAY}`));
  await page.locator("#ne-client").fill("Chai Point");
  await page.getByRole("option", { name: /Chai Point Cafe/ }).click();
  await expect(page.locator("#ev-start")).toHaveValue(`${NEXT_DAY}T09:00`, { timeout: 30_000 });
});

test("a manager creates a personal event from an empty day and sees it in month view", async ({ page }) => {
  const title = `E2E Personal ${Date.now()}`;
  await login(page, "rohan.smm@hok.test");
  await page.goto("/app/calendar");
  await page.getByRole("tab", { name: "Month" }).click();
  const heading = page.getByTestId("calendar-title");
  for (let i = 0; i < 36 && !(await heading.innerText()).includes("December 2026"); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("button", { name: /Add an event on .*15 Dec/ }).first().click();
  await page.getByRole("button", { name: "Personal event" }).click();
  await page.locator("#pe-title").fill(title);
  await expect(page.locator("#pe-start")).toHaveValue("2026-12-15T09:00");
  await page.getByRole("button", { name: "Create personal event" }).click();
  const chip = page.locator('[data-day="2026-12-15"]').getByText(title);
  await expect(chip).toBeVisible({ timeout: 15_000 });

  // Edit, then delete.
  await chip.click();
  await page.locator("#pe-title").fill(title + " v2");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator('[data-day="2026-12-15"]').getByText(title + " v2")).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-day="2026-12-15"]').getByText(title + " v2").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.locator('[data-day="2026-12-15"]').getByText(title)).toHaveCount(0, { timeout: 15_000 });
});

test("a manager makes a Google Calendar link; the feed serves their calendar until it's turned off", async ({ page, request }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page, "rohan.smm@hok.test");
  await page.goto("/app/calendar");
  await page.getByRole("button", { name: "Add to Google Calendar" }).click();
  const dialog = page.getByRole("dialog");
  const status = dialog.getByTestId("feed-status");
  await expect(status).toBeVisible();

  // A link left by an earlier run: replacing it asks first (the old one stops working).
  if ((await status.innerText()).startsWith("Your link is on")) {
    await dialog.getByRole("button", { name: "Make a new link" }).click();
    await expect(dialog.getByRole("alert")).toContainText("stops working");
    await dialog.getByRole("button", { name: "Yes, make a new link" }).click();
  } else {
    await dialog.getByRole("button", { name: "Make my link" }).click();
  }
  const url = (await dialog.getByTestId("feed-url").innerText()).trim();
  expect(url).toMatch(/^https?:\/\/.+\/api\/v1\/calendar-feed\/[A-Za-z0-9_-]{43}\.ics$/); // absolute, from the API
  await expect(dialog.getByRole("link", { name: "Open Google Calendar" })).toHaveAttribute("href", /calendar\.google\.com.*cid=http/);

  // Closing before copying asks first; the link is shown only once.
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("button", { name: "Close anyway" })).toBeVisible();
  await dialog.getByRole("button", { name: "Go back" }).click();
  await dialog.getByRole("button", { name: "Copy link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);

  const feed = await request.get(url);
  expect(feed.status()).toBe(200);
  expect(await feed.text()).toContain("BEGIN:VCALENDAR");

  // Turning off asks first too.
  await dialog.getByRole("button", { name: "Turn off" }).click();
  await dialog.getByRole("button", { name: "Yes, turn it off" }).click();
  await expect(status).toHaveText("You have no calendar link yet.");
  expect((await request.get(url)).status()).toBe(404);

  // Copied, so closing doesn't ask.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
