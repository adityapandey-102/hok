import type { ReactElement } from "react";

const A11Y = { "aria-hidden": true, focusable: "false" } as const;
const RED = { stroke: "#be1e28", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const WHITE = { stroke: "#fff", strokeOpacity: 0.85, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Six 40 px line icons for "Why Brands Trust HOK", in the same red-plus-white style as the service graphics. */
const ICONS: Record<string, ReactElement> = {
  house: (
    <svg viewBox="0 0 40 40" fill="none" {...A11Y}>
      <path d="M6 18L20 6l14 12v16H6z" {...WHITE} />
      <path d="M16 34V24h8v10" {...RED} />
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 40 40" fill="none" {...A11Y}>
      <rect x="9" y="9" width="22" height="22" rx="4" {...WHITE} />
      <path d="M15 5v4M25 5v4M15 31v4M25 31v4M5 15h4M5 25h4M31 15h4M31 25h4" {...WHITE} />
      <path d="M20 14l1.8 4.2L26 20l-4.2 1.8L20 26l-1.8-4.2L14 20l4.2-1.8z" fill="#be1e28" stroke="#be1e28" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  ),
  industries: (
    <svg viewBox="0 0 40 40" fill="none" {...A11Y}>
      <rect x="5" y="7" width="12" height="12" rx="2" {...WHITE} />
      <rect x="23" y="7" width="12" height="12" rx="2" {...WHITE} />
      <rect x="5" y="23" width="12" height="12" rx="2" {...WHITE} />
      <rect x="23" y="23" width="12" height="12" rx="2" {...RED} />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 40 40" fill="none" {...A11Y}>
      <circle cx="20" cy="20" r="14" {...WHITE} />
      <path d="M6 20h28M20 6c-6 5-6 23 0 28M20 6c6 5 6 23 0 28" {...WHITE} />
      <circle cx="28" cy="12" r="3" fill="#be1e28" />
    </svg>
  ),
  lead: (
    <svg viewBox="0 0 40 40" fill="none" {...A11Y}>
      <circle cx="20" cy="14" r="6" {...WHITE} />
      <path d="M8 34c1-7 6-11 12-11s11 4 12 11" {...WHITE} />
      <path d="M30 8l2 2 4-4" {...RED} />
    </svg>
  ),
  results: (
    <svg viewBox="0 0 40 40" fill="none" {...A11Y}>
      <path d="M6 34V6M6 34h28" {...WHITE} />
      <path d="M12 28v-6M19 28V16M26 28v-9" {...WHITE} />
      <path d="M12 14l7-5 7 4 7-7" {...RED} />
    </svg>
  ),
};

export function TrustIcon({ name }: { name: string }) {
  return ICONS[name] ?? null;
}
