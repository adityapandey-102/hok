# Portfolio site, design round 3: back to the template's look, with only the best changes kept

**User feedback (2026-11-12):**
- "The buttons should look like the previous ones."
- "The title style and fonts in the previous design were good; I want that."
- "The home hero looks like an AI-made design, and so does the whole website."
- "Don't change the whole design. Pick the best from the template, and improve the UI and UX."

**So:** the template's visual language is the brief, and it wins over any generic "modern" choice. Round 2 replaced it. Restore it, and keep round 1 and 2's **content** and the few true UX fixes (§3).

## 0. Rules and references
- The [site-content-1.md §0](site-content-1.md) rules apply: no git writes, no new deps, don't start or kill servers (web on 3400), Edit tool not sed, keep line endings, the build via `NEXT_DIST_DIR` with `tsconfig.json` restored.
- Progress file: `docs/specs/site-design-3-progress.md`. Scratch folder: `<scratchpad>/site-3/`.
- **Template references** (read-only; never edit them):
  - **The committed port:** `git show HEAD:"hok-web/app/(site)/page.tsx"` (and the same for `about/page.tsx`, `contact/page.tsx`, `services/page.tsx`, `modules/site/components/*.tsx` and `public/site/hok-site.css`). These are the template as it ran in our app before rounds 1–2. **Copy markup and classes from here.**
  - The original static template: `D:\Code Space\WorkSpace\buyer-file\*.html` (`index.html`, `service.html`, `about.html`, `contact.html`).
  - Screenshots of the original are in `C:\Users\progr\AppData\Local\Temp\claude\bf9e1ec3d3d58ea9\dd5fe6c6-e059-4547-84b6-389ff77939fe\scratchpad\tpl\t-0*.png`. **Look at them first.**

## 1. The template's visual language (restore it everywhere)
- **Buttons:** the template's own buttons only.
  - The **square outlined** button with a small red ↗ icon before the text (the header "Get In Touch", class `cmn-btn` / `touch-btn`).
  - The **round outlined red** button (the template's secondary style).
  - **Remove** round 2's filled-red pills, "→" arrows and any new button classes.
- **Section headings:**
  - the template's red outlined pill eyebrow with the ↗ icon ("WHAT WE OFFER ↗");
  - then a big bold white heading with **one red italic phrase**, in **Title Case** as the template has it ("Most *Experienced* Services", "Professional & *Credibility-Focused*");
  - the template's fonts, sizes and letter-spacing. Undo round 2's lowercasing and any `span` font overrides that changed the template's heading look.
- **Cards:** the template's case-study card language: sharp-cornered images, a red outlined pill tag, a bold title, a red ↗ icon on the right, and a thin bottom border. Remove round 2's rounded, shadowed cards and glass panels.
- **Header:** the template's header. Nav items keep the template's ↗ icons and hover. Only 4 items: Home, About, Services, Contact. Then the square "Get In Touch" button. No search, no cart.
- **Colours:** the template's own palette, red included. Remove round 2's added gradients and glows. The template's small lime outline accents may stay only where the template had them in the hero; elsewhere use red.

## 2. Home page, restored structure with real content
1. **Hero:** the template hero exactly: the `hero-section-version1` markup from HEAD, with the background visual, the huge uppercase two-line headline, and the second line italic plus red with the **outlined last letters** effect.
   - Text: line 1 "AI-POWERED", line 2 "MARKETING *FOR BRANDS*", with the outline on the last letters of "BRANDS" as the template does on "AGENCY".
   - Under it: the intro shortened to 2 lines ("We blend human creativity with AI to build brands people remember."), then the template's two buttons: square "Start A Project" (/contact) and round outlined "Our Work" (scrolls to the work section).
   - Keep the template's **bottom-right curved image box with the 2 stats**. Put a real image in the curve, `/site/assets/img/work/needle-eye.webp` (cover-fit), and honest stats: "10+" "brands we work with", "4" "core industries".
   - **Remove** round 2's pill label, glass counter card and "Trusted by" chips.
   - **Phone:** fix the outline-letter doubling on "BRANDS" (one clean outline only) and keep the headline within the width.
2. **Client logo strip:** the template's logo carousel section (`logo-carousel-section`) with our 7 logos. Logos sit in equal boxes with the same height and `object-fit: contain`; the white backgrounds are fine. No greyscale tricks.
3. **About intro:** reuse the template's `about-product` section **layout** (an image on the left, the heading and text on the right, and the timeline below), with real content:
   - the image is Nida's photo (`/site/assets/img/about/nida-fathima.webp`, cover-fit, the template's sharp corners);
   - eyebrow "ABOUT HOK ↗", heading "Built On Creativity, *Powered By AI*", and the 2 intro paragraphs (shortened to about 60 words in total);
   - **the template's timeline (the red markers and the 3 small cards) becomes our process:** use it for the 5 process steps. 5 markers with the step number as the "year" label ("01"…"05"), and 5 small cards with the step title and one line. Phone: a vertical list.
4. **Services:** the template's service tabs/accordion section ("WHAT WE OFFER ↗", "Most *Experienced* Services", the rows "01 ↘ Digital Marketing & Growth" with +/−) with the 4 service groups from round 1, each expanding to a short description plus a bullet list of the matching items from the 10 services. Add the template's "View All Service" round button, linking to /services.
5. **Work:** the template's text-slider marquee "SOCIAL MEDIA MARKETING" (one only), then the template's `case-study-vsesion01` card layout with our **4 reels as cards**:
   - the 9:16 poster image with sharp corners, `object-fit: cover`, and a small round red play icon centred on the image;
   - below it, a red outlined pill tag (the category: "Spa & Wellness", "Fashion & Couture", "Food & Hospitality", "Hospitality"), the client name as the bold title, and the red ↗.
   - Keep round 2's `WorkCard` behaviour (open the reel on Instagram; optional `video` support) but restyle it to this template look. On desktop show 4 in a row; on phones use the template's slider.
6. **Testimonials:** the template's testimonial section layout (the logo box on the left, the quote on the right, its own arrows) with our 4 testimonials. The template's "CLIENT'S TESTIMONIAL" marquee may return above it, since it's the template's.
7. **"LET'S TALK!" marquee:** restore the template's marquee as the closing call to action, linking to /contact. Replace its **blue** circle icon with a red version (a CSS hue/colour change or a red ↗ circle), since blue is off-brand.
8. Footer: the template's footer layout with our content (from round 1).

## 3. Keep from rounds 1–2 (the real UX fixes)
- All content in `content.ts` (the copy, clients, services, process, testimonials, contact, socials).
- The clean work cards with no Instagram iframes.
- Hidden fake pages and removed fake sections (team, blog, pricing, watch video, search, cart, newsletter).
- The sticky header with a background once you scroll (subtle); the new preloader.
- The About and Contact page content from round 1 (founder block, What we do, process, clients; Get in touch plus form), **but restyled with the template's section-heading, button and card styles** from §1.
- `prefers-reduced-motion` handling.

## 4. Motion (use restraint; the template's own motion first)
- Use the **template's own animations**: its marquees, hover effects and the AOS `data-aos` attributes exactly as the HEAD markup had them.
- **Remove** round 2's extra blanket fade-ups and the CSS `!important` AOS timing overrides that aren't in the template.
- **Add one orchestrated moment:** the hero headline lines reveal on first load (a masked slide-up, staggered), then the stats count up once. Nothing else is new.
- Counters: count up once when in view.

## 5. Checks
- lint, typecheck, test:unit, the build plus `check:bundle`.
- Update `e2e/portfolio.spec.ts` for the restored structure:
  - the template header;
  - the hero headline text;
  - the 4 work cards linking to the reels with no iframes;
  - the 5 process steps;
  - the testimonials;
  - the "LET'S TALK" link to /contact.
  
  Run it.
- **Visual comparison (required):** screenshot each home section at 1280 px and compare it side by side with the template screenshots in `scratchpad\tpl\`. Buttons, headings, cards and spacing must match the template's look. Then check 390 px. Fix the differences before reporting.

## 6. Report (15 lines or fewer)
- the files changed;
- the checks;
- the visual comparison notes;
- anything undone.
