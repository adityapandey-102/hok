import { expect, test } from "@playwright/test";

/**
 * Portfolio smoke test (M1): every page of the ported HOK template answers,
 * shows its heading, loads without a script error and never scrolls sideways.
 * Needs only the Next.js dev server -- no hok-api, no database.
 *
 * Content round 1 (docs/specs/site-content-1.md): the menu is Home, About,
 * Services and Contact; the Pricing, Blog, Team, FAQ and Case-study pages still
 * answer but nothing links to them.
 */

const PAGES: { path: string; heading: string }[] = [
  { path: "/", heading: "AI-Powered Marketing for Brands" },
  { path: "/about", heading: "The Team Behind Your Growth" },
  { path: "/services", heading: "Marketing That Moves Brands" },
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
  { path: "/contact", heading: "Let’s Build Something Remarkable" },
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

const LIVE_PAGES = ["/", "/about", "/services", "/contact"];
const HIDDEN_PREFIXES = ["/pricing", "/blog", "/team", "/faq", "/case-studies"];

test("the menu lists only Home, About, Services and Contact", async ({ page }) => {
  await page.goto("/about");
  const items = await page.locator("header .custom-nav a").allTextContents();
  expect(items.map((t) => t.trim())).toEqual(["Home", "About", "Services", "Contact"]);
});

for (const path of LIVE_PAGES) {
  test(`portfolio ${path} links to none of the removed pages`, async ({ page }) => {
    await page.goto(path);
    const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    const bad = hrefs.filter((h) => HIDDEN_PREFIXES.some((p) => h === p || h.startsWith(p + "/")));
    expect(bad).toEqual([]);
  });
}

/** Design round 4: no decorative arrows, pills or accordions anywhere on the live pages. */
test("no decorative arrows, outlined pills or accordions on any live page", async ({ page }) => {
  for (const path of LIVE_PAGES) {
    await page.goto(path);
    expect(await page.content(), path).not.toMatch(/arrow-right-storke|rot60|accordion-btn|serial-badge/);
    // the only icons left: the four play marks and the two work slider chevrons (the back-to-top arrow sits outside main)
    await expect(page.locator("main svg, footer svg, header svg")).toHaveCount(path === "/" ? 6 : 0);
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(text, path).not.toMatch(/[↗↘→»›]/);
  }
});

test("home: hero, logo tiles, About HOK, five steps, four open service panels, reels, testimonials", async ({ page }) => {
  await page.goto("/");
  // header: four text links and the primary button, no search or cart
  await expect(page.locator("header .custom-nav a.is-current")).toHaveText("Home");
  await expect(page.locator("header a.hok-btn--primary")).toHaveText(/Get In Touch/);
  await expect(page.locator("header .search-icon, header .shop-cart")).toHaveCount(0);
  // hero: the headline (outlined last word), two buttons, the trust line; no stats box, no arrow image
  await expect(page.locator(".hero-v1-content h1")).toContainText("AI-Powered");
  await expect(page.locator(".hero-v1-content h1 .designers")).toHaveAttribute("data-text", "Brands");
  await expect(page.locator("#mains").getByText("We blend human creativity with AI").first()).toBeVisible();
  await expect(page.locator('.hero-v1-content a.hok-btn--primary[href="/contact"]')).toHaveText("Start a Project");
  await expect(page.locator('.hero-v1-content a.hok-btn--ghost[href="#work"]')).toHaveText("See Our Work");
  await expect(page.locator(".hok-trust")).toContainText("Trusted by 10+ brands across hospitality, fashion, wellness and real estate.");
  await expect(page.locator(".hero-expriencebox, .expri-cont-item, .expri-thumb")).toHaveCount(0);
  await expect(page.locator('img[src*="arrow-right-storke"]')).toHaveCount(0);
  // dummy sections are gone
  await expect(page.locator(".team-version01, .home-blog-version1, .watch-version01")).toHaveCount(0);
  // logo strip: 7 distinct logos with alt text (second half aria-hidden), every tile 168x96 and every image really drawn
  const logos = page.locator(".hok-logos .hok-logo img");
  const alts = await logos.evaluateAll((els) => els.map((el) => el.getAttribute("alt") ?? ""));
  expect(alts.length).toBe(28);
  expect(new Set(alts.filter(Boolean)).size).toBe(7);
  const tile = await page.locator(".hok-logos .hok-logo").first().boundingBox();
  expect(Math.round(tile?.width ?? 0)).toBe(168);
  expect(Math.round(tile?.height ?? 0)).toBe(96);
  await expect
    .poll(async () =>
      logos.evaluateAll((els) =>
        els.every((el) => {
          const img = el as HTMLImageElement;
          const box = img.getBoundingClientRect();
          return img.complete && img.naturalWidth > 0 && box.width > 20 && box.height > 20;
        }),
      ),
    )
    .toBe(true);
  await expect(page.locator(".hok-logos__caption")).toHaveText("Brands we’ve worked with");
  // About HOK: Nida's photo, the heading, a secondary button to /about
  await expect(page.locator('.hok-founder img[alt*="Nida Fathima"]')).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Built on creativity, powered by AI" })).toBeVisible();
  await expect(page.locator(".hok-founder a.hok-btn--ghost")).toHaveAttribute("href", "/about");
  // how we work: five steps with their full sentence (nothing clipped)
  await expect(page.locator(".hok-step")).toHaveCount(5);
  for (const step of await page.locator(".hok-step").all()) {
    const clipped = await step.locator(".hok-step__text").evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(clipped).toBe(false);
  }
  await expect(page.locator(".hok-step").first()).toContainText("Understanding business goals and target audience");
  // what we do: no accordion, four open panels, each with its list, plus the All Services button
  await expect(page.locator(".accordion-single, .accordion-btn")).toHaveCount(0);
  await expect(page.locator(".hok-group")).toHaveCount(4);
  for (const panel of await page.locator(".hok-group").all()) {
    await expect(panel.locator("h3")).toBeVisible();
    expect(await panel.locator("li").count()).toBeGreaterThanOrEqual(2);
    await expect(panel.locator("li").first()).toBeVisible();
  }
  await expect(page.locator('.hok-head a.hok-btn--ghost[href="/services"]')).toHaveText("All Services");
  // no Instagram iframes; four work cards that open the reels in a new tab
  await expect(page.locator("iframe")).toHaveCount(0);
  const cards = page.locator("a.hok-work");
  await expect(cards).toHaveCount(4);
  const ids = ["DfG5eo7Bj4F", "DCuEJfqBouW", "DfjXjISTZSk", "DetjP3qM-aY"];
  for (const [i, id] of ids.entries()) {
    await expect(cards.nth(i)).toHaveAttribute("href", `https://www.instagram.com/reel/${id}/`);
    await expect(cards.nth(i)).toHaveAttribute("target", "_blank");
    await expect(cards.nth(i)).toHaveAttribute("rel", /noopener noreferrer/);
  }
  await expect(page.locator(".hok-work__cat").first()).toHaveText("Spa & Wellness");
  // text sliders: social media marketing and let's talk (no testimonial marquee)
  await expect(page.locator(".scrolling-wrap")).toHaveCount(2);
  await expect(page.getByText("SOCIAL MEDIA MARKETING").first()).toBeAttached();
  // testimonials: four, centred, with logo chips, name and brand, and four dots
  await expect(page.getByRole("heading", { name: "What Our Clients Say" })).toBeVisible();
  await expect(page.locator(".hok-testi-swiper .swiper-slide")).toHaveCount(4);
  await expect(page.locator(".hok-testi-swiper blockquote").first()).toContainText("HOK understood our craft from day one.");
  await expect(page.locator(".hok-testi-dots .swiper-pagination-bullet")).toHaveCount(4);
  await expect(page.locator(".hok-testi-swiper .hok-chip")).toHaveCount(4);
  // the closing "Let's talk!" slider links to the contact page
  await expect(page.locator('a.hok-talk[href="/contact"]')).toHaveCount(1);
  await expect(page.locator("a.hok-talk")).toContainText("Let’s talk!");
});

test("home: the founder block fits one 800 px screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.locator(".hok-founder").scrollIntoViewIfNeeded();
  const box = await page.locator(".hok-founder").boundingBox();
  expect(box?.height ?? 9999).toBeLessThan(700);
  const photo = await page.locator(".hok-founder__photo").boundingBox();
  expect(photo?.height ?? 9999).toBeLessThanOrEqual(600);
});

test("about: editorial intro, founder block, five steps, open service panels and the clients", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Team Behind Your Growth");
  await expect(page.locator(".hok-intro")).toContainText("Who we are, how we work, and the brands that trust us.");
  await expect(page.locator(".breadcrumnd-banner, .hok-crumb, .radius-btn")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Built on creativity, powered by AI" })).toBeVisible();
  await expect(page.getByAltText(/Nida Fathima/)).toBeVisible();
  const founder = page.getByRole("link", { name: "Nida Fathima" });
  await expect(founder).toHaveAttribute("href", "https://www.instagram.com/nidafathima_socials/");
  await expect(page.getByRole("link", { name: /Work With Us/ })).toHaveAttribute("href", "/contact");
  await expect(page.locator(".accordion-single")).toHaveCount(0);
  await expect(page.locator(".hok-group")).toHaveCount(4);
  await expect(page.locator(".hok-step")).toHaveCount(5);
  const clients = page.locator(".hok-client-link");
  await expect(clients).toHaveCount(10);
  for (const el of await clients.all()) {
    await expect(el).toHaveAttribute("target", "_blank");
    await expect(el).toHaveAttribute("rel", /noopener/);
  }
  await expect(page.locator(".hok-logo-grid img")).toHaveCount(7);
  await expect(page.locator('a.hok-talk[href="/contact"]')).toHaveCount(1);
  // nothing from the template is left
  await expect(page.locator("body")).not.toContainText(/xstar|lorem|win-win survival/i);
});

test("services: four open rows with every service, then a project call to action", async ({ page }) => {
  await page.goto("/services");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Marketing That Moves Brands");
  await expect(page.locator(".hok-intro")).toContainText("Ten ways we help brands grow, from strategy to automation.");
  await expect(page.locator(".accordion-single, .accordion-btn")).toHaveCount(0);
  await expect(page.locator(".hok-row")).toHaveCount(4);
  await expect(page.locator(".hok-svc")).toHaveCount(10);
  for (const row of await page.locator(".hok-row").all()) await expect(row.locator("h2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Have A Project In Mind?" })).toBeVisible();
  await expect(page.locator(".hok-cta a.hok-btn--primary")).toHaveAttribute("href", "/contact");
  await expect(page.locator(".hok-cta a.hok-btn--primary")).toHaveText("Start a Project");
});

test("contact: intro, details as label and value, text social links and the form", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let’s Build Something Remarkable");
  await expect(page.locator(".hok-intro")).toContainText("we’ll reply within one working day");
  await expect(page.locator(".hok-detail")).toHaveCount(4);
  await expect(page.locator(".hok-detail dt")).toHaveText(["Phone", "Email", "Address", "Hours"]);
  await expect(page.locator(".hok-contact").getByText("hello@houseofkhalak.com")).toBeVisible();
  await expect(page.locator(".hok-contact a[href^='https://www.instagram.com/hok.co_']")).toHaveText("Instagram");
  await expect(page.locator(".hok-contact a[href^='https://www.linkedin.com/company/houseofkhalak']")).toHaveText("LinkedIn");
  for (const name of ["name", "email", "phone", "messages"]) {
    await expect(page.locator(`form.hok-form [name="${name}"]`)).toHaveCount(1);
  }
  await expect(page.locator("form.hok-form button[type=submit]")).toHaveText("Send Message");
  await expect(page.locator(".contact-map, iframe[src*='google.com/maps']")).toHaveCount(0);
});

test("footer: four columns, real socials only, one thin bottom bar and exactly one back-to-top button", async ({ page }) => {
  await page.goto("/");
  const hrefs = await page.locator("footer a[href^='http']").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
  expect(hrefs).toEqual(expect.arrayContaining(["https://www.instagram.com/hok.co_/", "https://www.linkedin.com/company/houseofkhalak/"]));
  expect(hrefs.some((h) => /facebook|twitter|x.com|youtube/.test(h ?? ""))).toBe(false);
  await expect(page.locator(".hok-footer__h")).toHaveText(["About", "Pages", "Services", "Contact"]);
  await expect(page.locator(".hok-footer__bar")).toContainText(`© ${new Date().getFullYear()} HOK (House of Khalak). All rights reserved.`);
  await expect(page.locator(".hok-footer__bar a[href='/login']")).toHaveText("Staff login");
  // one back-to-top button on the whole page, none in the footer (and no logo box either)
  await expect(page.locator("#progress")).toHaveCount(1);
  await expect(page.locator('[aria-label="Back to top"]')).toHaveCount(1); // hidden until the page is scrolled
  await expect(page.locator("footer #progress, footer .footer-topscroll, footer img")).toHaveCount(0);
});

test("the load overlay shows once per session and always goes away", async ({ page }) => {
  await page.goto("/about");
  await expect(page.locator("#preloader")).toBeAttached();
  await expect(page.locator("#preloader")).toBeHidden({ timeout: 3000 });
  // second page load in the same session: never shown
  await page.goto("/contact");
  await expect(page.locator("#preloader")).toBeHidden();
});
