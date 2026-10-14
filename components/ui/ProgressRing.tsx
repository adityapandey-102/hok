import type { CSSProperties } from "react";

const R = 34;
const LENGTH = 2 * Math.PI * R;

/**
 * A ring that draws itself to `percent` (0-100) when it appears, with the
 * figure in the middle. Pure SVG + CSS (.ring-fill), so it works in server
 * components and stops for people who prefer less motion. `onDark` for the
 * hero band.
 */
export function ProgressRing({
  percent,
  label,
  tone = "gold",
  size = 96,
  onDark = false,
}: {
  percent: number;
  /** Small word under the figure, e.g. "paid". */
  label: string;
  tone?: "gold" | "success";
  size?: number;
  onDark?: boolean;
}) {
  const p = Math.min(100, Math.max(0, percent));
  const style = { "--ring-length": LENGTH } as CSSProperties;
  // On the deep red, done reads in the brand gold too (no green on the band).
  const stroke = tone === "success" ? (onDark ? "var(--on-dark-success)" : "var(--color-success)") : "var(--color-gold-light)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${p}% ${label}`}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={R} fill="none" stroke={onDark ? "rgba(255,255,255,0.14)" : "var(--color-border-light)"} strokeWidth="7" />
        {p > 0 && (
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={LENGTH}
            strokeDashoffset={LENGTH * (1 - p / 100)}
            className="ring-fill"
            style={style}
          />
        )}
      </svg>
      <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`figure text-[19px] leading-none ${onDark ? "text-white" : "text-text-primary"}`}>{p}%</span>
        <span className={`mt-0.5 text-[10.5px] ${onDark ? "text-white/70" : "text-text-muted"}`}>{label}</span>
      </div>
    </div>
  );
}
