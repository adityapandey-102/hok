import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Bot,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsRight,
  Circle,
  Clock,
  FileText,
  Mail,
  MapPin,
  Menu,
  MoveRight,
  Phone,
  Play,
  Quote,
  Search,
  Sparkles,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * The portfolio's icons. The HOK template shipped Font Awesome 6 Pro (a paid
 * licence); every `<i class="fa…">` was replaced with the matching Lucide icon,
 * the same free icon family the staff app uses (README "Portfolio" lists the
 * mapping). Only these icons are imported, so the rest of Lucide is
 * tree-shaken away.
 */
const ICONS = {
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  "arrow-up-right": ArrowUpRight,
  bot: Bot,
  "chart-column": ChartColumn,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  "chevrons-right": ChevronsRight,
  circle: Circle,
  clock: Clock,
  "file-text": FileText,
  mail: Mail,
  "map-pin": MapPin,
  menu: Menu,
  "move-right": MoveRight,
  phone: Phone,
  play: Play,
  quote: Quote,
  search: Search,
  sparkles: Sparkles,
  star: Star,
  x: X,
} satisfies Record<string, LucideIcon>;

export type SiteIconName = keyof typeof ICONS;

/**
 * Renders the icon inside an `<i>` that keeps the template's own classes
 * (`pra-clr`, `theme-clr`, `search-close`, …), so every template CSS rule and
 * jQuery selector written for the old `<i class="fa…">` still applies. The SVG
 * sits in a 1em box in `currentColor`, so it follows the `<i>`'s font-size
 * and colour exactly like the icon font did. The stroke is heavier than
 * Lucide's default so the icons match Font Awesome's solid weight (sizing in
 * /site/hok-site.css).
 */
export function SiteIcon({
  name,
  className,
  id,
  solid = false,
  light = false,
}: {
  name: SiteIconName;
  className?: string;
  id?: string;
  /** Filled shape, for icons the template used in their solid style (star, play, dot). */
  solid?: boolean;
  /** Thin stroke, for the few icons the template used in FA's "light" style (the header search). */
  light?: boolean;
}) {
  const Svg = ICONS[name];
  return (
    <i className={`hok-icon hok-icon--${name}${className ? ` ${className}` : ""}`} id={id} aria-hidden="true">
      <Svg size="1em" strokeWidth={light ? 1.75 : 2.5} fill={solid ? "currentColor" : "none"} focusable="false" />
    </i>
  );
}
