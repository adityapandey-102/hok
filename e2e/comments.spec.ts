import { expect, test, type Page } from "@playwright/test";

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
  await page.goto("/app/clients");
  await page.waitForLoadState("networkidle"); // typed before hydration, the search would be lost
  await page.getByLabel("Search clients").fill("Chai Point Cafe"); // e2e runs leave newer clients, so it may not be on the first page
  await page.getByRole("link", { name: /Chai Point Cafe/ }).first().click();
  await page.getByRole("tab", { name: "portal" }).click();

  await expect(page.getByRole("button", { name: /^(Re)?generate link$/i })).toBeVisible({ timeout: 15_000 });
  const hasActive = await page.getByRole("button", { name: "Regenerate link" }).isVisible().catch(() => false);
  await page.getByRole("button", { name: hasActive ? "Regenerate link" : "Generate link" }).click();
  await page.getByRole("dialog").getByRole("button", { name: hasActive ? "Regenerate" : "Generate", exact: true }).click();
  const urlText = (await page.getByTestId("portal-url").textContent({ timeout: 15_000 })) ?? "";
  await expect(page.getByRole("link", { name: "Share on WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  const token = urlText.trim().split("/").pop()!;

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
