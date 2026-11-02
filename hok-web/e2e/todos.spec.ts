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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Step the month view forward until it shows the given 2027 month. */
async function goToMonth(page: Page, monthIndex: number) {
  await page.goto("/app/calendar");
  await page.getByRole("tab", { name: "Month" }).click();
  const heading = page.getByTestId("calendar-title");
  const title = `${MONTHS[monthIndex]} 2027`;
  for (let i = 0; i < 36 && !(await heading.innerText()).includes(title); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(heading).toHaveText(title);
}

/**
 * Round 1: a Social Media Manager gives an editor a task from a day's pop-up
 * on the calendar; the editor then finds it on that day and, in the same
 * pop-up, can add a to-do but neither a task nor an event.
 */
test("an SMM creates a task for an editor from the day pop-up; the editor sees it on that day without task or event buttons", async ({ browser }) => {
  const title = `E2E day task ${Date.now()}`;
  const m = Math.floor(Math.random() * 12);
  const d = 1 + Math.floor(Math.random() * 27);
  const day = `2027-${pad(m + 1)}-${pad(d)}`;

  // Rohan (SMM) opens the day and adds a task for Meera (Editor).
  const smmCtx = await browser.newContext();
  const smm = await smmCtx.newPage();
  await login(smm, "rohan.smm@hok.test");
  await goToMonth(smm, m);
  await smm.locator(`[data-day="${day}"] button`).click();
  const dayDialog = smm.getByRole("dialog");
  await expect(dayDialog.getByText("Nothing on this day.")).toBeVisible();
  await expect(dayDialog.getByRole("link", { name: "New event" })).toBeVisible();
  await expect(dayDialog.getByRole("button", { name: "New to-do" })).toBeVisible();
  await dayDialog.getByRole("button", { name: "New task" }).click();
  await smm.locator("#tf-title").fill(title);
  await expect(smm.locator("#tf-due")).toHaveValue(`${day}T17:00`);
  await smm.locator("#tf-assignee").fill("Meera");
  await smm.getByRole("option", { name: /Meera Nair/ }).click();
  await smm.getByRole("button", { name: "Create task" }).click();
  // The calendar stays put and now counts the task on that day; the pop-up links to it.
  await expect(smm.locator(`[data-day="${day}"]`)).toContainText("1 task", { timeout: 15_000 });
  await smm.locator(`[data-day="${day}"] button`).click();
  await smm.getByRole("dialog").getByRole("link", { name: new RegExp(title) }).click();
  await expect(smm.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
  await expect(smm.getByText("Assigned by Rohan Mehta")).toBeVisible();

  // The manager's pick list never offers a peer: managers assign to level-3 roles only.
  await smm.getByRole("button", { name: /Edit or reassign/ }).click();
  await smm.locator("#tf-assignee").fill("Sara");
  await expect(smm.getByRole("option", { name: /Sara Ali/ })).toHaveCount(0);
  await smm.getByRole("button", { name: "Cancel" }).click();

  // Meera's calendar shows a task on that day, and the pop-up offers a to-do only.
  const meeraCtx = await browser.newContext();
  const meera = await meeraCtx.newPage();
  await login(meera, "meera.editor@hok.test");
  await goToMonth(meera, m);
  await expect(meera.getByRole("heading", { name: "My calendar" })).toBeVisible();
  await expect(meera.locator(`[data-day="${day}"]`)).toContainText("1 task", { timeout: 15_000 });
  await meera.locator(`[data-day="${day}"] button`).click();
  const meeraDialog = meera.getByRole("dialog");
  await expect(meeraDialog.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await expect(meeraDialog.getByRole("button", { name: "New to-do" })).toBeVisible();
  await expect(meeraDialog.getByRole("button", { name: "New task" })).toHaveCount(0);
  await expect(meeraDialog.getByRole("link", { name: "New event" })).toHaveCount(0);
  await expect(meeraDialog.getByRole("button", { name: "New personal entry" })).toHaveCount(0);

  // Clean up: Rohan (who gave it) deletes the task.
  await smm.getByRole("button", { name: "Delete" }).click();
  await smm.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(smm).toHaveURL(/\/app\/tasks$/, { timeout: 30_000 });

  await Promise.all([smmCtx.close(), meeraCtx.close()]);
});

/** Round 1: a to-do is private and personal. Anyone adds one from the dashboard and ticks it off there. */
test("a user adds a to-do with an urgency on the dashboard and ticks it done", async ({ page }) => {
  const title = `E2E to-do ${Date.now()}`;
  await login(page, "neha.agent@hok.test");
  const card = page.getByRole("region", { name: "My to-dos", exact: true });
  await expect(card).toBeVisible({ timeout: 15_000 });

  // Add: a past due time keeps it at the top of "the next five".
  await card.getByRole("button", { name: "Add" }).click();
  await page.locator("#td-title").fill(title);
  await page.locator("#td-urgency").selectOption("high");
  await page.locator("#td-due").fill("2020-01-01T09:00");
  await page.getByRole("button", { name: "Add to-do" }).click();
  const tick = card.getByRole("checkbox", { name: `Mark ${title} done` });
  await expect(tick).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText("High").first()).toBeVisible();
  await expect(card.getByTestId("todos-overdue")).toBeVisible();

  // Tick it: it leaves the open list.
  await tick.click();
  await expect(card.getByRole("checkbox", { name: `Mark ${title} done` })).toHaveCount(0, { timeout: 15_000 });

  // It is on the Done tab of the to-dos page; delete it to leave nothing behind.
  await page.goto("/app/todos");
  await expect(page.getByRole("heading", { name: "To-dos", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Done" }).click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: `Delete ${title}`, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(title)).toHaveCount(0, { timeout: 15_000 });
});

test("to-dos are private: another person's list never shows them", async ({ browser }) => {
  const title = `E2E private ${Date.now()}`;
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  await login(a, "isha.writer@hok.test");
  await a.goto("/app/todos");
  await a.getByLabel("New to-do title").fill(title);
  await a.getByRole("button", { name: "Add", exact: true }).click();
  await expect(a.getByText(title)).toBeVisible({ timeout: 15_000 });

  // The Admin has no bypass.
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await login(b, "admin@hok.test");
  await b.goto("/app/todos");
  await expect(b.getByRole("heading", { name: "To-dos", exact: true })).toBeVisible();
  await b.getByLabel("New to-do title").waitFor();
  await expect(b.getByText(title)).toHaveCount(0);

  // Clean up.
  await a.getByRole("button", { name: `Delete ${title}`, exact: true }).click();
  await a.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(a.getByText(title)).toHaveCount(0, { timeout: 15_000 });
  await Promise.all([ctxA.close(), ctxB.close()]);
});
