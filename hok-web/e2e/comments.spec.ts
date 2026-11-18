import { expect, test, type Page } from "@playwright/test";
import { newPortalToken } from "./portalHelpers";

const PASSWORD = process.env.E2E_PASSWORD ?? "Hok@2026";
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100/api/v1";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle"); // submitted before hydration, the form does nothing
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
}

test.setTimeout(150_000);

test("a manager generates a portal link, a client comment reaches the inbox and is solved with a reply", async ({ page, request }) => {
  const body = `E2E comment ${Date.now()}`;
  await login(page, "rohan.smm@hok.test");
  const token = await newPortalToken(page);
  await expect(page.getByRole("link", { name: "Share on WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);

  const res = await request.post(`${API}/portal/${token}/comments`, { data: { body } });
  expect(res.status()).toBe(201);

  await page.goto("/app/comments");
  await page.getByRole("button", { name: new RegExp(body) }).click();
  await page.locator("#comment-reply").fill("Thanks, done.");
  await page.getByRole("button", { name: "Mark solved" }).click();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("tab", { name: "Solved" }).click();
  await expect(page.getByRole("button", { name: new RegExp(body) })).toBeVisible({ timeout: 15_000 });
});
