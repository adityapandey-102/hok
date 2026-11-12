# Portfolio site, design round 2: a clean, professional agency site with rich animation

Builds on [site-content-1.md](site-content-1.md), which is done and **not committed yet**. Scope: the public site only (`app/(site)/**`, `modules/site/**`, `public/site/**`, `e2e/portfolio.spec.ts`).

**User feedback (2026-11-11):**
- "Not properly structured… confusing, not clean."
- "Use these designs only, but improve them where they lag. A professional agency site that impresses clients and shows our work."
- "Remove unimportant parts. Improve the home hero. Add rich animation across the whole site."
- "'Our work, in motion' looks pathetic: no Instagram-style cards."

## 0. Rules
- The [site-content-1.md §0](site-content-1.md) rules apply: no git writes, no new deps, don't start or kill servers (web on 3400), Edit tool not sed, keep line endings, build with `NEXT_DIST_DIR`, restore `tsconfig.json`.
- Progress file: `docs/specs/site-design-2-progress.md`.
- Scratch folder: `<scratchpad>/site-2/`.
- **First read** `D:\Code Space\WorkSpace\HOK\.claude\skills\frontend-design\SKILL.md` if it exists (otherwise skip it), then `public/site/hok-site.css` (grep first) to learn the existing tokens.
- **Libraries already loaded** (use these; add none): AOS, Swiper, Magnific Popup, jQuery counter-up + waypoints, vanilla-tilt. CSS keyframes and IntersectionObserver are fine.
- All text and data stay in `modules/site/content.ts`.
- **Design-quality loop (required):** after each section, take a 1280 px screenshot of it, **look at it** (Read the PNG), and fix anything that looks unbalanced, cramped, misaligned or off-brand before moving on. Do a final pass at 390 px too.

## 1. One visual language (site-wide)
- **Colours:** the dark background and the brand red already in the template, plus white and greys. **Remove the off-brand accents:**
  - lime/yellow-green lines and shapes (the testimonial connector line, the corner squiggles and triangles);
  - the purple/pink sparkle star images in the marquees;
  - the blue round arrow icons in the "LET'S TALK" marquee.
  
  Replace them with red or white versions where the element is needed, or drop it.
- **Section rhythm:** each section has an eyebrow pill (the template's "ABOUT US ↗" style), a heading using the template's mixed regular/italic style, at most one paragraph, then content. Use the same vertical spacing everywhere (the template's `pt-space`/`pb-space`).
- **Marquees:** at most **one** on the home page: the "SOCIAL MEDIA MARKETING" band. Remove the "CLIENT'S TESTIMONIAL" and "LET'S TALK!" marquees and replace the latter with the CTA band in §2.7.
- Hide the Next.js dev badge from nothing; it's dev-only. Ignore it.

## 2. Home page (top to bottom)
1. **Hero (rework, same template hero).**
   - Keep the background visual with a darker gradient overlay so the text pops.
   - **Left:**
     - an eyebrow pill "AI-powered marketing agency · Bengaluru";
     - the headline "AI-Powered *Marketing* for Brands", revealed line by line (masked slide-up, staggered, about 900 ms);
     - the intro paragraph shortened to **2 lines** ("We blend human creativity with AI to build brands people remember: smarter campaigns, faster execution, measurable growth.");
     - the CTAs "Start a project" (to /contact) and "See our work" (scrolls to §2.5).
   - **Below the CTAs:** a "Trusted by" row of 5 client logos in small uniform chips.
   - **Right (desktop):** replace the template's image-plus-stats box with a clean glass card of 3 counters (counter-up on view): "10+ brands", "10 services", "4 industries".
   - **Phone:** stack it; no oversized outlined text. Fix the "FOR BRANDS" outline doubling on phones.
2. **Client logo marquee:** all 7 logos in identical rounded white cards (same size, `object-fit: contain`, padding). Slow continuous scroll, pause on hover, slight greyscale that turns to colour on hover.
3. **Why HOK** (new, short): 3 pillars in cards with a template icon each:
   - "Strategy powered by data"
   - "Creative storytelling"
   - "AI & automation"
   
   One line each, derived from the company intro. Fade-up stagger.
4. **Services:** replace the 4-row accordion with a **grid of the 10 services** (3 columns on desktop, 1 on phones). Each card has a number "01"–"10", a title, a one-line description (write a crisp one per service, about 12 words), and a "→". Hover: lift, red top border, arrow slides. Tilt is optional and subtle. The heading is "What we *do*".
5. **Our work, in motion** (rebuild; **no Instagram chrome**):
   - 4 cards in **9:16**, using the posters in `/site/assets/img/work/{maya-medi-spa,needle-eye,delight-eatery,delight-stays}.webp` with `object-fit: cover`, rounded, a subtle shadow, and a dark bottom gradient.
   - Overlay: client name ("Maya Medi Spa", "Needle Eye", "Delight Eatery", "Delight Stays"), a category ("Spa & Wellness", "Fashion & Couture", "Food & Hospitality", "Hospitality") and a round red play button.
   - Hover: image zoom 1.05, play button pulse.
   - Click: open the reel URL on Instagram in a new tab (`rel="noopener noreferrer"`).
   - **Video-ready:** in `content.ts` each work item has an optional `video` (mp4 path). When it's set, the card plays it muted and looping on hover/in view, and clicking opens a Magnific Popup lightbox playing it with sound. No videos are given yet; build the support and leave `video` unset.
   - Layout: a Swiper on phones (1.2 cards visible), a 4-column grid on desktop. Keep the "SOCIAL MEDIA MARKETING" marquee above it as the section intro.
   - Remove the iframes and the Instagram embed code entirely.
6. **Process:** the 5 steps as a horizontal timeline (vertical on phones), with numbered nodes. A red progress line draws across as you scroll into view, and the steps fade in one after another.
7. **Testimonials:** keep the slider. Clean it up:
   - the logo in a round white chip (`contain`), the quote larger with the red quote mark, the name and brand;
   - no lime lines;
   - autoplay 6 s, pause on hover, dots instead of up/down arrows.
8. **CTA band** (replaces the "LET'S TALK!" marquee): a bold red-accented band, "Ready to grow your brand?", with "Start a project" and the Instagram link.
9. Remove anything else left over from the template on the home page.

## 3. Other pages
- **About, Contact, Services:** apply §1 (accents, rhythm), the same section-header style and the same animations.
  - **About:** the founder block (already built) gets a subtle image reveal (clip-path wipe) and a pull-quote line under the text: "Built by creators, for brands that want to grow."
  - **Services:** use the same 10-card grid as the home page.
  - **Contact:** keep the layout. Polish the inputs so their focus state is red. The submit button gets a hover arrow animation.
- **Page banners** (the breadcrumb hero on inner pages): make them shorter and cleaner, with the title and breadcrumb only, and no off-brand shapes.
- **Header:** sticky, with a background blur once you scroll, and an animated underline on hover. **Footer:** a tidy 3-column layout (about plus socials / links / contact) and a thin red top line.

## 4. Animation system (site-wide, tasteful, not noisy)
- **AOS** on every section block: `fade-up`, about 700 ms, `once: true`, offset about 80, child items staggered 80 ms. The hero has its own CSS reveal (it isn't AOS).
- **Counters:** counter-up when they come into view.
- **Hovers:** 200–300 ms ease-out transitions on all cards and buttons.
- **Preloader:** keep the new one from round 1.
- **`prefers-reduced-motion`:** turn off AOS, marquee motion, counters (show the final values), hero reveal and hover zooms.
- Nothing may cause horizontal scroll or layout shift. Keep the Lighthouse-style basics: lazy images below the fold, width and height or aspect-ratio set.

## 5. Checks
- lint, typecheck, test:unit, the build plus `check:bundle`.
- **Update `e2e/portfolio.spec.ts`:**
  - no Instagram iframes on the home page;
  - 4 work cards with links to the reels;
  - the services grid has 10 cards;
  - the process has 5 steps;
  - only 1 marquee on the home page;
  - the CTA band is present.
  
  Run it.
- **Final screenshots at 1280 and 390:** every home section, plus About, Services and Contact. **View them** and fix issues before reporting.

## 6. Report (15 lines or fewer)
- the files changed;
- the checks;
- what you looked at and fixed visually;
- anything left undone.
