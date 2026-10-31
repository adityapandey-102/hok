import { expect, test } from "@playwright/test";

/**
 * Portfolio smoke test (M1): every page of the ported HOK template answers,
 * shows its heading, loads without a script error and never scrolls sideways.
 * Needs only the Next.js dev server -- no hok-api, no database.
 */

const PAGES: { path: string; heading: string }[] = [
  { path: "/", heading: "Next Generation Creative Agency" },
  { path: "/about", heading: "About Agency" },
  { path: "/services", heading: "Our Services" },
  { path: "/services/details", heading: "Services Details" },
  { path: "/case-studies", heading: "Case Study Grid" },
  { path: "/case-studies/details", heading: "Case Study Details" },
  { path: "/team", heading: "Our Team" },
  { path: "/team/details", heading: "Our Team Details" },
  { path: "/blog", heading: "Blog Grid" },
  { path: "/blog/list", heading: "Blog List" },
  { path: "/blog/details", heading: "Blog Details" },
  { path: "/pricing", heading: "Pricing Plans" },
  { path: "/faq", heading: "FAQ’S" },
  { path: "/contact", heading: "Contact Us" },
];

const WIDTHS = [768, 1280];

/** Collapses whitespace so a heading split over lines/spans compares as one string. */
function normalise(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

for (const { path, heading } of PAGES) {
  test(`portfolio ${path} loads with its heading`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    expect(normalise(await page.locator("h1").first().textContent())).toBe(normalise(heading));

    // The template's own CSS, never the staff app's Tailwind (two root layouts).
    await expect(page.locator('link[rel="stylesheet"][href="/site/assets/css/main.css"]')).toHaveCount(1);
    await expect(page.locator('link[href*="all.min.css"], link[href*="webfonts"]')).toHaveCount(0); // Font Awesome Pro is gone
    await expect(page.locator('a[href="/login"]').first()).toHaveText(/Staff login/);

    await page.waitForLoadState("load");
    expect(errors).toEqual([]);
  });

  for (const width of WIDTHS) {
    test(`portfolio ${path} has no sideways scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await page.waitForLoadState("load");
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
}

test("an unknown URL shows the portfolio's 404 page", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /Page not found/i })).toBeVisible();
  await expect(page.locator('link[rel="stylesheet"][href="/site/assets/css/main.css"]')).toHaveCount(1);
});

test("the staff sign-in page uses the app's design system, not the template's CSS", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  await expect(page.locator('link[rel="stylesheet"][href^="/site/"]')).toHaveCount(0);
});
