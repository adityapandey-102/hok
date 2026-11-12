# Portfolio site, design round 7 (designed by Opus, built by Sonnet)

Rounds 5–6 are built and uncommitted. The saved version is `b4f62e5`, which is also what's live. **User feedback (2026-11-12)**, all of which must be done:
1. The text marquee ("SOCIAL MEDIA MARKETING", "LET'S TALK!") **doesn't move on page load**. Fix it everywhere.
2. **Remove the founder info and photo from the home page.** On About, the founder photo **cuts off the head**: fix it.
3. **"What We Do"** on home and about must fit in **one screen at most**.
4. The **Services page** cards need a more interactive *design* (not cursor tricks).
5. **Contact page:**
   - the left side is too plain, so redesign it with graphics;
   - remove the "What do you need" and "Budget" chips from the form;
   - make the form look great;
   - add a good image.
6. **The modal doesn't open after 3 scrolls.** Make it open reliably.
7. **The header is too tall.**
8. **Hero:** show the full name **"House of Khalak"**, and add a **still (non-moving), good-looking graphic**, because it feels empty.
9. **Good professional images** on About, Services and Contact, matched to the services (not too many).
10. The **custom cursor** doesn't fit the theme. Redesign it.
11. **Nav:** remove "Home" (the logo links home); keep About, Services and Contact.
12. **About:** add a **Team section** with good copy.

## 0. Rules
- [site-content-1.md §0](site-content-1.md): no git writes, no new deps, don't start or kill servers (web on 3400), **Edit tool only, never sed**, keep line endings, build via `NEXT_DIST_DIR` with `tsconfig.json` restored.
- Progress file: `docs/specs/site-design-7-progress.md`. Scratch folder: `<scratchpad>/site-7/`.
- The design below is final. Use the SVG and copy exactly; you may adjust pill widths so the labels fit.
- **New images** (1600 px, ready) in `public/site/assets/img/stock/`:
  - `team-whiteboard.webp`
  - `svc-strategy.webp`
  - `svc-ai-dev.webp`
  - `svc-startup.webp`
  - `svc-creative.webp`
  - `contact-cafe.webp`
  - `studio-production.webp` (already used)
  
  All are Unsplash License; update the `STOCK` comment with the source IDs `CdTQI-Nh7J4, UtIr_UaiDmg, FjtWczJWRlc, aAZMEpZVgo4, VnhCfo8Fkes, iuOjmlOu88o, ycExgCMRggc`.

## 1. Bugs
- **Marquee:** find why the marquees don't move on first load (likely the velocity code sets `playbackRate` or pauses before the first scroll, or the animation starts paused under the preloader or `hok-first` class).
  - They must animate from first paint on every page, and `prefers-reduced-motion` alone stops them.
  - Add an e2e test: the marquee's transform changes within 2 s of load **without scrolling**.
- **Modal trigger:** **remove the 8-second dwell rule.**
  - Open as soon as `scrollY ≥ 3 × innerHeight` on desktop (≥992px) or `≥ 2 × innerHeight` below that, on any page except /contact. Once per browser session (`sessionStorage.hokModalShown`), and never after a submission.
  - Make it robust: check on `scroll` (passive, rAF-throttled) **and** once on load (in case the page restores scrolled down).
  - Add a `?modal=reset` query that clears both flags, for testing.
  - e2e: on a fresh context, scroll to 3.1 × viewport and the dialog is visible within 1.5 s.

## 2. Header (all pages)
- **Height 76px desktop, 64px phone.** The logo is 30px high. Nav font 15px.
- The header background is transparent at the top of the page; once scrolled more than 20px it becomes `rgba(13,13,13,.85)` with `backdrop-filter: blur(12px)` and a bottom hairline.
- **Nav:** About · Services · Contact (no Home). Then the "Get In Touch" primary button, compact (padding 12px 22px), which opens the modal (on /contact it scrolls to the form).

## 3. Cursor (redesign)
- **Default:** a single **10px solid red dot** (`#be1e28`) that follows instantly. No ring.
- **Over links and buttons:** the dot smoothly becomes a **44px circle with a 1.5px red border and a transparent fill** (lerp 0.2).
- **Over `[data-cursor="play"]`:** a **64px solid red circle with a white play triangle** (SVG, 18px). **No text labels** anywhere; remove the "Play", "View" and "Talk" text.
- Hidden over form fields (native text cursor), hidden in the modal, and off on touch and under reduced motion.

## 4. Home
**Order:** Hero → Logo strip → What We Do → Work (reels) → Process → Behind The Work band → Testimonials → LET'S TALK.

**Remove the founder block from home** (the photo, the text and the quote card). It stays on About.

### 4.1 Hero
- **Left column (7/12):**
  - Above the headline, a small line: a 32×2 red rule, then "**House of Khalak**" in white and "AI-powered marketing agency · Bengaluru" in muted text. Manrope 15px, sentence case, not a pill.
  - The headline: "AI-POWERED / MARKETING FOR **BRANDS**". It stays exactly as now, static, with the outline-fill.
  - The intro, the two buttons, and the "Trusted by 10+ brands…" line at the bottom stay as now.
- **Right column (5/12, desktop ≥992 only):** the **still graphic** below, **with no animation of any kind**, vertically centred, max-width 520px.
  - Put it in `modules/site/components/HeroOrbit.tsx` with `role="img"` and `aria-label="HOK services: social media, performance ads, content, AI automation and websites"`.
  - The cubes background stays behind everything, static and dimmed to 30% behind the graphic area.
```svg
<svg viewBox="0 0 560 520" fill="none">
  <defs>
    <pattern id="hx-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#fff" fill-opacity=".14"/></pattern>
    <radialGradient id="hx-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#be1e28" stop-opacity=".32"/><stop offset="1" stop-color="#be1e28" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="560" height="520" fill="url(#hx-dots)"/>
  <circle cx="280" cy="260" r="200" fill="url(#hx-glow)"/>
  <g stroke="#fff" stroke-opacity=".12"><circle cx="280" cy="260" r="90"/><circle cx="280" cy="260" r="160"/><circle cx="280" cy="260" r="230"/></g>
  <circle cx="280" cy="260" r="160" stroke="#be1e28" stroke-opacity=".8" stroke-width="1.5" stroke-dasharray="6 12"/>
  <g stroke="#be1e28" stroke-opacity=".5"><path d="M280 260L147 171"/><path d="M280 260L420 160"/><path d="M280 260L130 360"/><path d="M280 260L436 352"/><path d="M280 260L280 46"/></g>
  <circle cx="280" cy="260" r="56" fill="#be1e28"/>
  <text x="280" y="271" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="30" fill="#fff">HOK</text>
  <g font-family="Manrope, sans-serif" font-size="14" font-weight="600" fill="#fff">
    <rect x="91" y="155" width="112" height="32" rx="16" fill="#161616" stroke="#fff" stroke-opacity=".35"/><text x="147" y="176" text-anchor="middle">Social Media</text>
    <rect x="352" y="144" width="136" height="32" rx="16" fill="#161616" stroke="#fff" stroke-opacity=".35"/><text x="420" y="165" text-anchor="middle">Performance Ads</text>
    <rect x="84" y="344" width="92" height="32" rx="16" fill="#161616" stroke="#fff" stroke-opacity=".35"/><text x="130" y="365" text-anchor="middle">Content</text>
    <rect x="374" y="336" width="124" height="32" rx="16" fill="#be1e28"/><text x="436" y="357" text-anchor="middle">AI Automation</text>
    <rect x="233" y="30" width="94" height="32" rx="16" fill="#161616" stroke="#fff" stroke-opacity=".35"/><text x="280" y="51" text-anchor="middle">Websites</text>
  </g>
  <g fill="#fff"><circle cx="196" cy="114" r="3"/><circle cx="392" cy="420" r="3"/><circle cx="470" cy="250" r="3"/></g>
</svg>
```
- **Phone:** hide the graphic. Show the "House of Khalak" line above the headline.

### 4.2 What We Do (home and about): **fits one screen**
- A **single row of 4 compact cards** on desktop (≥1200; a 2×2 grid at 768–1199; a horizontal scroll-snap row on phones at 80% card width).
- Each card:
  - the round-6 graphic at **88px high**;
  - the title (h3, 20px);
  - the one-line description (2 lines max, 15px muted);
  - the items as a muted list joined with " · " (13px).
  
  Padding 24px. No tags here.
- The heading block is compact: the heading, then the intro line, then "All Services" right-aligned on the same baseline row.
- **Rule:** the whole section (heading plus cards) is ≤ 760px tall at 1280×800. Test this in e2e.
- Keep the line draw-in and the hover (lift, red border, top line).

### 4.3 Everything else on home
Unchanged from round 6.

## 5. About page
**Order:** intro (signal motif) → **founder block** → **Team** (new) → What We Do (compact, §4.2) → Process → Clients → LET'S TALK.
- **Founder photo fix:** the frame is aspect **4:5**, `object-fit: cover`, **`object-position: 50% 8%`** (the head must be fully visible with some space above). Max height `min(70vh, 600px)`. Verify in a screenshot that the top of the head scarf isn't cut.
- **Team section** ("The People Behind *The Work*"):
  - **Top row:** a wide image card, `team-whiteboard.webp`, 21:9, 14px radius, with clip-reveal and a bottom gradient caption: "Strategists, creators and builders, working as one team for every brand we take on."
  - **Then a grid of 6 role cards** (3 columns desktop, 2 tablet, 1 phone). Each card: a small line-icon graphic (a simple 40px SVG built from the round-6 style: red stroke plus white), the role title and 2 lines of copy. Same card style as the service cards (panel, border, hover lift). The copy is exactly:
    1. **Strategy & Account Leads**: "Your single point of contact. They plan the calendar, set the goals and keep every launch on time."
    2. **Social Media Managers**: "Run your channels day to day: content plans, posting, community replies and monthly reports."
    3. **Performance Marketers**: "Plan and optimise paid campaigns on Meta and Google so every rupee is tracked to results."
    4. **Content Writers**: "Hooks, captions, scripts and website copy written in your brand's voice."
    5. **Video Editors & Designers**: "Turn raw footage and ideas into reels, ads and visuals people stop scrolling for."
    6. **Developers & AI Builders**: "Build websites, landing pages and the automations that save your team hours every week."
  - Under the grid, one line with a ghost button: "Want to work with this team? Start a Project" (opens the modal).

## 6. Services page: interactive design (no cursor tricks)
**Layout: a sticky service index plus content panels.**
```
| [intro + signal motif]                                                          |
| ┌───────────────┐  ┌──────────────────────────────────────────────────────────┐ |
| │ 01 Digital…   │  │ [image 16:9, svc-strategy]                               │ |
| │ 02 App Dev…   │  │ Digital Marketing & Growth  (h2)                         │ |
| │ 03 Startup…   │  │ description                                              │ |
| │ 04 Creative…  │  │ [item card][item card]  ← each: graphic dot, title, blurb│ |
| │  (sticky)     │  │ [item card][item card]                                   │ |
| └───────────────┘  │ [Discuss this service →modal]                            │ |
|                    └──────────────────────────────────────────────────────────┘ |
```
- **Desktop ≥992:**
  - **Left (3/12):** a **sticky index** (`top: 100px`) listing the 4 groups as buttons with their numbers ("01"–"04"; a sequence, so numbers are fine).
    - The active group (scroll-spy via IntersectionObserver on the panels) shows a red 2px left bar, white text and a small progress bar under it showing how far through that panel you've scrolled. Inactive ones are muted.
    - Clicking one smooth-scrolls to its panel.
  - **Right (9/12):** the 4 **panels** stacked, 120px apart. Each panel:
    - a **16:9 image** (`svc-strategy`, `svc-ai-dev`, `svc-startup`, `svc-creative` in group order), 14px radius, with clip-reveal and a slight zoom on panel hover;
    - the round-6 graphic small (48px) beside the h2 title;
    - the description;
    - a **2-column grid of item cards**. Each card: the item title (white, 17px) and its blurb (muted). Hover: border red, `translateY(-4px)`, and a red dot before the title that scales up;
    - a primary button **"Discuss This Service"** that **opens the contact modal with the message pre-filled** "Hi HOK, I'd like to talk about {group title}." (pass it via the `hok:contact` event `detail`).
- **Phone:** no sticky index. Instead, a horizontal chip row at the top (the 4 groups) that scrolls to each panel; the panels stack.
- Then the LET'S TALK band.

## 7. Contact page (redesign)
**Layout:** two columns at desktop (5/12 left, 7/12 right). Phone: stacked, form first, then details.
- **Left, an "info panel"** (a panel card, radius 14px, overflow hidden):
  - **Top:** `contact-cafe.webp` as a 16:10 image with a dark bottom gradient. Over it, the text "Let's talk over coffee or a call." in white, h3.
  - **Below** (padding 32px), **3 channel rows**, each a full-width clickable row with a 44px round icon (a red outline circle with a white line icon: phone, mail, Instagram), a label (muted 13px) and a value (white 17px). Hover: background `rgba(255,255,255,.04)` and the icon fills red.
    - **Call or WhatsApp:** CONTACT.phone, `tel:`.
    - **Email:** CONTACT.email, `mailto:`.
    - **Instagram:** "@hok.co_", linking out.
  - **Then a small "Studio" block:** "Bengaluru, Karnataka, India" and "Mon–Sat, 10:00–19:00", muted, with a 1px top hairline.
  - **Bottom:** a faint `SignalMotif` (opacity .35) in the corner.
- **Right, the form card:**
  - A panel with radius 14px and padding 48px (28 on phone).
  - A subtle **gradient border**: a 1px border made with `background: linear-gradient(#161616,#161616) padding-box, linear-gradient(135deg, rgba(190,30,40,.7), rgba(255,255,255,.08) 40%) border-box; border:1px solid transparent`.
  - Heading "Tell Us About *Your Brand*", plus the line "Share a few details and we'll reply within one working day."
  - **Remove the "What do you need" and "Budget" chips** (in the modal too).
  - **Fields** (2-column where it says so):
    - Name | Email
    - Phone (optional) | Brand / company
    - Website or Instagram (optional, full width)
    - Message (full width, 5 rows)
  - **Field style (replaces the underline style):**
    - a filled box, background `#1f1f1f`, border `1px solid rgba(255,255,255,.08)`, radius 10px, height 56px (the textarea auto-sizes), padding 22px 16px 8px;
    - a **floating label** inside: 15px when empty, then 12px at the top on focus or when filled;
    - on focus, the border turns `--hk-red` with `box-shadow: 0 0 0 4px rgba(190,30,40,.15)`;
    - the error state uses a red border and the message below.
  - **The submit button is full width**, primary, 56px tall: "Send Message". Under it, the line "By sending this you agree to be contacted about your enquiry."
  - The success state is unchanged (the check animation, then the mailto fallback).
- **The modal uses the same form**, at a narrower width, with no info panel.

## 8. Images (fewer, better, in the right places)
- Use **only**:
  - the founder photo (About);
  - `team-whiteboard` (About Team);
  - the 4 `svc-*` images (Services panels);
  - `contact-cafe` (Contact);
  - `studio-production` (the home "Behind The Work" band);
  - the reel posters (home work);
  - the client logos.
- No other photos.
- Lazy-load everything below the fold, with width/height or aspect-ratio set.

## 9. Checks
- lint, typecheck, test:unit, the build plus `check:bundle` (site pages ≤ 330 KB, `/app/clients/[clientId]` ≤ 300).
- **e2e** (the **whole** `portfolio.spec.ts` file once at the end). New or updated tests:
  - the marquee moves without scrolling;
  - the modal opens at 3.1× scroll (desktop) and 2.1× (phone viewport), with no wait;
  - no founder block on home;
  - the "What We Do" section is ≤ 760px tall at 1280×800;
  - the nav has no "Home";
  - the header is ≤ 80px tall;
  - the hero contains "House of Khalak" and the orbit graphic (desktop);
  - the Team section has 6 role cards;
  - the services index scroll-spy marks the active group, and "Discuss This Service" opens the modal with the pre-filled message;
  - the contact form has no chip groups, and validation works;
  - the cursor has no text labels.
- **Visual check at 1280×800 and 390×844:**
  - the hero;
  - What We Do (fits);
  - the About founder (head not cut) and Team;
  - the Services index and panels;
  - Contact (both columns);
  - the modal.
  
  **Look at each screenshot** and fix the issues. List them in the progress file.

## 10. Report (12 lines or fewer)
- the files changed;
- the checks with counts;
- the bundle sizes;
- deviations;
- anything undone.
