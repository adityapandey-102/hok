# Portfolio site, design round 4: a premium, modern, quiet agency site

Rounds 1–3 are done (not committed). **User feedback (2026-11-12):**
1. The founder image is too big; it must fit in one screen.
2. The hero's bottom-right curved image and stats box: remove it or make it look good. Remove the `arrow-right-storke.png` element.
3. Don't use the outlined pill eyebrow ("ABOUT HOK ↗") for titles. Use something more premium.
4. **No dropdowns:** the services accordion hides content a visitor won't open. Show it all, better designed.
5. The bottom of the footer looks broken: fix it or remove it.
6. The intro block on the About, Services and Contact pages is still not liked. Change it.
7. **Arrows everywhere** look bad. Remove them.
8. Overall: go through every component and make the whole site look **premium, modern and professional**, like a great agency site.

**Keep** (the user liked these): the dark-and-red look, the template fonts, the heading treatment (big bold heading with **one red italic phrase**, Title Case), the hero headline, the square outlined buttons, all the real content, and the clean reel cards.

## 0. Rules
- [site-content-1.md §0](site-content-1.md): no git writes, no new deps, don't start or kill servers (web on 3400), Edit tool not sed, keep line endings, build via `NEXT_DIST_DIR` with `tsconfig.json` restored.
- Progress file: `docs/specs/site-design-4-progress.md`. Scratch folder: `<scratchpad>/site-4/`.
- Current screenshots: `C:\Users\progr\AppData\Local\Temp\claude\bf9e1ec3d3d58ea9\dd5fe6c6-e059-4547-84b6-389ff77939fe\scratchpad\walk\*.png`. Look at them first.
- **Design principle for this round:** quiet and confident. Premium comes from space, alignment, type scale and restraint, not from decoration. **Cut decoration that carries no information:** icons, arrows, pills, connector lines, sparkle images. Use one accent colour (the template red), used sparingly.

## 1. Global
- **Arrows: remove every decorative arrow and chevron** site-wide:
  - the ↗ before the nav items;
  - the ↗ in eyebrows;
  - the ↘ in the service numbers;
  - the ↗ inside buttons;
  - the » before footer links;
  - the › bullets (use a small 6 px red square or plain text);
  - the arrow circles in the "LET'S TALK" marquee (use a small red dot separator);
  - the template's hero `arrow-right-storke.png` element.
  
  Keep only functional arrows: the slider prev/next (as clean chevrons in plain circles) and the back-to-top button.
- **Section titles:** no eyebrow pill. Each section has the heading (the kept treatment), then **one intro sentence** in muted text (max about 70 characters per line), left-aligned with the heading. Optional: a 40×2 px red rule above the heading. Use it on every section **or none**, consistently.
- **Buttons:** primary = the square **solid red** button with white text. Secondary = the square **outlined white** button. Both have no icons, generous padding (about 16×32 px) and a quiet hover (background fades, 200 ms). Remove the round outlined red buttons and all icon spans in buttons.
- **Header:** logo on the left, then nav text only (Home, About, Services, Contact) with a thin underline on hover and on the active page. "Get In Touch" is the primary button on the right. It's sticky and keeps the template's dark background once you scroll.
- **Spacing:** sections 120 px apart on desktop and 72 px on phones. Use the 1200 px container. Left-align text everywhere, except the testimonial quote, which is centred.
- **Template vertical guide lines:** keep the faint centre line only if it doesn't cut through content. Otherwise hide it.

## 2. Home
1. **Hero:**
   - Keep the template hero: the background visual, the headline (with the outlined "BRANDS" fill effect), the 2-line intro, and the buttons (primary "Start a Project", secondary "See Our Work").
   - **Remove** the bottom-right curved image and stats box, and the arrow image.
   - Instead, at the bottom of the hero, add a single quiet line of text in the left column: "Trusted by 10+ brands across hospitality, fashion, wellness and real estate." It's muted, with a short red rule before it.
   - Keep the masked headline reveal on load.
   - The hero height fits one screen (min 100 vh, max about 860 px).
2. **Client logo strip (fix the bug):** the logos currently render as thin white bars.
   - Show the 7 logos as **uniform tiles**: 168×96 px, a white background, 10 px radius, `object-fit: contain` with padding.
   - The marquee scrolls slowly and continuously and pauses on hover.
   - A short muted caption sits above it: "Brands we've worked with".
3. **About HOK** (the founder block):
   - Two columns, 5/7.
   - **Photo:** max-height `min(72vh, 600px)`, aspect 4:5, `object-fit: cover`, `object-position: top`, with the template's sharp corners. **Heading plus text plus button must fit in one 800 px-high screen with the photo.**
   - The text column is vertically centred: the heading "Built On Creativity, *Powered By AI*", 2 short paragraphs, then a secondary button "About HOK".
4. **How we work** (a sequence, so numbering is right):
   - 5 columns on desktop, 1 on phones.
   - Each column: a large outlined number ("01"–"05", the template's outline-text style), the title, then the full sentence. **No clipped text.** Remove the fixed-height cards and the red triangles.
   - A single hairline runs across above the numbers. One subtle stagger on reveal.
5. **Services: no accordion.**
   - Show the 4 service groups as a **2×2 grid of open panels**, separated by hairlines (border-top and border-left), with no cards, shadows or numbers.
   - Each panel: the group title (h3), a one-line description, and its services as a plain list (a small red square bullet, 15–16 px text).
   - The section heading is "What We *Do*" with its intro sentence, and a secondary button "All Services" goes to /services.
6. **Work:** keep the "SOCIAL MEDIA MARKETING" marquee (with dot separators) and the 4 reel cards.
   - On the cards, remove the ↗. The category becomes small muted text above the client name, not a pill.
   - Heading "Reels That *Get Noticed*" plus an intro sentence.
7. **Testimonials (redesign):**
   - Remove the white logo box, the red zig-zag line and the "CLIENT'S TESTIMONIAL" marquee.
   - New: a centred layout with the heading "What Our *Clients Say*", then one large quote (about 28 px, light weight, max 760 px wide). Under it, a 56 px round logo (white chip, `contain`), the name and the brand.
   - Slider dots below. Autoplay 7 s, pause on hover, a fade transition.
8. **Closing CTA:** keep the "LET'S TALK!" marquee (dot separators) as a link to /contact.

## 3. Inner pages: About, Services, Contact
- **Page intro (replace the current one):** an editorial header on the plain dark background, with no texture image, no breadcrumb, no eyebrow and no pill.
  - **Desktop:** two columns, 7/5. On the left, the big heading (the kept treatment, e.g. "The Team Behind *Your Growth*"). On the right, aligned to the heading's baseline, the intro sentence or two in muted text.
  - A hairline below the intro, then 96 px to the content.
  - Top padding just clears the header.
  - **Phone:** stacked.
  - Keep the texts in `PAGE_INTROS`.
- **About:** the founder block (same rules as §2.3), How we work (§2.4), What we do (§2.5) and clients (the logo tiles plus the plain client list in 2–3 columns linking out, no arrows).
- **Services:** the 4 groups as **open sections** with no accordion. Each is a row: the group title and description on the left (5 cols), and its services list on the right (7 cols), with hairlines between rows. Then a closing CTA band: the heading "Have A Project *In Mind?*" and a primary button "Start a Project".
- **Contact:** keep the layout. No icons in circles; use small labels (Phone, Email, Address, Hours) in muted text above each value. The form inputs have the bottom-border style with a red focus. "Send Message" is a primary button. The social links are text links ("Instagram", "LinkedIn"), not icon boxes.

## 4. Footer (fix the broken bottom)
- **Top:** 4 columns. About (one line plus text social links), Pages, Services and Contact. Column headings are small and muted, in sentence case (no red underline). Links are plain, with no ».
- **Bottom bar:** one thin hairline, then a single row: "© 2026 HOK (House of Khalak). All rights reserved." on the left, "Staff login" on the right.
  - **Remove** the duplicate centred back-to-top circle and the small logo box. Keep only the one fixed back-to-top button (bottom-right).
- The texture image in the background is fine if it stays subtle. Otherwise use a plain darker background.

## 5. Motion (restraint)
- Keep: the hero headline reveal (the one orchestrated moment), the marquees, the logo strip scroll, the testimonial fade and the button/link hover fades.
- AOS: a single gentle `fade-up` (600 ms, `once`) per section **block**, not on every card. Remove per-card AOS.
- `prefers-reduced-motion`: everything static.

## 6. Checks
- lint, typecheck, test:unit, the build plus `check:bundle`.
- Update `e2e/portfolio.spec.ts`:
  - no accordion toggles;
  - 4 service panels are visible;
  - the process has 5 steps with full text;
  - no element `img[src*="arrow-right-storke"]`;
  - the hero has no stats box;
  - the logo tiles have a non-zero size (the bug);
  - the footer bottom has exactly 1 back-to-top button on the page;
  - the testimonials render.
  
  Run it.
- **Visual review (required):** at 1280×800 and 390×844, screenshot every section of the 4 pages and **look at each one**. Check against this spec, and especially:
  - the founder block fits in one 800 px screen;
  - no arrows remain;
  - no clipped text;
  - alignment is consistent.
  
  Fix and re-check before reporting.

## 7. Report (15 lines or fewer)
- the files changed;
- the checks;
- the visual review notes;
- anything undone.
