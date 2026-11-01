import Link from "next/link";
import { CountUp } from "./CountUp";
import { Icon, type IconName } from "./Icon";

export interface HeroCell {
  href: string;
  icon: IconName;
  label: string;
  value: number;
  caption: string;
  /** Crimson figure + dot: this number needs someone to act. */
  alert?: boolean;
}

/**
 * The page's numbers that matter most, on the ink hero band with its crimson
 * glow. Every cell opens its list. Phones: two columns (an odd last cell spans
 * both); tablets: three; desktop: one row.
 */
export function HeroBand({ cells, label }: { cells: HeroCell[]; label: string }) {
  const n = cells.length;
  // Full-width rows at every size: 5 cells on a tablet are 3 + 2 sharing six columns (no empty hole), 4 are 2 + 2.
  const columns =
    n === 5 ? "grid-cols-2 sm:grid-cols-6 lg:grid-cols-5" : n === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
  const span = (i: number) =>
    n === 5
      ? `${i === 4 ? "col-span-2" : ""} ${i < 3 ? "sm:col-span-2" : "sm:col-span-3"} lg:col-span-1`
      : n % 2 === 1 && i === n - 1
        ? "col-span-2 sm:col-span-1"
        : "";
  return (
    <section aria-label={label} className="hero-band">
      <div className={`stagger-in grid ${columns}`}>
        {cells.map((c, i) => (
          <Link
            key={c.label}
            href={c.href}
            className={`hero-cell group flex flex-col gap-3 px-5 py-5 outline-none focus-visible:bg-white/10 lg:px-6 lg:py-6 ${
              span(i)
            }`}
          >
            <span className="flex items-center gap-2 text-[12.5px] font-medium text-white/65">
              <span className="flex h-7 w-7 items-center justify-center rounded-app-sm bg-white/8 text-white/80 ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-110">
                <Icon name={c.icon} size={14} />
              </span>
              {c.label}
            </span>
            <span className={`figure text-[30px] leading-none lg:text-[34px] ${c.alert ? "text-alert-on-dark" : "text-white"}`}>
              <CountUp to={c.value} />
            </span>
            <span className="flex items-center gap-1.5 text-xs text-white/55">
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${c.alert ? "bg-alert-on-dark" : "bg-white/30"}`} />
              {c.caption}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
