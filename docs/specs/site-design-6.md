# Portfolio site, design round 6: calmer hero, service cards with graphics, fewer and better images

Round 5 is built (uncommitted). The saved version to return to is commit `b4f62e5`. **User feedback (2026-11-12):**
1. Hero: the cube background must not move (static). The rotating word: show "BRANDS" only.
2. The services photo that follows the cursor (home, services, about) is annoying. Use **cards with graphics** instead.
3. The images look bad. Use good professional images, **but not too many**. Add **graphics** so the site looks more graphic.

## 0. Rules
- The [site-content-1.md §0](site-content-1.md) rules apply: no git writes, no new deps, don't start or kill servers (web on 3400), **Edit tool only (no sed)**, keep line endings, build via `NEXT_DIST_DIR` with `tsconfig.json` restored.
- Progress file: `docs/specs/site-design-6-progress.md`. Scratch folder: `<scratchpad>/site-6/`.
- The design below is final. Use the SVGs exactly as given (you may only add `aria-hidden="true"`, `focusable="false"` and class names).

## 1. Hero
- **Remove** the rotating word (`HeroRotator`, `HERO_ROTATE` and its e2e test). Line 2 is "MARKETING FOR **BRANDS**" with the template's red outline-fill effect on "BRANDS", as before round 5.
- **Background static:** remove the ambient drift and the mouse parallax on the cubes. Keep the cursor spotlight glow (it's subtle and only follows the pointer).
- Keep the headline mask reveal on load.

## 2. Service cards (replace the service rows on home, about and services)
- **Remove** the hover-image-follow feature entirely: the `data-hover-img` attributes, the follower element, its JS and CSS.
- **Card:**
  - Background `--hk-panel` (#161616), border `1px solid var(--hk-line)`, radius 14px, padding 32px. Overflow hidden.
  - Content: a **graphic area** 160px high at the top (the SVG, centred, max-width 260px), then the title (h3), the one-line description (muted), and the item tags (the existing tag style).
- **Layout:** home and about use a 2×2 grid (1 column under 768px), with a gap of 24px. The services page uses the same cards **plus** each item's blurb under its tag list as a plain list (item title in white, blurb in muted text).
- **Motion:** when a card enters view, its SVG lines **draw once**. Any element with `class="hk-draw"` uses `stroke-dasharray: var(--len); stroke-dashoffset: var(--len)` going to 0 over 1.4 s `--hk-ease`. Compute `--len` with `getTotalLength()` in SiteMotion; the fill elements fade in afterwards.
  - Hover (desktop): the card lifts `translateY(-6px)`, the border turns `rgba(190,30,40,.6)`, and a 2px red top line grows from the left (`::before` scaleX 0→1). **No image appears.**
- **The 4 graphics** (`modules/site/components/ServiceGraphics.tsx`, keyed by group). The order matches `SERVICE_GROUPS`; map by title.

Digital Marketing & Growth:
```svg
<svg viewBox="0 0 240 160" fill="none"><g stroke="#fff" stroke-opacity=".14"><path d="M20 140H220"/><path d="M20 110H220"/><path d="M20 80H220"/><path d="M20 50H220"/></g><g fill="#fff" fill-opacity=".08"><rect x="34" y="104" width="18" height="36" rx="3"/><rect x="74" y="86" width="18" height="54" rx="3"/><rect x="114" y="92" width="18" height="48" rx="3"/><rect x="154" y="62" width="18" height="78" rx="3"/><rect x="194" y="40" width="18" height="100" rx="3"/></g><path class="hk-draw" d="M43 100 L83 80 L123 88 L163 54 L203 30" stroke="#be1e28" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><g fill="#be1e28"><circle cx="43" cy="100" r="4"/><circle cx="83" cy="80" r="4"/><circle cx="123" cy="88" r="4"/><circle cx="163" cy="54" r="4"/><circle cx="203" cy="30" r="5"/></g></svg>
```
App Development & Agentic Platform:
```svg
<svg viewBox="0 0 240 160" fill="none"><circle cx="120" cy="80" r="62" stroke="#fff" stroke-opacity=".1"/><circle cx="120" cy="80" r="38" stroke="#fff" stroke-opacity=".18" stroke-dasharray="3 5"/><g class="hk-draw" stroke="#be1e28" stroke-width="1.6"><path class="hk-draw" d="M120 80 L62 48"/><path class="hk-draw" d="M120 80 L180 44"/><path class="hk-draw" d="M120 80 L66 122"/><path class="hk-draw" d="M120 80 L184 114"/></g><g fill="#161616" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"><circle cx="62" cy="48" r="9"/><circle cx="180" cy="44" r="9"/><circle cx="66" cy="122" r="9"/><circle cx="184" cy="114" r="9"/></g><rect x="102" y="62" width="36" height="36" rx="9" fill="#be1e28"/><path d="M113 80h14M120 73v14" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
```
Startup Acceleration & Consulting:
```svg
<svg viewBox="0 0 240 160" fill="none"><path d="M20 140H220" stroke="#fff" stroke-opacity=".14"/><path d="M30 136 C 90 132, 140 100, 196 36" stroke="#fff" stroke-opacity=".22" stroke-dasharray="2 6" stroke-linecap="round"/><path class="hk-draw" d="M30 136 C 90 132, 140 100, 196 36" stroke="#be1e28" stroke-width="2.5" stroke-linecap="round"/><g fill="#fff" fill-opacity=".85"><circle cx="72" cy="131" r="3.5"/><circle cx="122" cy="110" r="3.5"/><circle cx="162" cy="78" r="3.5"/></g><circle cx="196" cy="36" r="15" stroke="#be1e28" stroke-width="2"/><circle cx="196" cy="36" r="6" fill="#be1e28"/></svg>
```
Creative & Visual Design:
```svg
<svg viewBox="0 0 240 160" fill="none"><g stroke="#fff" stroke-opacity=".08"><path d="M60 16V144M120 16V144M180 16V144M20 48H220M20 112H220"/></g><circle cx="94" cy="86" r="40" fill="#be1e28" fill-opacity=".92"/><rect class="hk-draw" x="110" y="44" width="70" height="70" rx="6" stroke="#fff" stroke-width="2"/><path d="M150 130 L182 74 L214 130 Z" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-opacity=".5"/></svg>
```
(In the App Development graphic, put `hk-draw` on the 4 `<path>`s only, not on the `<g>`.)

## 3. Images: fewer, better
- **Remove:**
  - the photo strips under the About, Services and Contact page intros;
  - the contact page side photo (`phone-recording-creator`);
  - the services hover images.
  
  Delete the unused files in `public/site/assets/img/stock/`, **except `studio-production.webp`**, which has just been replaced with a high-resolution version (1920 px).
- **Keep:** Nida's photo, the 4 reel posters, the client logos, and the "Behind The Work" band, now using the new high-res `studio-production.webp`. In the band, **remove the 3 small thumbnails** (they used the removed photos). Keep its heading, line and button.
- Update `STOCK` in content.ts to the one remaining image.

## 4. Graphics (the brand motif, replacing the removed photos)
**Signal motif:** thin concentric rings plus a dot grid, suggesting reach and growth. Make it one component, `modules/site/components/SignalMotif.tsx`, with `aria-hidden`:
```svg
<svg viewBox="0 0 520 360" fill="none"><defs><pattern id="hk-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#fff" fill-opacity=".18"/></pattern></defs><rect x="0" y="0" width="300" height="220" fill="url(#hk-dots)"/><g stroke="#fff" stroke-opacity=".1"><circle cx="380" cy="230" r="60"/><circle cx="380" cy="230" r="110"/><circle cx="380" cy="230" r="160"/><circle cx="380" cy="230" r="210"/></g><circle class="hk-ring" cx="380" cy="230" r="160" stroke="#be1e28" stroke-opacity=".75" stroke-width="1.5" stroke-dasharray="6 14"/><circle cx="380" cy="230" r="8" fill="#be1e28"/><circle cx="270" cy="148" r="4" fill="#fff" fill-opacity=".7"/><circle cx="486" cy="120" r="4" fill="#fff" fill-opacity=".7"/></svg>
```
- `.hk-ring` rotates slowly (`transform-origin: 380px 230px`, 60 s linear infinite). That's the only motion; it's static under reduced motion.
- **Use:**
  - **Inner page intros** (About, Services, Contact): place it on the right half of the intro, behind the intro text column. Absolute, max-width 520px, opacity 1, `pointer-events:none`, hidden under 768px. Make sure the intro paragraph stays readable on top of it; shift the motif down or right if they overlap.
  - **Closing CTA band** ("LET'S TALK!"): a faint copy (opacity .5) behind the right side.
  - Nowhere else.

## 5. Checks
- lint, typecheck, test:unit, the build plus `check:bundle` (site pages ≤ 330, `/app/clients/[clientId]` ≤ 300).
- **Update `e2e/portfolio.spec.ts`:**
  - "BRANDS" is static and there's no rotation;
  - 4 service cards, each with an svg;
  - no `[data-hover-img]` anywhere;
  - no intro photo strip;
  - the band has no thumbnails;
  - the signal motif is present on the 3 inner pages.
  
  Run the **whole file** once at the end.
- **Visual check at 1280 and 390:** the hero, the service cards (with lines drawn), the band, and each inner page intro. **Look at the screenshots** and fix issues.

## 6. Report (12 lines or fewer)
- the files changed;
- the checks with counts;
- the bundle sizes;
- deviations;
- anything undone.
