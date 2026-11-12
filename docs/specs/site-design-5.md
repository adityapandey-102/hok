# Portfolio site, design round 5: motion-rich, image-led, interactive (designed by Opus, built by Sonnet)

Saved version to return to: commit `b4f62e5`. **User feedback (2026-11-12):**
- "It looks text-based; less animation and images. I want a modern, animation-rich, motion-rich, premium, professional agency design."
- "Many components, like buttons, are pure text and don't look interactive."
- "The contact form isn't good: change it. The same form should open in a modal after 3 scrolls on desktop and 2 on mobile."

**Keep:** the dark-and-red palette, the fonts (Plus Jakarta Sans headings, Manrope body), the heading treatment (bold plus one red italic phrase, Title Case), the hero headline, all content in `content.ts`, and no decorative arrows.

## 0. Rules for the builder
- The [site-content-1.md §0](site-content-1.md) rules apply: no git writes, **no new npm deps**, don't start or kill servers (web on 3400), Edit tool not sed, keep line endings, build via `NEXT_DIST_DIR` with `tsconfig.json` restored.
- Progress file: `docs/specs/site-design-5-progress.md`. Scratch folder: `<scratchpad>/site-5/`.
- **This is a build-to-spec job. The design decisions below are final.** Don't redesign; implement them faithfully. If something can't work, write it in the progress file and take the closest option.
- All motion is transform and opacity only, uses one `requestAnimationFrame` loop, pauses off-screen, and is **fully disabled under `prefers-reduced-motion`** (content visible, static).
- Desktop-only effects (cursor, magnetic, parallax, hover image) run only when `matchMedia("(hover: hover) and (pointer: fine)")` matches.

## 1. Design tokens (add to `hok-site.css`, `:root`)
```css
--hk-red: #be1e28;         /* the template's --theme */
--hk-red-hover: #a41822;
--hk-ink: #0d0d0d;         /* page background, sections alternate with --bg2 #1b1b1b */
--hk-panel: #161616;
--hk-line: rgba(255,255,255,.12);
--hk-muted: #a9a9a9;
--hk-white: #ffffff;
--hk-radius: 14px;         /* media and cards (images, posters, tiles, form) */
--hk-ease: cubic-bezier(.7,0,.2,1);
--hk-ease-out: cubic-bezier(.22,.7,.2,1);
```
**Type scale:** h1 hero is unchanged. Section h2 `clamp(40px, 5.2vw, 72px)`, line-height 1.02, letter-spacing −0.02em. h3 `clamp(22px, 2vw, 30px)`. Body 17px/1.7 Manrope, muted for secondary text.

## 2. Interaction kit (`modules/site/components/motion/`; one client component plus CSS)
Create **`SiteMotion.tsx`** (a client component mounted once in `SitePage`). It sets up these behaviours with plain DOM and **no libraries**:

1. **Reveal** (an IntersectionObserver with threshold 0.15, once):
   - `[data-reveal="up"]`: from `opacity:0; translateY(40px)` to its normal state, over 900 ms `--hk-ease-out`.
   - `[data-reveal="mask"]` on headings: wrap each **line** (split on `<br>` / the `em` boundary, or words if simpler) in `span.hk-mask > span`. The inner span goes from `translateY(110%)` to `0`, staggered 90 ms.
   - `[data-reveal="clip"]` on media: from `clip-path: inset(0 0 100% 0)` to `inset(0)`, plus an inner `img` scale from 1.15 to 1, over 1200 ms `--hk-ease`.
   - The stagger comes from the `--i` CSS variable set on children.
   - Remove AOS attributes from everything you touch. AOS may stay loaded for untouched template pages.
2. **Parallax:** `[data-parallax="0.12"]` translates Y by `(elementCenter − viewportCenter) × factor` while on screen.
3. **Magnetic:** `[data-magnetic]` (buttons, the play circle) moves toward the pointer by up to 8 px within the element bounds and springs back on leave (lerp 0.15).
4. **Custom cursor** (desktop only):
   - a 8 px red dot (follows instantly) and a 40 px ring with `1px solid rgba(255,255,255,.5)` (lerp 0.18);
   - over `a, button, [data-cursor]` the ring grows to 64 px;
   - over `[data-cursor="play"]` it becomes an 88 px **solid red circle with the text "Play"**, and over `[data-cursor="view"]` it shows "View";
   - hidden when the pointer leaves the window. Keep the native cursor hidden **only** on the site (`html.hk-cursor-on`), never on form fields (show the text cursor there).
5. **Marquee velocity:** marquees (`.hk-marquee`) run on CSS animation. On scroll, the script raises `animation-duration` toward 40% of the base, scaled by scroll speed, and eases back (or uses `element.getAnimations()[0].playbackRate`).
6. **Hover image follow** (services rows, desktop): `[data-hover-img="/site/assets/img/work/x.webp"]` shows a 260×340 rounded image that follows the cursor with lerp 0.12, scales 0.8→1 and fades in. One shared element.

## 3. Buttons and links (replace the current button CSS)
```css
.hk-btn{position:relative;display:inline-flex;align-items:center;gap:10px;overflow:hidden;
  padding:18px 34px;font:600 15px/1 Manrope,sans-serif;letter-spacing:.2px;border-radius:0;
  isolation:isolate;transition:color .45s var(--hk-ease),border-color .45s var(--hk-ease)}
.hk-btn::before{content:"";position:absolute;inset:0;z-index:-1;transform:translateY(101%);
  transition:transform .45s var(--hk-ease)}
.hk-btn:hover::before,.hk-btn:focus-visible::before{transform:translateY(0)}
.hk-btn--primary{background:var(--hk-red);color:#fff}
.hk-btn--primary::before{background:#fff}
.hk-btn--primary:hover{color:var(--hk-red)}
.hk-btn--ghost{border:1px solid rgba(255,255,255,.35);color:#fff}
.hk-btn--ghost::before{background:var(--hk-red)}
.hk-btn--ghost:hover{border-color:var(--hk-red)}
.hk-btn .hk-btn__dot{width:6px;height:6px;border-radius:50%;background:currentColor;
  transition:transform .45s var(--hk-ease)}          /* small round marker, not an arrow */
.hk-btn:hover .hk-btn__dot{transform:scale(1.8)}
.hk-link{background:linear-gradient(currentColor,currentColor) 0 100%/0 1px no-repeat;
  transition:background-size .35s var(--hk-ease)}
.hk-link:hover{background-size:100% 1px}
:focus-visible{outline:2px solid var(--hk-red);outline-offset:3px}
```
- Every button gets `data-magnetic` and a `hk-btn__dot` before its label.
- **Every link** that's text (nav, footer, contact details, client names, "All Services") uses `.hk-link`.
- Nav: the active page shows a 2 px red dot under the item.

## 4. Home page

### 4.1 Hero: the reel wall (the signature moment)
```
| AI-POWERED                       |  [col A ↑] [col B ↓] [col C ↑]  |
| MARKETING FOR BRANDS             |  9:16 reel posters, 14px radius, |
| intro (2 lines)                  |  infinite vertical loops, each   |
| [Start a Project] [See Our Work] |  column a different speed        |
| — Trusted by 10+ brands…         |  (60s / 75s / 52s)               |
```
- Two columns (6/6, the left vertically centred). The right column is the **reel wall**: 3 vertical marquees of the 4 posters (`/site/assets/img/work/*.webp`) plus the Nida photo as a fifth tile, ordered differently per column.
- Each column holds its list twice for a seamless loop (CSS `@keyframes hk-wall-up {to{transform:translateY(-50%)}}`, with the middle column reversed).
- Gap 14px. The wall is rotated `-6deg` and scaled 1.08, clipped to the hero height, with a top and bottom fade (`mask-image: linear-gradient(transparent, #000 15%, #000 85%, transparent)`).
- Tiles get `data-cursor="play"` and link to their reel. Hovering a tile scales it to 1.04, and the column under the pointer **slows to 0.3×** (`playbackRate`).
- **Mouse parallax** on the whole wall: ±12px with lerp.
- Keep the background cubes visual, dimmed to 35% opacity, behind the left column only.
- **Load sequence:** the headline mask reveal (existing), then the intro and buttons fade up (stagger 120 ms), then the wall columns fade in from opacity 0 with a 40px rise (one column at a time, 150 ms apart). Total ≤ 1.6 s.
- **Phone:** the wall becomes a single **horizontal** strip of tiles (120×213) under the buttons, auto-scrolling left, with no rotation.

### 4.2 Logo strip
Keep the tiles (168×96, white, 10px radius, contain). Add: a hover lift `translateY(-4px)` plus shadow, and **velocity-linked speed** (§2.5). The caption becomes "Brands we've worked with", aligned with the container.

### 4.3 Founder block
- The image gets `data-reveal="clip"` and `data-parallax="0.08"` on its inner `img`.
- Overlap a **quote card** on the image's bottom-right corner, 40% outside the image: a `--hk-panel` background, a 3px red left border, padding 28px, max-width 360px. It holds the quote "Built by creators, for brands that want to grow." and the attribution "Nida Fathima, Founder". The card uses `data-reveal="up"` with a 300 ms delay.
- The heading uses `data-reveal="mask"`. The button is a ghost button.

### 4.4 Work ("Reels That *Get Noticed*"); move it directly **after the founder block**
- A 4-column grid on desktop with a **staggered offset**: cards 2 and 4 are pushed down 80px.
- Each card has its own `data-parallax`: 0.04 / 0.10 / 0.06 / 0.12, so they drift at different speeds as you scroll.
- Card: a 9:16 poster with the 14px radius, `data-reveal="clip"` and `data-cursor="play"`.
  - Hover: the image scales to 1.06, and a dark gradient rises from the bottom with the category (small muted text) and the client name (h3).
  - When not hovered, the client name sits below the card.
  - Click opens the reel (new tab). If `video` is set, it plays muted on hover.
- **Phone:** a horizontal swipe row (scroll-snap, 78% card width), with no offset.

### 4.5 Services ("What We *Do*"): interactive rows (no dropdowns, everything visible)
```
| Digital Marketing & Growth          Social Media · Performance · Lead Gen · SEO/GEO/AEO   (04) |
|─────────────────────────────────────────────────────────────────────────────────────────────|
| App Development & Agentic Platform  AI Automation · Websites & Landing Pages             (02) |
```
- 4 full-width rows separated by hairlines. Each row shows the title (h3, 30px) on the left; on the right, its items as **inline tags** (1px border, 999px radius, 8px 14px padding, 14px text), then the item count in muted text at the far right.
- **Hover (desktop):**
  - the row background fades to `rgba(190,30,40,.08)`;
  - the title shifts right 16px;
  - the tags' borders turn red;
  - the `data-hover-img` image follows the cursor (map each row to a poster or template service image).
- **Phone:** stacked; the tags wrap.
- Under the rows: the "All Services" ghost button.

### 4.6 Process ("How We *Work*")
Keep 5 columns.
- On reveal, the hairline **draws** left to right (`scaleX` 0→1, 1.2 s).
- The outlined numbers then fill red from the bottom, one after another: a `background-clip:text` gradient whose position animates from 0% to 100%, 150 ms apart.
- Hover over a step: its number fills red and its text turns white.

### 4.7 Testimonials (interactive)
- Under the big centred quote, show a **row of the client logos as buttons** (56px round white chips). The active one gets a 2px red ring and the others 50% opacity. Clicking a logo switches the quote.
- Switching animates the quote **word by word** (mask up, 25 ms stagger).
- Autoplay 7 s, with a thin red progress bar under the active logo showing the time left. It pauses on hover.

### 4.8 Closing CTA
- The "LET'S TALK!" marquee stays (velocity-linked).
- The **whole band is a button**: hovering slows the marquee to 0.3×, and the cursor shows "Talk" (`data-cursor="talk"`, same style as play).
- Clicking **opens the contact modal** (§6). It doesn't navigate.

## 5. Contact form (new design; one component used on /contact and in the modal)
`modules/site/components/ContactForm.tsx` (a client component).
- **Layout:**
  - Heading "Tell Us About *Your Brand*".
  - **Step chips:** "What do you need?" is a multi-select of chips: Social Media, Performance Ads, Content & Branding, Website, AI & Automation, Something else. A chip is 1px bordered with a 999px radius; selected chips are filled red with white text, and they animate with a scale 0.96→1 press.
  - **"Budget"** is a single-select of chips: Under ₹50k, ₹50k–₹1.5L, ₹1.5L+, Not sure yet.
  - Fields: Name, Email, Phone (optional), Brand / company, and a Message textarea.
- **Fields:** floating labels. The label sits inside the field and moves up and shrinks to 12px on focus or when filled. A bottom border of 1px `--hk-line` gets an animated red 2px underline that grows from the left on focus.
- **Validation** (on submit and on blur): name required, a valid email required, at least one "need" required, and the message at least 10 characters. Errors show in a small red line under the field, with `aria-invalid` and `aria-describedby`.
- **Submit:** a primary button "Send Message" that shows a spinner while sending. **There's no backend yet** (portfolio only, no platform changes), so:
  1. build the message text from the fields;
  2. show a **success state** in place of the form: a red check drawn with an SVG stroke animation, "Thanks, {name}. We'll reply within one working day.", and a secondary "Prefer email? Send it directly" link that opens `mailto:` (CONTACT.email) with the subject "New enquiry: {brand}" and the body pre-filled;
  3. set `sessionStorage.hokEnquirySent = "1"` so the modal never pops up again this session.
  
  Put a clear `// shortcut: no backend yet; wire to a real endpoint (email or HOK API) before launch` comment.
- **/contact page:** two columns.
  - **Left:** contact detail **cards**: Phone, Email and Instagram/LinkedIn as large clickable rows with a hover background, plus Address and Hours as plain rows. Each row: a small muted label and a large white value with `.hk-link`.
  - **Right:** the form on a `--hk-panel` card (radius 14px, padding 48px).

## 6. Scroll-triggered contact modal
`modules/site/components/ContactModal.tsx`, mounted in `SitePage`.
- **Trigger:** when `scrollY ≥ 3 × innerHeight` on desktop (`min-width: 992px`) or `≥ 2 × innerHeight` on smaller screens.
  - Show it **once per session** (`sessionStorage.hokModalShown`), only after the visitor has been on the page ≥ 8 s.
  - **Never** on `/contact`, never if `hokEnquirySent` is set, and never while another modal is open.
  - It can also be opened anywhere by `window.dispatchEvent(new Event("hok:contact"))` (the CTA band, the header "Get In Touch" button and the hero "Start a Project" button use this on every page except /contact, where they scroll to the form).
- **UI:**
  - **Desktop:** a centred panel, max-width 720px, `--hk-panel` background, 14px radius, with a backdrop of `rgba(0,0,0,.6)` plus `backdrop-filter: blur(6px)`. The panel rises 24px and fades in over 450 ms.
  - **Phone:** a bottom sheet (full width, max-height 90vh, scrollable, rounded top corners), sliding up.
  - A short line above the form: "Got a minute? Tell us what you're planning." A close ✕ button at the top-right (a 44px target).
- **Accessibility:** `role="dialog"`, `aria-modal`, `aria-labelledby`; focus moves into the modal and is trapped; Esc and a backdrop click close it; focus returns to the opener; the body scroll is locked; the custom cursor hides inside the modal.

## 7. Inner pages
- **Page intro:** keep the editorial two-column header. Add a `data-reveal="mask"` heading and, under the hairline, a **thin marquee of the 4 reel posters** (80px-tall tiles, horizontal, slow) as an image accent. On About and Services only; Contact has no marquee.
- **About:** the founder block (§4.3), process (§4.6), services rows (§4.5) and the clients logo strip. Then the closing CTA (§4.8).
- **Services:** the service rows in a **detailed** variant: each row also lists each item's one-line blurb under its tag (from `SERVICE_ITEMS`), always visible. Then the closing CTA.
- **Contact:** §5.

## 8. Footer
- Above the columns, add a **large statement link**: "hello@houseofkhalak.com" in a `clamp(32px, 5vw, 64px)` heading font, with `.hk-link` (the underline grows), `data-cursor="view"`, and a `mailto:`. Under it: "Instagram", "LinkedIn" as `.hk-link`.
- Keep the 4 columns (§ round 4) and the bottom bar. All links use `.hk-link`.

## 9. Checks
- lint, typecheck, test:unit, the build plus `check:bundle`.
  - **The site pages may grow; keep each site page ≤ 330 KB.** The staff pages must stay within budget. **Check `/app/clients/[clientId]` stays ≤ 300.**
- **Update `e2e/portfolio.spec.ts`:**
  - the hero reel wall has ≥ 3 columns with tiles;
  - the work cards link to the reels;
  - the service rows show all items without interaction;
  - the testimonial logo buttons switch the quote;
  - the contact form validates (an empty submit shows errors; a valid submit shows the success state);
  - the modal opens after scrolling 3× the viewport on 1280×800 (wait ≥ 8 s, or expose a test hook via `?modalDelay=0`), closes with Esc, and doesn't reopen after a reload in the same session;
  - the modal never opens on /contact;
  - `prefers-reduced-motion` (Playwright `reducedMotion: 'reduce'`) shows all content.
  
  Run it.
- **Visual check:** screenshots at 1280×800 and 390×844 of every home section, the open modal (desktop and phone) and the contact page. **Look at them**, and fix overlaps, clipped text, and anything that doesn't match this spec. Record what you checked in the progress file.

## 10. Report (15 lines or fewer)
- the files changed;
- the checks with counts;
- the bundle sizes (the site pages and `/app/clients/[clientId]`);
- deviations from the spec and why;
- anything undone.
