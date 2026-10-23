# HOK design system (staff app + client portal)

The public portfolio (`app/(site)`) is NOT covered here: it keeps the ported template's styles.

## Idea: an Apple-style studio workspace (redesign 2026-10-23)
Taken from the House of Khalak logo: crimson letterforms, ink lettering, now built the way Apple builds its apps: **clarity** (content first, few lines and boxes), **deference** (the chrome steps back), **depth only where it means something** (things that float: menus, sheets, the tab bar).
- **Warm, flat page; white grouped sections.** A section is a plain heading above a white group (`Panel`), the way iOS Settings groups rows. No icon badges, no heavy borders, no decorative shadows.
- **Ink is the colour of action**: main buttons (`<Button>` primary), the sidebar, the dashboard's hero band.
- **Crimson is the colour of attention and of "tappable"**: the selected nav item (its icon fills in red), links and "See all" / "Edit" in section headings, phone numbers and emails, overdue, unread. Default to neutral.
- **Colour for data**: charts and status use the semantic set (graphite, info blue, warning amber, success green).
- **The real logo only** (`components/shell/BrandMark.tsx`). Never invent a logo or a logo-like mark.
- **Light by default**, dark via `<html data-theme="dark">` (`ThemeToggle`). Every colour is a token; **never hardcode a colour** except `text-white/…` on the always-dark ink surfaces.

## Type
- Headings: **Jost** (`font-serif`, `.page-title` = the large title that opens a screen, no rule under it). Sentence case. No all-caps labels or letter-spaced eyebrows.
- Text: **Plus Jakarta Sans**, list rows at 15px (14px on wide screens for fields). Big numbers: `.figure` and `<CountUp>`.

## Icons
- `components/ui/Icon.tsx`: Phosphor's shapes, closest to SF Symbols. `filled` draws the selected form (current nav item, current tab).
- The shapes are generated into `components/ui/iconPaths.ts` by `scripts/build-icons.mjs` with only the weights we use (all six would break the 300 KB page budget). **To add an icon: add it to that script's list and run `node scripts/build-icons.mjs`.** Never import `@phosphor-icons/react` in app code (it's a devDependency for the generator).

## Building blocks (reuse, don't hand-roll)
| Need | Use |
|---|---|
| Page header | `<h1 className="page-title">` + one muted line; actions in `.page-actions` on the right. On a detail page, a tinted back link above the title ("‹ Clients") |
| Key numbers (one per page, optional) | `components/ui/HeroBand.tsx` |
| A section | `components/ui/Panel.tsx`: heading + optional note + right-side `action` / `footer` link ("See all", "Inbox") above a white group |
| Rows inside a group | `.inset-rows` on the list: hairlines that start at the text, iOS style. Label left (primary), value right (secondary). **Don't draw empty fields** (no "—" rows): leave the row out, or show one muted line ("No notes.") |
| Switching views of the same thing | `components/ui/Segmented.tsx` (sliding thumb; `manual` when choosing loads data) |
| Filters | In the page's filter row; wrap the secondary ones in `FilterToggle` so phones show a "Filters (n)" button instead of a stack of boxes |
| Fields | `Input` / `Select` / `Textarea` share `FIELD` (soft filled well, ring on focus); `PhoneInput` for every phone number; `TimeZoneInput` for zones |
| Dialogs | `Modal`: centred on desktop, a bottom **sheet** with a grabber on phones |
| Plain container | `Card` / `CardHeader` / `CardBody` |
| Empty list | `EmptyState` |
| Loading | `.skeleton` blocks shaped like the content; `Loader` for small inline waits |
| Pills | `StatusPill` (capsules; soft tints, solid only for urgent) |
| Pickers over growing data | `SearchSelect` |
| Lists | server-paged + `Pager`; debounced search; filters in the API |
| Destructive actions | at the end of the page, red text in its own group ("Archive client"); confirm before acting |

## Colour for meaning
- Priorities: low/medium `gray`, high `amber`, urgent `red`.
- Task status: todo `gray`, in progress `blue`, blocked `amber`, done `green`.
- Comment status: received `red` (needs a reply), in progress `blue`, solved `green`.
- Overdue text `text-error`; due today `text-warning-text`.

## Motion (only when it shows what changed)
- Answers to an action: buttons give way under the finger (`active:scale`), the segmented thumb slides, sheets rise from the bottom (`.sheet-in`), toasts, the theme's circular reveal.
- One page-load moment at most (`CountUp` figures, `grow-x` bars, `draw-stroke` charts). No fade-in on every card, no hover lift on lists.
- Ambient: only the slow crimson glow on the sign-in panel and inside the hero band.
- Everything respects `prefers-reduced-motion` (globals.css).

## Responsive (check every screen at 375, 768, 1024 and 1440, light and dark)
- Shell: below 1024px a **tab bar** at the bottom (`TabBar`: four main places + "More", which opens the full menu); 1024–1279 an icon rail; 1280+ the full sidebar. The top bar is translucent (`.material`).
- **Grids on phones: always `grid-cols-1` explicitly**; add `items-start` when sections of different heights sit side by side.
- Tables: a table from `sm`/`md`, cards on phones; or the table scrolls inside its group. The page itself never scrolls sideways.
- Tap targets ≥ 40px on phones; header actions stack (`.page-actions`).
- Anything whose text comes from the runtime's locale data (country names, `Intl` formatting) must render the same on the server and in the browser, or wait until the browser (see `PhoneInput`), or hydration breaks.
