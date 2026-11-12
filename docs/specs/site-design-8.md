# Portfolio site, design round 8: mobile polish, a modern menu button, cube motion, modal rule

Round 7 is built (uncommitted); `b4f62e5` is live. **User feedback (2026-11-12):**
1. The mobile hamburger button: replace it with something modern and good-looking.
2. The cube bounce isn't in sync and looks like it stops. Also show the cubes on mobile.
3. The mobile hero is cluttered and overcrowded: make it clean and structured.
4. The enquiry modal "doesn't open after 3 scrolls" on home.
5. The intro graphics (the signal motif, top right on About, Services and Contact) are missing on mobile: include them, cleanly.

## 0. Rules
- [site-content-1.md §0](site-content-1.md): no git writes, no new deps, don't start or kill servers (web on 3400), **Edit tool only**, keep line endings, build via `NEXT_DIST_DIR` with `tsconfig.json` restored.
- Progress file: `docs/specs/site-design-8-progress.md`. Scratch folder: `<scratchpad>/site-8/`. The design below is final.

## 1. Mobile menu button (<992px)
- Replace the 3-line hamburger with a **44×44 round button**:
  - background `rgba(255,255,255,.06)`, border `1px solid rgba(255,255,255,.14)`, `backdrop-filter: blur(8px)`;
  - inside, **two lines**: the top one 18px wide and the bottom one 12px wide, right-aligned, 2px thick, white, 6px apart, `border-radius: 2px`.
- On hover or focus, the bottom line grows to 18px.
- **Open state:** the button morphs. The two lines rotate to form a ✕ (both 18px, ±45°, 300ms `--hk-ease`), and the background turns `--hk-red` with no border. The same button closes the menu, so the overlay's separate ✕ can be removed; this button sits above the overlay.
- `aria-label` toggles between "Open menu" and "Close menu". `aria-expanded`.
- **Menu overlay:** keep the round-7 one. Links stagger in on open (opacity and translateY 16px, 60ms stagger).

## 2. Cube motion: smooth and in sync (desktop and mobile)
- **One shared period for every cube: 2.6 s**, `animation-timing-function: cubic-bezier(.45,0,.55,1)` (sine-like), infinite.
- **Alternate by phase, not by direction plus duration:**
  - all cubes use the same keyframes `0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)}`;
  - **even cubes get `animation-delay: -1.3s`** (half a period), so odd cubes go up while even cubes go down, perfectly in sync and never stopping;
  - the big red cube uses the same period with an amplitude of −10px and no delay.
- The shadow scales in sync with the big cube (same period).
- **Remove the pause-on-hover.** On hover, a cube still lifts or glows through an extra `translate` on a wrapper, but its bob keeps running underneath. The hop on click also runs on the wrapper, so the bob never resets.
- Parallax stays on the outer wrapper's `translate` (desktop only).
- Reduced motion: static.

## 3. Mobile hero: clean and structured (<768px)
Order and spacing (gutters 20px):
1. **The cubes graphic on top:** the same `HeroCubes` SVG at full width, **180px tall** (`preserveAspectRatio="xMidYMid meet"`), centred, with the bob animation on and no parallax. A tap hops a cube. Then **20px**.
2. **Brand line, one line only:** the red rule, then "House of Khalak", then " · AI marketing agency" (muted). **Remove** the long tagline ("Bengaluru · Serving India, the GCC…") from the mobile hero; the markets band right below carries it. Then **16px**.
3. **H1** `clamp(36px, 10vw, 46px)`, 3 lines: "AI-POWERED / MARKETING FOR / BRANDS". "BRANDS" has a clean single outline-fill. Then **16px**.
4. **The intro**, 16px, max 3 lines. Then **24px**.
5. **Buttons:** primary "Start a Project" at full width, 52px tall; the secondary as a **text link** "See our work" centred under it, 15px, with the `.hok-link` underline (not a second big boxed button). Then **28px**.
6. **Proof row:** 3 columns, values 20px and labels 12px. The labels are shortened to "brands", "industries", "markets". Hairline dividers. No hairline above (the spacing does it).

Rules:
- The total mobile hero height is ≤ 1.1 × the viewport at 390×844.
- No element touches another. Everything is left-aligned except the cube graphic and the "See our work" link, which are centred.
- On tablets (768–991), use the same stack but cubes 240px tall and the buttons side by side.

## 4. Enquiry modal: show rule
- Change from once per **session** to **once per page load**:
  - drop the `sessionStorage.hokModalShown` check, and keep an in-memory flag per page load instead;
  - it still **never** shows after an enquiry is sent (`sessionStorage.hokEnquirySent`), never on /contact, and never while the mobile menu is open;
  - the trigger is still `scrollY ≥ 3×innerHeight` on desktop and `2×` on mobile, checked on scroll **and** on load.
- After the visitor closes it, don't show it again on that page load.
- Keep `?modal=reset` (it now clears only `hokEnquirySent`).
- **e2e:** scroll with `mouse.wheel` (not `scrollTo`) on 1280 and 390. The modal opens. Reload, scroll again, and it opens again. After a successful send, it never opens.

## 5. Signal motif on mobile (About, Services, Contact intros)
- Under 768px, **show the motif** below the intro text block, inside the intro: full width, **160px tall** (`preserveAspectRatio="xMaxYMid slice"`, so the rings sit right), opacity .9, 8px top margin, then the hairline.
- Keep the slow ring rotation (reduced motion: static).
- It must not overlap any text.
- 768–991: the same treatment at 200px tall.

## 6. Checks
- lint, typecheck, test:unit, the build plus `check:bundle` (site pages ≤ 330, `/app/clients/[clientId]` ≤ 300).
- **e2e (the whole `portfolio.spec.ts` file once at the end).** Add or update:
  - the menu button toggles `aria-expanded` and gets the open state, and the overlay's ✕ is gone;
  - the cubes are visible at 390;
  - all `.hc-cube` share the same animation-duration (2.6s);
  - the mobile hero height is ≤ 1.1×vh at 390;
  - the mobile hero has no long tagline;
  - the motif is visible at 390 on the 3 inner pages;
  - the modal rule, as in §4.
- **Visual check:**
  - at 390×844 and 360×740: the header (closed and open), the hero, and the About, Services and Contact intros;
  - at 1280: the hero (cubes in sync).
  
  Look at each screenshot and fix the issues. Log them in the progress file.

## 7. Report (10 lines or fewer)
- the files changed;
- the checks with counts;
- the bundle sizes;
- deviations;
- anything undone.
