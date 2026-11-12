import { expect, test, type Page } from "@playwright/test";

/**
 * Portfolio smoke test (M1): every page of the ported HOK template answers,
 * shows its heading, loads without a script error and never scrolls sideways.
 * Needs only the Next.js dev server -- no hok-api, no database.
 *
 * Content round 1 (docs/specs/site-content-1.md): the menu is Home, About,
 * Services and Contact; the Pricing, Blog, Team, FAQ and Case-study pages still
 * answer but nothing links to them.
 *
 * Design round 5 (docs/specs/site-design-5.md): motion-rich: reveals, testimonial
 * logo buttons, a new contact form and a scroll-triggered contact modal.
 * Design round 6 (docs/specs/site-design-6.md): a still hero ("BRANDS", static
 * background), service cards with line graphics, one photo (the studio band) and
 * the signal motif on the inner pages.
 * Design round 7 (docs/specs/site-design-7.md): marquees that run from first paint, a
 * modal that opens at 3 (2) screens, a short transparent header, the full name and a
 * still graphic in the hero, one-row "What We Do", a Team section, a sticky-index
 * Services page, a redesigned Contact page and a text-free red-dot cursor.
 * Round 7 additions: a mobile pass (menu overlay, no sideways scroll at 360/390, 44 px tap
 * targets, a bottom-sheet modal), the real phone and email, the India / GCC / international
 * line on every page, the cubes hero graphic and "Why Brands Trust HOK".
 */

const PAGES: { path: string; heading: string }[] = [
  { path: "/", heading: "AI-Powered Marketing for" },
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

/** Scrolls the page down with real mouse-wheel events (not scrollTo) until it is `y` px down. */
async function wheelTo(page: Page, y: number) {
  await page.mouse.move(100, 100);
  for (let i = 0; i < 80; i++) {
    if ((await page.evaluate(() => window.scrollY)) >= y) return;
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(40);
  }
}

/** Keeps a test that scrolls a lot from tripping the scroll-triggered modal. */
async function noModal(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem("hokEnquirySent", "1")); // an enquiry already sent: the modal never opens by itself
}

for (const { path, heading } of PAGES) {
  test(`portfolio ${path} loads with its heading`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    expect(normalise(await page.locator("h1").first().textContent()).startsWith(normalise(heading))).toBe(true);

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

test("the menu lists only About, Services and Contact (no Home: the logo goes home)", async ({ page }) => {
  await page.goto("/about");
  const items = await page.locator("header .custom-nav a").allTextContents();
  expect(items.map((t) => t.trim())).toEqual(["About", "Services", "Contact"]);
  await expect(page.locator("header .custom-nav a.is-current")).toHaveText("About");
  await expect(page.locator('header a.brand-logo[href="/"]')).toHaveCount(1);
});

test("the header is at most 80 px tall, transparent at the top and dark and blurred once scrolled", async ({ page }) => {
  await noModal(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const header = page.locator("header.header-section");
  expect((await header.boundingBox())?.height ?? 999).toBeLessThanOrEqual(80);
  expect(await header.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  expect((await page.locator("header .brand-logo img").boundingBox())?.height ?? 999).toBeLessThanOrEqual(56);
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect.poll(() => header.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(13, 13, 13, 0.85)");
  expect(await header.evaluate((el) => getComputedStyle(el).backdropFilter)).toContain("blur");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(async () => (await header.boundingBox())?.height ?? 999).toBeLessThanOrEqual(68);
});

for (const path of LIVE_PAGES) {
  test(`portfolio ${path} links to none of the removed pages`, async ({ page }) => {
    await page.goto(path);
    const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    const bad = hrefs.filter((h) => HIDDEN_PREFIXES.some((p) => h === p || h.startsWith(p + "/")));
    expect(bad).toEqual([]);
  });
}

/** No decorative arrows or accordions on any live page (the round markers on buttons are CSS dots). The only SVGs are the graphics, the motif, the hero graphic, the team and contact icons. */
test("no decorative arrows, icons or accordions on any live page", async ({ page }) => {
  for (const path of LIVE_PAGES) {
    await page.goto(path);
    expect(await page.content(), path).not.toMatch(/arrow-right-storke|rot60|accordion-btn|serial-badge/);
    await expect(page.locator("footer svg, header:not(.hok-intro) svg")).toHaveCount(0); // .hok-intro is the page intro (it holds the motif)
    expect(
      await page
        .locator("main svg")
        .evaluateAll((els) => els.filter((el) => !el.closest(".hok-scard__gfx, .hok-motif, .hok-cubes, .hok-role__icon, .hok-trust-item__icon, .hok-markets__icon, .hok-panel__gfx, .hok-channel__icon, .hok-hero__markets")).length),
      path,
    ).toBe(0);
    await expect(page.locator("[data-hover-img], .hk-hoverimg"), path).toHaveCount(0);
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(text, path).not.toMatch(/[↗↘→»›]/);
  }
});

test("home: hero, logo tiles, what we do, reels, five steps, photo band, testimonials (no founder block)", async ({ page }) => {
  await noModal(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  // header: three text links and the primary button, no search or cart
  await expect(page.locator("header .custom-nav a.is-current")).toHaveCount(0);
  await expect(page.locator("header a.hok-btn--primary")).toHaveText(/Get In Touch/);
  // hero: the full name above the headline, and the still graphic on the right (desktop)
  await expect(page.locator(".hok-hero__name")).toContainText("House of Khalak");
  await expect(page.locator(".hok-hero__name")).toContainText("Est. Bengaluru");
  await expect(page.locator(".hok-hero__name strong")).toHaveText("House of Khalak");
  expect(await page.locator(".hok-hero__name strong").evaluate((el) => getComputedStyle(el).fontSize)).toBe("18px");
  // no "AI-powered marketing agency" line: the headline says it
  expect(await page.locator(".hok-hero").innerText()).not.toMatch(/ai-powered marketing agency/i);
  // the market line sits below the buttons (and above the proof row)
  const marketLine = page.locator(".hok-hero__markets");
  await expect(marketLine).toBeVisible();
  await expect(marketLine).toHaveText("Serving India, the GCC & international brands");
  const yOf = async (sel: string) => (await page.locator(sel).first().boundingBox())?.y ?? -1;
  const buttonsBox = await page.locator(".hok-hero .hok-actions").boundingBox();
  expect(await yOf(".hok-hero__markets")).toBeGreaterThanOrEqual((buttonsBox?.y ?? 0) + (buttonsBox?.height ?? 0));
  expect(await yOf(".hok-hero__markets")).toBeLessThan(await yOf(".hok-proof"));
  // the hero graphic: the still cubes (the old orbit is gone), bobbing and pointer-driven
  const cubes = page.locator(".hok-hero svg.hok-cubes");
  await expect(cubes).toBeVisible();
  await expect(cubes).toHaveAttribute("role", "img");
  await expect(cubes).toHaveAttribute("aria-label", "Abstract 3D cubes in HOK red");
  await expect(page.locator(".hok-orbit")).toHaveCount(0);
  expect(await cubes.locator("animate, animateTransform, animateMotion").count()).toBe(0); // nothing moves
  expect(await cubes.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await expect(page.locator(".hok-glass")).toHaveCount(0); // the "Serving..." chip lives in the markets band now
  // nine cubes, each its own group of three layers (parallax, bob, lift); the bob is driven by script, not by CSS keyframes
  expect(await cubes.locator(".hc-cube").count()).toBeGreaterThanOrEqual(8);
  expect(await cubes.locator(".hc-cube, .hc-shadow").evaluateAll((els) => els.filter((el) => getComputedStyle(el).animationName !== "none").length)).toBe(0);
  // the founder block (photo, quote card, text) is gone from home; it stays on About
  await expect(page.locator(".hok-founder, .hok-founder__quote")).toHaveCount(0);
  await expect(page.locator('img[alt*="Nida Fathima"]')).toHaveCount(0);
  await expect(page.locator("header .search-icon, header .shop-cart")).toHaveCount(0);
  // hero: the headline with the static outlined word, two buttons, the trust line; no reel wall, no stats box, no arrow image
  await expect(page.locator(".hero-v1-content h1")).toContainText("AI-Powered");
  await expect(page.locator(".hero-v1-content h1")).toContainText("Marketing for");
  await expect(page.locator(".hero-v1-content h1 .designers")).toHaveText(/^brands$/i);
  await expect(page.locator(".hok-rot, .hok-rot__word")).toHaveCount(0);
  await expect(page.locator("#mains").getByText("We blend human creativity with AI").first()).toBeVisible();
  await expect(page.locator('.hero-v1-content a.hok-btn--primary[href="/contact"]')).toHaveText("Start a Project");
  await expect(page.locator('.hero-v1-content a.hok-btn--ghost[href="#work"]')).toHaveText("See Our Work");
  // the proof row (three counters) replaces the old "Trusted by" line
  await expect(page.getByText("Trusted by 10+ brands")).toHaveCount(0);
  const proof = page.locator(".hok-proof__item");
  await expect(proof).toHaveCount(3);
  await expect(proof.locator(".hok-proof__l-full")).toHaveText(["brands served", "core industries", "markets: India, GCC, Intl"]);
  await expect(proof.locator(".hok-proof__v")).toHaveText(["10+", "4", "3"], { timeout: 4000 }); // the counters finish counting up
  expect(await proof.first().locator(".hok-proof__v").evaluate((el) => getComputedStyle(el).fontSize)).toBe("24px");
  expect(await proof.first().locator(".hok-proof__l").evaluate((el) => getComputedStyle(el).fontSize)).toBe("13px");
  // one aligned column: the brand line, headline, intro, buttons and proof row share the same left edge, 600 px at most
  const lefts = await page.locator(".hok-hero__name, .hero-v1-content h1, .hero-intro, .hok-hero .hok-actions, .hok-proof").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)));
  expect(new Set(lefts).size).toBe(1);
  expect((await page.locator(".hero-v1-content").boundingBox())?.width ?? 999).toBeLessThanOrEqual(600);
  // the whole hero, the proof row included, fits one 1280x800 screen
  const proofBox = await page.locator(".hok-proof").boundingBox();
  expect((proofBox?.y ?? 9999) + (proofBox?.height ?? 0)).toBeLessThanOrEqual(800);
  expect(await page.locator(".hok-hero").evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(800);
  await expect(page.locator(".hok-wall, .hero-expriencebox, .expri-cont-item, .expri-thumb")).toHaveCount(0);
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
  // the order: hero, logo strip, markets band, what we do, why brands trust HOK, work (reels), process, behind the work band, testimonials, let's talk
  const kinds = await page.locator("#mains > section").evaluateAll((els) =>
    els.map((el) =>
      el.classList.contains("hok-hero")
        ? "hero"
        : el.classList.contains("hok-logos")
          ? "logos"
          : el.classList.contains("hok-markets")
            ? "markets"
            : el.id === "what-we-do"
              ? "wwd"
              : el.id === "why-hok"
                ? "trust"
                : el.id === "work"
              ? "work"
              : el.querySelector(".hok-steps")
                ? "steps"
                : el.querySelector(".hok-band")
                  ? "band"
                  : el.classList.contains("hok-testi")
                    ? "testi"
                    : el.classList.contains("hok-talk-sec")
                      ? "talk"
                      : "other",
    ),
  );
  expect(kinds).toEqual(["hero", "logos", "markets", "wwd", "trust", "work", "steps", "band", "testi", "talk"]);
  // the markets band: one sentence and three static badges
  const markets = page.locator(".hok-markets");
  await expect(markets).toContainText("We work with brands across India, the GCC (UAE, Saudi Arabia, Qatar, Oman, Kuwait, Bahrain) and international markets, remote-first, on your time zone.");
  await expect(markets.locator(".hok-markets__badge")).toHaveText(["India", "GCC", "International"]);
  // why brands trust HOK: six items, shown on home too
  await expect(page.getByRole("heading", { name: "Why Brands Trust HOK" })).toBeVisible();
  await expect(page.locator(".hok-trust-item")).toHaveCount(6);
  // how we work: five steps with their full sentence (nothing clipped)
  await expect(page.locator(".hok-step")).toHaveCount(5);
  for (const step of await page.locator(".hok-step").all()) {
    const clipped = await step.locator(".hok-step__text").evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(clipped).toBe(false);
  }
  await expect(page.locator(".hok-step").first()).toContainText("Understanding business goals and target audience");
  // behind the work: the one photo band (no thumbnails), between How we work and What we do
  const band = page.locator(".hok-band");
  await expect(band).toHaveCount(1);
  await expect(band.locator('img.hok-band__img[src*="studio-production"]')).toHaveCount(1);
  await expect(band.locator("img")).toHaveCount(1);
  await expect(band.locator(".hok-band__thumbs")).toHaveCount(0);
  await expect(band.getByRole("heading", { name: "From Brief To Post, Made In-House" })).toBeVisible();
  await expect(band).toContainText("Strategy, shoots, editing and ads, under one roof.");
  await expect(band.locator('a.hok-btn--ghost[href="#work"]')).toHaveText("See Our Work");
  const sections = await page.locator("#mains > section").evaluateAll((els) =>
    els.map((el) => (el.querySelector(".hok-steps") ? "steps" : el.querySelector(".hok-band") ? "band" : el.querySelector(".hok-scards") ? "services" : "")),
  );
  expect(sections.indexOf("band")).toBe(sections.indexOf("steps") + 1);
  // what we do: no accordion, four compact cards in one row, each with a graphic, a title, a line and its items, plus the All Services button
  await expect(page.locator(".accordion-single, .accordion-btn")).toHaveCount(0);
  const cardList = page.locator(".hok-scard");
  await expect(cardList).toHaveCount(4);
  const tops = new Set<number>();
  for (const card of await cardList.all()) {
    await expect(card.locator(".hok-scard__gfx svg")).toHaveCount(1);
    await expect(card.locator("h3")).toBeVisible();
    await expect(card.locator(".hok-scard__items")).toContainText(" · ");
    tops.add(Math.round((await card.boundingBox())?.y ?? 0));
  }
  expect(tops.size).toBe(1); // one row
  expect(await page.locator("#what-we-do").evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(760);
  await expect(page.locator("[data-hover-img], .hk-hoverimg")).toHaveCount(0);
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
    await expect(cards.nth(i)).toHaveAttribute("data-cursor", "play");
  }
  await expect(page.locator(".hok-work__cat").first()).toHaveText("Spa & Wellness");
  // text sliders: social media marketing and let's talk (no testimonial marquee)
  await expect(page.locator(".scrolling-wrap")).toHaveCount(2);
  await expect(page.getByText("SOCIAL MEDIA MARKETING").first()).toBeAttached();
  // testimonials: the heading, one quote, four client buttons
  await expect(page.getByRole("heading", { name: "What Our Clients Say" })).toBeVisible();
  await expect(page.locator(".hok-quote blockquote")).toHaveCount(1);
  await expect(page.locator(".hok-testi-logos button")).toHaveCount(4);
  // the closing "Let's talk!" band is one link (it opens the contact modal; without JavaScript it goes to /contact)
  await expect(page.locator('a.hok-talk[href="/contact"][data-contact]')).toHaveCount(1);
  await expect(page.locator("a.hok-talk")).toContainText("Let’s talk!");
  await expect(page.locator("a.hok-talk")).not.toHaveAttribute("data-cursor", /.+/); // the cursor has no text labels
});

test("the marquees move on their own, without scrolling, from first load", async ({ page }) => {
  await noModal(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.locator("a.hok-talk").scrollIntoViewIfNeeded(); // scroll once to bring it on screen, then stand still
  const comm = page.locator("a.hok-talk .scrolling-wrap .comm").first();
  const x = () => comm.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
  const first = await x();
  await expect.poll(async () => Math.abs((await x()) - first), { timeout: 2500 }).toBeGreaterThan(1);
  // the logo strip on the home page runs too
  const track = page.locator(".hok-logos__track");
  const t0 = await track.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
  await expect
    .poll(async () => Math.abs((await track.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)) - t0), { timeout: 2500 })
    .toBeGreaterThan(1);
});

test("the cursor is a text-free dot: no labels anywhere", async ({ page }) => {
  await noModal(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator(".hk-cursor")).toHaveCount(1);
  expect((await page.locator(".hk-cursor").textContent())?.trim()).toBe("");
  await expect(page.locator("[data-cursor]")).toHaveCount(4); // only the four reels ("play": a triangle, never a word)
  const values = await page.locator("[data-cursor]").evaluateAll((els) => els.map((el) => el.getAttribute("data-cursor")));
  expect(new Set(values)).toEqual(new Set(["play"]));
});

test("home: the hero's word stays BRANDS and the background does not move", async ({ page }) => {
  await noModal(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const word = page.locator(".hero-v1-content h1 .designers");
  await expect(word).toHaveText(/^brands$/i);
  const bg = page.locator(".hok-hero__bg");
  const before = await bg.boundingBox();
  await page.mouse.move(200, 200);
  await page.mouse.move(1000, 600, { steps: 8 });
  await page.waitForTimeout(3200); // longer than the old word rotation
  await expect(word).toHaveText(/^brands$/i);
  expect(await bg.boundingBox()).toEqual(before);
  const moving = await bg.evaluate((el) => {
    const cs = getComputedStyle(el);
    return cs.animationName !== "none" || cs.translate !== "none";
  });
  expect(moving).toBe(false);
});

test("service cards: the graphic's lines draw once when the card enters view", async ({ page }) => {
  await noModal(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const card = page.locator(".hok-scard").first();
  await expect(card.locator(".hk-draw").first()).toHaveAttribute("style", /--len:\s*\d+/);
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveClass(/is-in/);
  await expect
    .poll(async () => card.locator(".hk-draw").first().evaluate((el) => getComputedStyle(el).strokeDashoffset), { timeout: 5000 })
    .toBe("0px");
  // hovering a card lifts it and shows no image
  await card.hover();
  await expect.poll(async () => card.evaluate((el) => getComputedStyle(el).translate)).toBe("0px -6px");
  await expect(page.locator("img.hk-hoverimg")).toHaveCount(0);
});

test("home: the testimonial logo buttons switch the quote", async ({ page }) => {
  await noModal(page);
  await page.goto("/");
  const quote = page.locator(".hok-quote blockquote");
  const buttons = page.locator(".hok-testi-logos button");
  await expect(quote).toContainText("HOK understood our craft from day one.");
  await expect(buttons.first()).toHaveAttribute("aria-pressed", "true");
  await buttons.nth(1).click();
  await expect(quote).toContainText("From reels to ads, everything is planned");
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".hok-quote__name")).toHaveText("Team Maya Medi Spa");
  await buttons.nth(3).click();
  await expect(quote).toContainText("They gave our brewhouse a voice.");
});

test("about: editorial intro with the signal motif, founder block, five steps, service cards and the clients", async ({ page }) => {
  await noModal(page);
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Team Behind Your Growth");
  await expect(page.locator(".hok-intro")).toContainText("Who we are, how we work, and the brands that trust us.");
  await expect(page.locator(".hok-intro")).toContainText("GCC");
  await expect(page.locator(".hok-intro .hok-motif")).toHaveCount(1);
  await expect(page.locator(".hok-intro img, .hok-intro__image, .hok-intro__frame")).toHaveCount(0);
  await expect(page.locator(".breadcrumnd-banner, .hok-crumb, .radius-btn")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Built on creativity, powered by AI" })).toBeVisible();
  await expect(page.getByAltText(/Nida Fathima/)).toBeVisible();
  const founder = page.getByRole("link", { name: "Nida Fathima" });
  await expect(founder).toHaveAttribute("href", "https://www.instagram.com/nidafathima_socials/");
  await expect(page.getByRole("link", { name: /Work With Us/ })).toHaveAttribute("href", "/contact");
  await expect(page.locator(".accordion-single")).toHaveCount(0);
  await expect(page.locator(".hok-scard")).toHaveCount(4);
  // the founder photo, then the one team photo are the only photos
  await expect(page.locator("main img").evaluateAll((els) => els.filter((el) => /\/stock\//.test(el.getAttribute("src") ?? "")).map((el) => el.getAttribute("src")))).resolves.toEqual([
    "/site/assets/img/stock/team-whiteboard.webp",
  ]);
  // the founder's head is not cut: a 4:5 frame, anchored near the top
  const founderImg = page.locator(".hok-founder__media img");
  expect(await founderImg.evaluate((el) => getComputedStyle(el).objectPosition)).toBe("50% 8%");
  const frame = await page.locator(".hok-founder__media").boundingBox();
  expect(Math.abs((frame?.width ?? 0) / (frame?.height ?? 1) - 0.8)).toBeLessThan(0.02);
  // the team: six role cards between the founder block and What We Do, the markets line in the intro, and the trust section after the team
  await expect(page.getByRole("heading", { name: "The People Behind The Work" })).toBeVisible();
  await expect(page.locator(".hok-role")).toHaveCount(6);
  await expect(page.locator(".hok-role__t")).toHaveText([
    "Strategy & Account Leads",
    "Social Media Managers",
    "Performance Marketers",
    "Content Writers",
    "Video Editors & Designers",
    "Developers & AI Builders",
  ]);
  await expect(page.locator(".hok-intro")).toContainText("We work with brands across India, the GCC and international markets.");
  await expect(page.locator(".hok-trust-item")).toHaveCount(6);
  const order = await page.locator("main section[id], main section").evaluateAll((els) => els.map((el) => el.id));
  expect(order.indexOf("team")).toBeLessThan(order.indexOf("why-hok"));
  expect(order.indexOf("why-hok")).toBeLessThan(order.indexOf("what-we-do"));
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

test("services: a sticky index, four panels with photo, graphic, ten services, and the closing band", async ({ page }) => {
  await noModal(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/services");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Marketing That Moves Brands");
  await expect(page.locator(".hok-intro")).toContainText("Ten ways we help brands grow, from strategy to automation.");
  await expect(page.locator(".hok-intro")).toContainText("GCC");
  await expect(page.locator(".hok-intro .hok-motif")).toHaveCount(1);
  await expect(page.locator(".hok-intro img, .hok-intro__image, .hok-intro__frame")).toHaveCount(0);
  await expect(page.locator(".accordion-single, .accordion-btn")).toHaveCount(0);
  await expect(page.locator(".hok-svc-index__btn")).toHaveCount(4);
  await expect(page.locator(".hok-svc-index__n")).toHaveText(["01", "02", "03", "04"]);
  await expect(page.locator(".hok-panel")).toHaveCount(4);
  await expect(page.locator(".hok-panel .hok-panel__gfx svg")).toHaveCount(4);
  await expect(page.locator(".hok-item")).toHaveCount(10);
  for (const item of await page.locator(".hok-item").all()) {
    await expect(item.locator("p")).not.toBeEmpty(); // the one-line blurb is always visible
  }
  for (const panel of await page.locator(".hok-panel").all()) await expect(panel.locator("h2")).toBeVisible();
  // four 16:9 photos (lazy), nothing else
  await expect(page.locator("main .hok-panel__media img")).toHaveCount(4);
  await expect(page.locator("main img")).toHaveCount(4);
  await expect(page.locator('a.hok-talk[href="/contact"]')).toHaveCount(1);
  await expect(page.locator(".hok-talk-sec .hok-motif")).toHaveCount(1);
});

test("services: the index marks the group in view and sticks, and 'Discuss This Service' opens the modal with the message filled in", async ({ page }) => {
  await noModal(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/services");
  const buttons = page.locator(".hok-svc-index__btn");
  await expect(buttons.first()).toHaveAttribute("aria-current", "true");
  await page.evaluate(() => document.getElementById("svc-2")?.scrollIntoView());
  await expect(buttons.nth(2)).toHaveAttribute("aria-current", "true");
  await expect(buttons.first()).not.toHaveAttribute("aria-current", "true");
  // the index stays on screen while the panels scroll
  const box = await buttons.first().boundingBox();
  expect(box?.y ?? -1).toBeGreaterThan(0);
  expect(box?.y ?? 9999).toBeLessThan(800);
  // clicking an index entry scrolls to its panel
  await buttons.nth(3).click();
  await expect(buttons.nth(3)).toHaveAttribute("aria-current", "true", { timeout: 5000 });
  // the panel button opens the modal, pre-filled (the click is only heard once the page has hydrated: retry)
  await page.evaluate(() => document.getElementById("svc-1")?.scrollIntoView());
  const discuss = page.locator("#svc-1").getByRole("link", { name: "Discuss This Service" });
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await discuss.click();
    await expect(dialog).toBeVisible({ timeout: 800 });
  }).toPass({ timeout: 8000 });
  await expect(dialog.locator('[name="message"]')).toHaveValue("Hi HOK, I'd like to talk about App Development & Agentic Platform.");
});

test("the signal motif is only on the inner-page intros and the closing band, and sits under the intro text on a phone", async ({ page }) => {
  await noModal(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const path of ["/about", "/services", "/contact"]) {
    await page.goto(path);
    const motif = page.locator(".hok-intro .hok-motif");
    await expect(motif, path).toHaveCount(1);
    await expect(motif.locator("svg circle.hk-ring")).toHaveCount(1);
    await expect(motif).toHaveAttribute("aria-hidden", "true");
    expect(await motif.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    await expect(motif).toBeVisible();
  }
  await page.goto("/");
  await expect(page.locator(".hok-intro")).toHaveCount(0);
  await expect(page.locator(".hok-hero .hok-motif, .hok-band .hok-motif")).toHaveCount(0);
  // on a phone: visible, 160 px tall, full width, below the text and never over it
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/about", "/services", "/contact"]) {
    await page.goto(path);
    const motif = page.locator(".hok-intro .hok-motif");
    await expect(motif, path).toBeVisible();
    const box = await motif.boundingBox();
    expect(Math.round(box?.height ?? 0), path).toBe(160);
    expect(Math.round(box?.width ?? 0), path).toBe(390);
    await page.waitForTimeout(1800); // the intro text slides up on load: measure it at rest
    const text = await page.locator(".hok-intro__text").boundingBox();
    expect(box!.y, path).toBeGreaterThanOrEqual(text!.y + text!.height);
    expect(await motif.evaluate((el) => getComputedStyle(el).opacity)).toBe("0.9");
    expect(await motif.locator("svg").getAttribute("preserveAspectRatio")).toBe("xMaxYMid slice");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
  }
  // on a tablet: 200 px tall
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.goto("/about");
  expect(Math.round((await page.locator(".hok-intro .hok-motif").boundingBox())?.height ?? 0)).toBe(200);
});

test("contact: signal motif, one photo, three channels, the studio and a form with no chip groups", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/contact");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let’s Build Something Remarkable");
  await expect(page.locator(".hok-intro")).toContainText("we’ll reply within one working day");
  await expect(page.locator(".hok-intro")).toContainText("GCC");
  await expect(page.locator(".hok-intro .hok-motif")).toHaveCount(1);
  // the info panel on the left: the one photo, three channel rows (the real phone and email), the studio
  await expect(page.locator("main img")).toHaveCount(1);
  await expect(page.locator(".hok-info__photo img")).toHaveCount(1);
  await expect(page.locator(".hok-info__title")).toHaveText("Let’s talk over coffee or a call.");
  await expect(page.locator(".hok-channel__label")).toHaveText(["Call or WhatsApp", "Email", "Instagram"]);
  const phone = page.locator('.hok-contact a.hok-channel[href="tel:+918217629841"]');
  await expect(phone).toContainText("+91 821-7629841");
  await expect(page.locator('.hok-contact a.hok-channel[href="mailto:houseofkhalaq@gmail.com"]')).toContainText("houseofkhalaq@gmail.com");
  await expect(page.locator(".hok-contact a.hok-channel[href^='https://www.instagram.com/hok.co_']")).toContainText("@hok.co_");
  await expect(page.locator(".hok-studio")).toContainText("Bengaluru, Karnataka, India");
  await expect(page.locator(".hok-studio")).toContainText("Markets: India · GCC · International");
  // both columns are side by side on desktop
  const info = await page.locator(".hok-info").boundingBox();
  const formBox = await page.locator(".hok-contact__form").boundingBox();
  expect((info?.x ?? 0) + (info?.width ?? 0)).toBeLessThan(formBox?.x ?? 0);
  // the form: filled boxes with floating labels, no "What do you need" or "Budget" chips
  const form = page.locator("form#contact-form");
  for (const name of ["name", "email", "phone", "brand", "website", "message"]) {
    await expect(form.locator(`[name="${name}"]`)).toHaveCount(1);
  }
  await expect(form.locator("input").first()).toHaveCSS("height", "56px");
  await expect(form.locator(".hok-pick, [role='radiogroup'], [role='radio'], fieldset")).toHaveCount(0);
  await expect(form.getByText(/What do you need|Budget/i)).toHaveCount(0);
  await expect(form.getByRole("button", { name: "Send Message" })).toBeVisible();
  await expect(page.locator(".contact-map, iframe[src*='google.com/maps']")).toHaveCount(0);
});

test("contact: the form has the right input types and autofill hints", async ({ page }) => {
  await page.goto("/contact");
  const form = page.locator("form#contact-form");
  const hints = async (name: string) =>
    form.locator(`[name="${name}"]`).evaluate((el) => ({ type: el.getAttribute("type"), auto: el.getAttribute("autocomplete"), mode: el.getAttribute("inputmode") }));
  expect(await hints("name")).toMatchObject({ auto: "name" });
  expect(await hints("email")).toMatchObject({ type: "email", auto: "email", mode: "email" });
  expect(await hints("phone")).toMatchObject({ type: "tel", auto: "tel", mode: "tel" });
  expect(await hints("brand")).toMatchObject({ auto: "organization" });
  expect(await hints("website")).toMatchObject({ auto: "url", mode: "url" });
});

test("contact: the form validates, then shows the thank-you state", async ({ page }) => {
  await page.goto("/contact");
  const form = page.locator("form#contact-form");
  // an empty submit shows the errors
  await form.getByRole("button", { name: "Send Message" }).click();
  await expect(form.getByText("Please tell us your name.")).toBeVisible();
  await expect(form.getByText("Please enter a valid email address.")).toBeVisible();
  await expect(form.getByText("Please write at least 10 characters.")).toBeVisible();
  await expect(form.locator('[name="name"]')).toHaveAttribute("aria-invalid", "true");
  // a bad email is caught on blur
  await form.locator('[name="email"]').fill("not-an-email");
  await form.locator('[name="message"]').focus();
  await expect(form.getByText("Please enter a valid email address.")).toBeVisible();
  // a valid enquiry shows the success state and remembers it for the session
  await form.locator('[name="name"]').fill("Asha");
  await form.locator('[name="email"]').fill("asha@example.com");
  await form.locator('[name="brand"]').fill("Asha Cafe");
  await form.locator('[name="message"]').fill("We would like a new website and a reel plan.");
  await form.getByRole("button", { name: "Send Message" }).click();
  await expect(page.getByRole("heading", { name: "Thanks, Asha." })).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".hok-sent")).toContainText("We’ll reply within one working day.");
  const mail = page.getByRole("link", { name: "Prefer email? Send it directly" });
  await expect(mail).toHaveAttribute("href", /^mailto:houseofkhalaq@gmail\.com\?subject=New%20enquiry%3A%20Asha%20Cafe&body=/);
  expect(await page.evaluate(() => sessionStorage.getItem("hokEnquirySent"))).toBe("1");
});

test("contact: the header button scrolls to the form and never opens the modal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/contact?modal=reset");
  await page.locator("header a.hok-btn--primary").click();
  await page.waitForTimeout(1200);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('form#contact-form [name="name"]')).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); // scrolling far down on /contact never opens it either
  await page.waitForTimeout(800);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test.describe("the scroll-triggered contact modal", () => {
  test("opens after 3 screens of real wheel scrolling, closes with Esc, stays closed for that page load and opens again after a reload", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/?modal=reset");
    await page.waitForLoadState("load");
    await wheelTo(page, 800 * 2);
    await page.waitForTimeout(800);
    await expect(page.getByRole("dialog")).toHaveCount(0); // two screens are not enough on desktop
    await wheelTo(page, 800 * 3 + 20);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toContainText("Got a minute? Tell us what you’re planning.");
    await expect(dialog.getByRole("heading", { name: "Tell Us About Your Brand" })).toBeVisible();
    await expect(dialog.locator('[name="name"]')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.classList.contains("hk-modal-open"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    // not again in this page load, however much more is scrolled
    await wheelTo(page, 800 * 5);
    await page.waitForTimeout(1200);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // a new page load starts afresh: the same scrolling opens it again
    await page.goto("/");
    await page.waitForLoadState("load");
    await wheelTo(page, 800 * 3 + 20);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  });

  test("on a phone (390): wheel scrolling to 2 screens opens it, a reload opens it again, and a sent enquiry stops it for good", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?modal=reset");
    await page.waitForLoadState("load");
    await wheelTo(page, 844 * 2 + 20);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await page.waitForLoadState("load");
    await wheelTo(page, 844 * 2 + 20);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    // an enquiry sent in this session: it never opens again
    await page.evaluate(() => sessionStorage.setItem("hokEnquirySent", "1"));
    await page.goto("/"); // (not a reload: ?modal=reset would clear the flag)
    await page.waitForLoadState("load");
    await wheelTo(page, 844 * 3);
    await page.waitForTimeout(1200);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the closing band opens it, focus returns to the band, a backdrop click closes it", async ({ page }) => {
    await noModal(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const band = page.locator("a.hok-talk");
    await band.scrollIntoViewIfNeeded();
    await band.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(page.url()).not.toContain("/contact"); // it opens the modal, it does not navigate
    await page.locator(".hok-modal").click({ position: { x: 5, y: 5 } });
    await expect(dialog).toHaveCount(0);
    await expect(band).toBeFocused();
  });

  test("it is a bottom sheet on a phone and the form inside works", async ({ page }) => {
    await noModal(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const panel = page.locator(".hok-modal__panel");
    // the event is only heard once the page has hydrated: send it until the sheet opens
    await expect(async () => {
      await page.evaluate(() => window.dispatchEvent(new Event("hok:contact")));
      await expect(panel).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 8000 });
    await expect
      .poll(async () => {
        const box = await panel.boundingBox();
        return box ? Math.round(box.y + box.height) : 0;
      })
      .toBe(844); // sits on the bottom edge
    await panel.getByRole("button", { name: "Send Message" }).click();
    await expect(panel.getByText("Please tell us your name.")).toBeVisible();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("shows every block, the graphics fully drawn, the motif still, and no cursor", async ({ page }) => {
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.classList.contains("hk-js"))).toBe(false);
    await expect(page.locator(".hero-v1-content h1 .designers")).toHaveText(/^brands$/i);
    // the card graphics are never hidden: no dash offset, nothing faded out
    const offsets = await page.locator(".hok-scard .hk-draw").evaluateAll((els) => els.map((el) => getComputedStyle(el).strokeDashoffset));
    expect(offsets.length).toBeGreaterThan(0);
    expect(offsets.every((o) => o === "0px")).toBe(true);
    const faded = await page.locator(".hok-scard__gfx svg > [fill]").evaluateAll((els) => els.filter((el) => getComputedStyle(el).opacity !== "1").length);
    expect(faded).toBe(0);
    // reveals never hide anything
    const hidden = await page.locator("[data-reveal]").evaluateAll(
      (els) =>
        els.filter((el) => {
          const cs = getComputedStyle(el);
          return cs.opacity !== "1" || cs.clipPath !== "none";
        }).length,
    );
    expect(hidden).toBe(0);
    const maskHidden = await page.locator('[data-reveal="mask"] .hok-m > span').evaluateAll(
      (els) => els.filter((el) => getComputedStyle(el).transform !== "none").length,
    );
    expect(maskHidden).toBe(0);
    expect(await page.evaluate(() => document.documentElement.classList.contains("hk-cursor-on"))).toBe(false);
    // the hero cubes stand still: no bob (the loop never starts), no parallax
    await page.waitForTimeout(500);
    expect(await page.locator(".hc-cube").evaluateAll((els) => els.map((el) => getComputedStyle(el).transform))).toEqual(Array(9).fill("none"));
    await expect(page.locator(".hok-step__text").first()).toBeVisible();
    await expect(page.locator(".hok-scard").first()).toBeVisible();
    await expect(page.locator(".hok-quote blockquote")).toBeVisible();
    // the motif's ring stands still
    await page.goto("/about");
    expect(await page.locator(".hok-motif .hk-ring").first().evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });
});

test("footer: a big mail link, four columns, real socials only, one thin bottom bar and exactly one back-to-top button", async ({ page }) => {
  await page.goto("/");
  const hrefs = await page.locator("footer a[href^='http']").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
  expect(hrefs).toEqual(expect.arrayContaining(["https://www.instagram.com/hok.co_/", "https://www.linkedin.com/company/houseofkhalak/"]));
  expect(hrefs.some((h) => /facebook|twitter|x.com|youtube/.test(h ?? ""))).toBe(false);
  const statement = page.locator("footer a.hok-footer__statement");
  await expect(statement).toHaveText("houseofkhalaq@gmail.com");
  await expect(statement).toHaveAttribute("href", "mailto:houseofkhalaq@gmail.com");
  await expect(statement).not.toHaveAttribute("data-cursor", /.+/);
  // the real phone and email in the footer, and the markets line under the About text
  await expect(page.locator('footer a[href="tel:+918217629841"]')).toHaveText("+91 821-7629841");
  await expect(page.locator('footer a[href="mailto:houseofkhalaq@gmail.com"]')).toHaveCount(2);
  await expect(page.locator(".hok-footer__markets")).toHaveText("Serving India · GCC · International");
  await expect(page.locator("footer")).not.toContainText(/hello@houseofkhalak|98450/);
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

// ---- Round 7: the modal's trigger, the cubes, the markets line, "Why Brands Trust HOK" ----

test("modal: a fresh visitor scrolling to 3.1 screens sees it at once (desktop); ?modal=reset brings it back", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("load");
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3.1));
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1500 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/?modal=reset"); // a new page load: it can open again
  await page.waitForLoadState("load");
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3.1));
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1500 });
});

test("modal: on a phone-sized screen 2.1 screens of scrolling are enough, and never after an enquiry was sent", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("load");
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2.1));
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1500 });
  // after a sent enquiry the modal stays away
  const fresh = await page.context().newPage();
  await fresh.addInitScript(() => sessionStorage.setItem("hokEnquirySent", "1"));
  await fresh.setViewportSize({ width: 390, height: 844 });
  await fresh.goto("/");
  await fresh.waitForLoadState("load");
  await fresh.evaluate(() => window.scrollTo(0, window.innerHeight * 2.5));
  await fresh.waitForTimeout(1200);
  await expect(fresh.getByRole("dialog")).toHaveCount(0);
});

test("hero cubes: only up and down, a 2.2s wave travelling left to right on one clock (always moving, phase steps with x); no parallax, sway, hover lift or hop", async ({ page }) => {
  await noModal(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("load");
  const cubes = page.locator(".hok-hero .hc-cube");
  expect(await cubes.count()).toBeGreaterThanOrEqual(8);
  // the big cube bobs 12 px, the others 14 px
  const meta = await cubes.evaluateAll((els) => els.map((el) => (el as SVGElement).dataset.amp));
  expect(meta).toEqual(["12", ...Array(meta.length - 1).fill("14")]);
  // always moving: three samples 300 ms apart (a seventh of the 2.2 s beat) all differ
  const bobY = (i: number) => cubes.nth(i).evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42);
  const samples: number[] = [];
  for (let k = 0; k < 3; k++) {
    samples.push(await bobY(0));
    await page.waitForTimeout(300);
  }
  expect(Math.abs(samples[0] - samples[1])).toBeGreaterThan(0.01);
  expect(Math.abs(samples[1] - samples[2])).toBeGreaterThan(0.01);
  expect(Math.abs(samples[0] - samples[2])).toBeGreaterThan(0.01);
  // a wave: at one instant, cubes sorted by x show a progressive phase (not all at the same height, neighbours less than pi apart),
  // and the offsets are exactly y = A sin(w - 2 pi x / 560) for one shared w (so the crest travels left to right)
  for (let round = 0; round < 3; round++) {
    const wave = await page.evaluate(() =>
      Array.from(document.querySelectorAll<SVGGElement>(".hok-hero .hc-cube"))
        .map((g) => {
          const box = g.getBBox();
          const m = new DOMMatrixReadOnly(getComputedStyle(g).transform);
          return { cx: box.x + box.width / 2, amp: Number(g.dataset.amp), x: m.m41, y: m.m42 };
        })
        .sort((a, b) => a.cx - b.cx),
    );
    for (let i = 1; i < wave.length; i++) expect(((2 * Math.PI) * (wave[i].cx - wave[i - 1].cx)) / 560).toBeLessThan(Math.PI); // neighbours differ in phase by less than pi
    for (const c of wave) expect(Math.abs(c.x)).toBeLessThan(0.001); // no sway
    const norm = wave.map((c) => c.y / c.amp);
    expect(Math.max(...norm) - Math.min(...norm)).toBeGreaterThan(0.6); // not all at the same height
    let best = Infinity;
    for (let k = 0; k < 720; k++) {
      const w = (k / 720) * 2 * Math.PI;
      best = Math.min(best, wave.reduce((s, c, i) => s + (norm[i] - Math.sin(w - (2 * Math.PI * c.cx) / 560)) ** 2, 0));
    }
    expect(best).toBeLessThan(0.05); // one sine wave sampled at each cube's x
    await page.waitForTimeout(550);
  }
  // only up and down: over one second, with the pointer moving across the hero and a click on a cube, the cubes' transform stays
  // translateY (x = 0), nothing sets `translate` or `scale`, no animation runs on them, and they never stop moving
  const big = cubes.first();
  const box = await big.boundingBox();
  const centre = { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) * 0.6 };
  await page.evaluate(() => {
    (window as unknown as { __cubeLog: { x: number; y: number }[][] }).__cubeLog = [];
    const log = () => {
      (window as unknown as { __cubeLog: { x: number; y: number }[][] }).__cubeLog.push(
        Array.from(document.querySelectorAll<SVGGElement>(".hok-hero .hc-cube")).map((g) => {
          const m = new DOMMatrixReadOnly(getComputedStyle(g).transform);
          return { x: m.m41, y: m.m42 };
        }),
      );
    };
    const id = setInterval(log, 100);
    setTimeout(() => clearInterval(id), 1100);
  });
  await page.mouse.move(centre.x, centre.y, { steps: 4 }); // hover a cube
  await page.mouse.move(200, 200, { steps: 6 }); // sweep the pointer across the hero
  await page.mouse.move(centre.x, centre.y, { steps: 4 });
  await page.mouse.down(); // click on a cube
  await page.mouse.up();
  await page.waitForTimeout(900);
  const log = await page.evaluate(() => (window as unknown as { __cubeLog: { x: number; y: number }[][] }).__cubeLog);
  expect(log.length).toBeGreaterThanOrEqual(8);
  for (const frame of log) for (const c of frame) expect(Math.abs(c.x)).toBeLessThan(0.001); // translateY only: x stays 0
  // every cube's y changes over time (about half a beat in this second: at least 2 px of travel each)
  for (let i = 0; i < log[0].length; i++) {
    const ys = log.map((f) => f[i].y);
    expect(Math.max(...ys) - Math.min(...ys), `cube ${i}`).toBeGreaterThan(2);
  }
  // nothing else moves a cube: no translate, no scale, no Web Animation (no hop), no CSS animation or transition on a cube
  const extras = await page.evaluate(() =>
    Array.from(document.querySelectorAll<SVGGElement>(".hok-hero .hc-cube")).map((g) => {
      const cs = getComputedStyle(g);
      return [cs.translate, cs.scale, g.getAnimations().length, cs.animationName];
    }),
  );
  for (const e of extras) expect(e).toEqual(["none", "none", 0, "none"]);
  await expect(page.locator(".hok-hero .hc-bob, .hok-hero .hc-lift")).toHaveCount(0);
});

test("every live page says it works with India, the GCC and international brands", async ({ page }) => {
  for (const path of LIVE_PAGES) {
    await page.goto(path);
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(text, path).toContain("GCC");
    expect(text, path).toMatch(/Serving India · GCC · International/);
  }
});

test("why brands trust HOK: six items in a hairline grid, at most one screen tall (home and about)", async ({ page }) => {
  await noModal(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const path of ["/", "/about"]) {
    await page.goto(path);
    const section = page.locator("#why-hok");
    await expect(section.getByRole("heading", { name: "Why Brands Trust HOK" })).toBeVisible();
    await expect(section).toContainText("One in-house team, from first idea to final report.");
    await expect(section.locator(".hok-trust-item")).toHaveCount(6);
    await expect(section.locator(".hok-trust-item__t")).toHaveText([
      "End-to-end, in-house",
      "AI-powered workflows",
      "Proven across industries",
      "India, GCC & international",
      "One dedicated lead",
      "Results you can see",
    ]);
    expect(await section.evaluate((el) => el.getBoundingClientRect().height), path).toBeLessThanOrEqual(800);
    // three columns of two rows
    const xs = new Set(await section.locator(".hok-trust-item").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x))));
    expect(xs.size).toBe(3);
  }
  await page.goto("/");
  const kinds = await page.locator("#mains > section").evaluateAll((els) => els.map((el) => el.id || el.className.split(" ")[0]));
  expect(kinds.indexOf("why-hok")).toBe(kinds.indexOf("what-we-do") + 1);
});

// ---- Round 7: the mobile pass (360, 390 and 768 px) ----

for (const width of [360, 390]) {
  test.describe(`mobile ${width}px`, () => {
    test.use({ viewport: { width, height: width === 360 ? 740 : 844 } });

    for (const path of LIVE_PAGES) {
      test(`${path}: no sideways scroll, no text under 13px`, async ({ page }) => {
        await noModal(page);
        await page.goto(path);
        await page.waitForLoadState("load");
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
        // every visible text is at least 13 px
        const small = await page.evaluate(() => {
          const out: string[] = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const el = n.parentElement;
            if (!el || !n.textContent?.trim() || el.closest("script, style, noscript, .hk-cursor")) continue;
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            if (cs.display === "none" || cs.visibility === "hidden" || r.width === 0) continue;
            // (the hero proof labels on a phone are 12 px by design, round 8)
            if (parseFloat(cs.fontSize) < (el.classList.contains("hok-proof__l") ? 11.99 : 12.99)) out.push(`${el.className || el.tagName}: ${cs.fontSize}`);
          }
          return out;
        });
        expect(small).toEqual([]);
      });
    }

    test("the menu opens full screen, locks the page, closes with the same button, Esc and a link tap", async ({ page }) => {
      await noModal(page);
      await page.goto("/about");
      await page.waitForLoadState("load");
      const toggle = page.locator(".hok-menu-btn");
      expect((await toggle.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      expect((await toggle.boundingBox())?.width).toBeGreaterThanOrEqual(44);
      expect((await page.locator("header.header-section").boundingBox())?.height).toBeLessThanOrEqual(66);
      // the 44 px button: two white lines on no box (no background, border or blur)
      expect(await toggle.evaluate((el) => { const cs = getComputedStyle(el); return [cs.backgroundColor, cs.borderTopWidth, cs.backdropFilter]; })).toEqual(["rgba(0, 0, 0, 0)", "0px", "none"]);
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(toggle).toHaveAttribute("aria-label", "Open menu");
      expect(await toggle.locator("span").count()).toBe(2);
      const menu = page.locator(".hok-menu");
      // hydration: retry the click until the overlay appears
      await expect(async () => {
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click(); // the button toggles: never click it while open
        await expect(menu).toBeVisible({ timeout: 600 });
      }).toPass({ timeout: 8000 });
      const box = await menu.boundingBox();
      expect(Math.round(box?.width ?? 0)).toBe(width);
      expect(Math.round(box?.height ?? 0)).toBe(width === 360 ? 740 : 844);
      await expect(menu.locator(".hok-menu__link")).toHaveText(["About", "Services", "Contact"]);
      expect(await menu.locator(".hok-menu__link").first().evaluate((el) => getComputedStyle(el).fontSize)).toBe("28px");
      await expect(menu.getByRole("link", { name: "Get In Touch" })).toBeVisible();
      await expect(menu.getByRole("link", { name: "Instagram" })).toBeVisible();
      await expect(menu.getByRole("link", { name: "LinkedIn" })).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden"); // the page behind does not scroll
      // open state: aria-expanded, the label, a white X on no background (the lines turn 45 degrees), the overlay has no separate X
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(toggle).toHaveAttribute("aria-label", "Close menu");
      await expect(menu.locator(".hok-menu__close, .hok-menu__bar")).toHaveCount(0);
      await page.waitForTimeout(450); // the 300 ms morph
      expect(await toggle.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
      expect(await toggle.locator("span").first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
      expect(await toggle.locator("span").first().evaluate((el) => getComputedStyle(el).transform)).toMatch(/^matrix\(0\.707/);
      // the button sits above the overlay
      expect(await page.evaluate(() => document.elementFromPoint(innerWidth - 30, 32)?.closest(".hok-menu-btn") !== null)).toBe(true);
      // focus stays inside the menu or on the button
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => !!document.activeElement?.closest(".hok-menu, .hok-menu-btn"))).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
      // the same button closes it too, and a link tap goes to the page
      await toggle.click();
      await expect(menu).toBeVisible();
      await toggle.click();
      await expect(menu).toHaveCount(0);
      await toggle.click();
      await menu.getByRole("link", { name: "Services" }).click();
      await page.waitForURL("**/services");
    });

    test("tap targets in the header and footer are at least 44px", async ({ page }) => {
      await noModal(page);
      await page.goto("/");
      await page.waitForLoadState("load");
      const tooSmall = async (selector: string) =>
        page.locator(selector).evaluateAll((els) =>
          els
            .map((el) => ({ text: (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30), box: el.getBoundingClientRect() }))
            .filter((x) => x.box.width > 0 && (x.box.height < 43.5 || x.box.width < 43.5))
            .map((x) => `${x.text}: ${Math.round(x.box.width)}x${Math.round(x.box.height)}`),
        );
      expect(await tooSmall("header .hok-menu-btn, header a.brand-logo")).toEqual([]);
      expect(await tooSmall("footer a")).toEqual([]);
      expect(await tooSmall("#progress")).toEqual([]);
      expect(await tooSmall("main .hok-btn")).toEqual([]);
      expect(await tooSmall(".hok-chip")).toEqual([]);
    });
  });
}

test.describe("mobile 390px: layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("home: a clean hero (cubes on top, one-line brand, 3-line headline, full-width primary and a text link), a swipe row of 80% service cards, 70% reels, 120x72 logos, a 20px gutter", async ({ page }) => {
    await noModal(page);
    await page.goto("/");
    await page.waitForLoadState("load");
    const h1 = await page.locator(".hero-v1-content h1 .designers").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(h1).toBeGreaterThanOrEqual(36);
    expect(h1).toBeLessThanOrEqual(46);
    expect(await page.locator(".hok-hero .container").first().evaluate((el) => getComputedStyle(el).paddingLeft)).toBe("20px");
    // the cubes graphic is on top, 200 px tall, bobbing
    const cubesBox = await page.locator(".hok-hero svg.hok-cubes").boundingBox();
    await expect(page.locator(".hok-hero svg.hok-cubes")).toBeVisible();
    expect(Math.round(cubesBox?.height ?? 0)).toBe(200);
    expect(Math.round(cubesBox?.width ?? 0)).toBe(350);
    const nameBox = await page.locator(".hok-hero__name").boundingBox();
    expect(cubesBox!.y + cubesBox!.height).toBeLessThanOrEqual(nameBox!.y);
    // (the cubes move on a phone too: the same sine loop, no parallax)
    const phoneBob = async () => page.locator(".hok-hero .hc-cube").first().evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42);
    const p0 = await phoneBob();
    await page.waitForTimeout(300);
    expect(Math.abs((await phoneBob()) - p0)).toBeGreaterThan(0.2);
    // the brand line is just the lockup on one line: no tagline, no hairline or "Est." under 400 px
    await expect(page.locator(".hok-hero__name strong")).toBeVisible();
    await expect(page.locator(".hok-hero__est")).toBeHidden();
    await expect(page.locator(".hok-hero__markets")).toBeHidden();
    expect(await page.locator(".hok-hero").innerText()).not.toMatch(/ai-powered marketing agency|serving india|bengaluru/i);
    expect(nameBox!.height).toBeLessThan(30); // one line
    // the headline is three lines: AI-POWERED / MARKETING FOR / BRANDS
    const lineHeight = await page.locator(".hero-v1-content h1 .designers").evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    const h1Box = await page.locator(".hero-v1-content h1").boundingBox();
    expect(Math.round((h1Box?.height ?? 0) / lineHeight)).toBe(3);
    // the intro is at most three lines
    expect(await page.locator(".hero-intro").evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))).toBeLessThanOrEqual(3.1);
    // the primary is full width and 52 px tall; the secondary is a centred text link under it
    const primary = await page.locator(".hok-hero .hok-btn--primary").boundingBox();
    const link = await page.locator(".hok-hero .hok-btn--ghost").boundingBox();
    expect(Math.round(primary?.width ?? 0)).toBe(350);
    expect(Math.round(primary?.height ?? 0)).toBe(52);
    expect(link!.width).toBeLessThan(200);
    expect(Math.abs(link!.x + link!.width / 2 - 195)).toBeLessThan(2);
    expect(await page.locator(".hok-hero .hok-btn--ghost").evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("0px");
    // the proof row: short labels, 20 px values, no hairline above it
    await expect(page.locator(".hok-proof__l-short")).toHaveText(["brands", "industries", "markets"]);
    expect(await page.locator(".hok-proof__v").first().evaluate((el) => getComputedStyle(el).fontSize)).toBe("20px");
    expect(await page.locator(".hok-proof").evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("0px");
    await page.waitForTimeout(2500); // the hero fade-ins (they slide 14 px) are done
    // airy spacing: 32 below the header, 36 under the cubes, 24 under the lockup and the headline, 36 under the intro
    const gap = async (a: string, b: string) =>
      page.evaluate(([x, y]) => document.querySelector(y)!.getBoundingClientRect().top - document.querySelector(x)!.getBoundingClientRect().bottom, [a, b]);
    expect(Math.round((await page.locator(".hok-hero svg.hok-cubes").boundingBox())!.y)).toBe(96); // 64 header + 32
    expect(Math.round(await gap(".hok-hero svg.hok-cubes", ".hok-hero__name"))).toBe(36);
    expect(await gap(".hok-hero__name", ".hero-v1-content h1")).toBeGreaterThanOrEqual(21); // 24 (the headline's mask padding eats a couple of px)
    expect(await gap(".hok-hero__name", ".hero-v1-content h1")).toBeLessThanOrEqual(25);
    expect(await gap(".hero-v1-content h1", ".hero-intro")).toBeGreaterThanOrEqual(19); // (the mask's negative margin: the visible gap under the letters is 24)
    expect(await gap(".hero-v1-content h1", ".hero-intro")).toBeLessThanOrEqual(25);
    expect(Math.round(await gap(".hero-intro", ".hok-hero .hok-btn--primary"))).toBe(36);
    expect(await page.locator(".hero-intro").evaluate((el) => getComputedStyle(el).lineHeight)).toBe("26.4px"); // 16 x 1.65
    // the whole hero is at most 1.35 screens tall
    expect(await page.locator(".hok-hero").evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(844 * 1.35);
    // no empty block: the proof row sits right under the link
    const proofTop = await page.locator(".hok-proof").evaluate((el) => el.getBoundingClientRect().y);
    expect(proofTop - (link!.y + link!.height)).toBeLessThan(60);
    const tile = await page.locator(".hok-logos .hok-logo").first().boundingBox();
    expect([Math.round(tile?.width ?? 0), Math.round(tile?.height ?? 0)]).toEqual([120, 72]);
    // what we do: a scroll-snap row, cards 80% wide with the next one peeking
    const row = page.locator(".hok-scards");
    expect(await row.evaluate((el) => getComputedStyle(el).scrollSnapType)).toContain("x");
    const card = await page.locator(".hok-scard").first().boundingBox();
    expect(Math.round(((card?.width ?? 0) / 350) * 100)).toBe(80);
    const second = await page.locator(".hok-scard").nth(1).boundingBox();
    expect(second?.x ?? 9999).toBeLessThan(390 - 20); // a visible peek
    await expect(page.locator(".hok-swipe")).toBeVisible();
    // reels: 70%
    const reel = await page.locator(".hok-reels__item").first().boundingBox();
    expect(Math.round(((reel?.width ?? 0) / 350) * 100)).toBe(70);
    // markets band stacked: the text above the badges
    const text = await page.locator(".hok-markets__text").boundingBox();
    const badges = await page.locator(".hok-markets__badges").boundingBox();
    expect(badges?.y ?? 0).toBeGreaterThan((text?.y ?? 0) + (text?.height ?? 0) - 1);
  });

  test("no hover-only content: the reel names are visible without hovering", async ({ page }) => {
    await noModal(page);
    await page.goto("/");
    await expect(page.locator(".hok-work__below .hok-work__name").first()).toBeVisible();
  });

  test("services: the chip row stays under the header while the panels scroll", async ({ page }) => {
    await noModal(page);
    await page.goto("/services");
    await page.waitForLoadState("load");
    await page.evaluate(() => window.scrollTo(0, 1800));
    await page.waitForTimeout(300);
    const nav = await page.locator(".hok-svc-index").boundingBox();
    expect(Math.round(nav?.y ?? -1)).toBe(64);
    for (const chip of await page.locator(".hok-svc-index__btn").all()) expect((await chip.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  });

  test("contact: one column with the form first, 52px fields, a full-width Send button", async ({ page }) => {
    await noModal(page);
    await page.goto("/contact");
    await page.waitForLoadState("load");
    const form = await page.locator(".hok-contact__form").boundingBox();
    const info = await page.locator(".hok-info").boundingBox();
    expect(form?.y ?? 9999).toBeLessThan(info?.y ?? 0);
    const inputs = page.locator("form#contact-form input");
    for (const input of await inputs.all()) {
      const box = await input.boundingBox();
      expect(Math.round(box?.height ?? 0)).toBe(52);
    }
    const first = await inputs.nth(0).boundingBox();
    const second = await inputs.nth(1).boundingBox();
    expect(Math.round(first?.width ?? 0)).toBe(Math.round(second?.width ?? 1)); // full-width, stacked
    expect(second?.y ?? 0).toBeGreaterThan(first?.y ?? 0);
    const send = await page.locator("form#contact-form").getByRole("button", { name: "Send Message" }).boundingBox();
    expect(Math.round(send?.width ?? 0)).toBe(Math.round(first?.width ?? 1));
  });

  test("the modal is a bottom sheet: at most 88% tall, a sticky bar with a 44px close button, internal scroll", async ({ page }) => {
    await noModal(page);
    await page.goto("/");
    const panel = page.locator(".hok-modal__panel");
    await expect(async () => {
      await page.evaluate(() => window.dispatchEvent(new Event("hok:contact")));
      await expect(panel).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 8000 });
    await expect
      .poll(async () => {
        const box = await panel.boundingBox();
        return box ? Math.round(box.y + box.height) : 0;
      })
      .toBe(844);
    const box = await panel.boundingBox();
    expect(box?.height ?? 9999).toBeLessThanOrEqual(844 * 0.88 + 1);
    expect(await panel.evaluate((el) => getComputedStyle(el).overflowY)).toBe("auto");
    const close = await panel.locator(".hok-modal__close").boundingBox();
    expect(close?.height).toBeGreaterThanOrEqual(44);
    // the bar stays at the top while the form scrolls
    await panel.evaluate((el) => el.scrollTo(0, 200));
    expect(Math.abs(((await panel.locator(".hok-modal__close").boundingBox())?.y ?? 0) - (close?.y ?? 0))).toBeLessThan(2);
    // fields are full width and tall enough
    const field = await panel.locator('[name="name"]').boundingBox();
    expect(Math.round(field?.height ?? 0)).toBe(52);
  });
});

test.describe("tablet 768px", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  for (const path of LIVE_PAGES) {
    test(`${path}: no sideways scroll and the menu is the phone menu`, async ({ page }) => {
      await noModal(page);
      await page.goto(path);
      await page.waitForLoadState("load");
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
      await expect(page.locator(".hok-menu-btn")).toBeVisible();
    });
  }
});
