# HOK design system (staff app + client portal)

The public portfolio (`app/(site)`) is NOT covered here: it keeps the ported template's styles.

## Idea: a modern, premium studio workspace
Taken from the House of Khalak logo: crimson letterforms, ink lettering. Warm porcelain paper (not cold grey), white panels with soft warm shadows, an ink sidebar, and one ink "hero band" with a crimson glow per page for the numbers that matter.
- **Ink is the colour of action**: main buttons (`<Button>` primary = `bg-ink text-on-ink`), the sidebar, the hero band.
- **Crimson is the colour of attention**: the active nav item, the current stage, overdue, unread, "needs a reply". Default to neutral; red only where the user should look.
- **Colour for data**: charts and status use the semantic set (graphite, info blue, warning amber, success green) so pages aren't monochrome.
- **The real logo only** (`components/shell/BrandMark.tsx`: `BrandLogo`, `BrandMark`, `BrandLockup`, from `public/brand/*.png`). Never invent a logo or a logo-like mark.
- **Light by default**, dark via `<html data-theme="dark">` (`ThemeToggle`). Tailwind's `dark:` variant follows it. Every colour is a token; **never hardcode a colour** except `text-white/…` on the always-dark ink surfaces (sidebar, sign-in panel, hero band) and the `*-on-dark` tokens there.

## Type
- Headings: **Jost** (`font-serif` class, historical name; `.page-title` for the h1). Sentence case. No all-caps labels or letter-spaced eyebrows.
- Text and numbers: **Plus Jakarta Sans**. Big numbers: `.figure` (tabular) and `<CountUp>`.

## Building blocks (reuse, don't hand-roll)
| Need | Use |
|---|---|
| Page header | `<h1 className="page-title">` + one muted line; actions in `.page-actions` on the right |
| Key numbers (one per page, optional) | `components/ui/HeroBand.tsx` (cells link to their lists, `alert` turns a figure crimson) |
| A section with a header and a "View all" footer | `components/ui/Panel.tsx` |
| Plain container | `Card` / `CardHeader` / `CardBody` |
| Empty list | `EmptyState` (pick a fitting `icon`) |
| Loading | `.skeleton` blocks shaped like the content; `Loader` for small inline waits |
| Pills | `StatusPill` (soft tints; solid only for urgent) |
| Pickers over growing data | `SearchSelect` |
| Lists | server-paged + `Pager`; debounced search; filters in the API |
| Stage progress | `StageRail` (via `StageTracker` / `PortalStageTrack`) |

## Colour for meaning
- Priorities: low/medium `gray`, high `amber`, urgent `red`.
- Task status: todo `gray`, in progress `blue`, blocked `amber`, done `green`.
- Comment status: received `red` (needs a reply), in progress `blue`, solved `green`.
- Overdue text `text-error`; due today `text-warning-text`.

## Motion (smooth, never showy)
- One page-load moment per screen (`.stagger-in` on the first row of cards, `CountUp` figures, `grow-x` bars, `draw-stroke` charts).
- Motion that answers an action: modal `animate-scale-in`, toasts, the theme's circular reveal, hover `lift` on clickable cards only.
- Ambient: only the slow crimson glow (`.ambient-glow`) on the sign-in panel and inside the hero band.
- Everything respects `prefers-reduced-motion` (globals.css).

## Responsive (check every screen at 375, 768, 1024 and 1440, light and dark)
- Shell: phones and portrait tablets use the drawer (menu button); 1024–1279 an icon rail; 1280+ the full sidebar.
- **Grids on phones: always `grid-cols-1` explicitly** (e.g. `grid grid-cols-1 gap-5 lg:grid-cols-12`). A bare `grid` sizes its column to the longest unbreakable/truncated text and overflows the page.
- Tables: a table from `sm`/`md`, cards on phones; or the table scrolls inside its panel. The page itself never scrolls sideways.
- Filter bars: stack on phones (`flex-col sm:flex-row`), controls `sm:w-auto` (Select/Input are full width by default).
- Tap targets ≥ 40px on phones; header actions stack (`.page-actions`).
