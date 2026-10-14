import {
  Ban,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  Check,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Clock,
  Cog,
  Columns3,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Factory,
  FileText,
  Hammer,
  Hand,
  History,
  Hourglass,
  House,
  Flame,
  Image as ImageIcon,
  Inbox,
  IndianRupee,
  KeyRound,
  Layers,
  Lock,
  List,
  Menu,
  MessageSquare,
  Package,
  Palette,
  PenLine,
  Phone,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Ruler,
  Scissors,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Spool,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * The app's icon set: Lucide (a professional, consistent line-icon family,
 * one 24x24 stroke grid). Only the icons listed here are bundled -- each is a
 * named import, so the rest of Lucide is tree-shaken away.
 *
 * Icons render in `currentColor`, so they take the colour of the text around
 * them. Many call sites still pass an emoji string (CardHeader, the sidebar
 * nav, stat cards); `Icon` maps those to the matching Lucide icon via
 * EMOJI_MAP, and an unmapped emoji falls back to rendering itself.
 */
const ICONS = {
  package: Package,
  calendar: CalendarDays,
  "calendar-clock": CalendarClock,
  hammer: Hammer,
  needle: Spool,
  check: Check,
  "check-circle": CircleCheck,
  clock: Clock,
  hourglass: Hourglass,
  alert: TriangleAlert,
  card: CreditCard,
  wallet: Wallet,
  rupee: IndianRupee,
  cart: ShoppingBag,
  "bar-chart": ChartColumn,
  "trending-up": TrendingUp,
  users: Users,
  user: UserRound,
  shield: ShieldCheck,
  receipt: Receipt,
  briefcase: BriefcaseBusiness,
  search: Search,
  image: ImageIcon,
  wrench: Wrench,
  edit: PenLine,
  palette: Palette,
  shirt: Shirt,
  factory: Factory,
  qr: QrCode,
  clipboard: ClipboardList,
  list: List,
  layers: Layers,
  sparkles: Sparkles,
  printer: Printer,
  columns: Columns3,
  settings: Settings,
  cog: Cog,
  hand: Hand,
  home: House,
  download: Download,
  "chevron-right": ChevronRight,
  history: History,
  key: KeyRound,
  lock: Lock,
  refresh: RefreshCw,
  ban: Ban,
  eye: Eye,
  "eye-off": EyeOff,
  x: X,
  scissors: Scissors,
  menu: Menu,
  plus: Plus,
  phone: Phone,
  file: FileText,
  ruler: Ruler,
  inbox: Inbox,
  message: MessageSquare,
  "user-plus": UserPlus,
  flame: Flame,
  send: Send,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Emoji still used at a few call sites -> its Lucide replacement. */
const EMOJI_MAP: Record<string, IconName> = {
  "📦": "package",
  "📅": "calendar",
  "🗓": "calendar",
  "🔨": "hammer",
  "🧵": "needle",
  "✅": "check-circle",
  "⏰": "clock",
  "🕓": "history",
  "⚠": "alert",
  "💳": "card",
  "💰": "wallet",
  "🛒": "cart",
  "📊": "bar-chart",
  "📈": "trending-up",
  "👥": "users",
  "👤": "user",
  "🛡": "shield",
  "🧾": "receipt",
  "🧑‍💼": "briefcase",
  "🔎": "search",
  "🖼": "image",
  "🔧": "wrench",
  "🛠": "wrench",
  "📝": "edit",
  "👩‍🎨": "palette",
  "👗": "shirt",
  "🏭": "factory",
  "📱": "qr",
  "📌": "clipboard",
  "📋": "list",
  "✦": "sparkles",
  "🏷": "printer",
  "🖨": "printer",
  "🗂": "columns",
  "⚙": "cog",
  "✋": "hand",
  "⬇": "download",
  "›": "chevron-right",
  "🎨": "palette",
  "✂": "scissors",
};

export function Icon({
  name,
  emoji,
  size = 20,
  className = "",
  strokeWidth = 1.75,
}: {
  name?: IconName;
  /** A string to resolve to an icon: either an icon name (e.g. "bar-chart") or an emoji (e.g. "📊"). Falls back to the emoji itself if unmapped. */
  emoji?: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  // Try the string as an icon name first, then as an emoji (dropping the VS16
  // variation selector so "⚠️" matches "⚠", etc.).
  const resolved: IconName | undefined =
    name ?? (emoji ? (emoji in ICONS ? (emoji as IconName) : EMOJI_MAP[emoji.replace(/️/g, "")]) : undefined);

  if (!resolved) {
    return emoji ? <span className={className}>{emoji}</span> : null;
  }

  const Component = ICONS[resolved];
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth={false}
      className={`inline-block shrink-0 ${className}`}
      aria-hidden="true"
    />
  );
}
