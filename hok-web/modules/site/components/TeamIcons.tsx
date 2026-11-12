import type { ReactElement } from "react";

const A11Y = { "aria-hidden": true, focusable: "false" } as const;
const RED = { stroke: "#be1e28", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const WHITE = { stroke: "#fff", strokeOpacity: 0.85, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Six 40px line icons for the About team cards, in the same red-plus-white style as the service graphics. */
const ICONS: Record<string, ReactElement> = {
  strategy: (
    <svg viewBox="0 0 40 40" fill="none" {...A11Y}>
      <circle cx="20" cy="20" r="15" {...WHITE} />
      <circle cx="20" cy="20" r="8" {...WHITE} />
      <circle cx="20" cy="20" r="2.5" fill="#be1e28" />
      <path d="M20 20L32 8M28 8h4v4" {...RED} />
    </svg>
  ),
  social: (
    <svg viewBox="0 0 40 40" fill="none" {...A11Y}>
      <path d="M7 10h26a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H18l-7 6v-6H7a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z" {...WHITE} />
      <circle cx="14" cy="19" r="1.6" fill="#be1e28" />
      <circle cx="20" cy="19" r="1.6" fill="#be1e28" />
      <circle cx="26" cy="19" r="1.6" fill="#be1e28" />
    </svg>
  ),
  performance: (
    <svg viewBox="0 0 40 40" fill="none" {...A11Y}>
      <path d="M6 34V6M6 34h28" {...WHITE} />
      <path d="M11 27l7-8 5 4 10-13M28 10h5v5" {...RED} />
    </svg>
  ),
  writer: (
    <svg viewBox="0 0 40 40" fill="none" {...A11Y}>
      <path d="M8 6h18l6 6v22H8z" {...WHITE} />
      <path d="M13 17h14M13 23h14M13 29h8" {...WHITE} />
      <path d="M26 6v6h6" {...RED} />
    </svg>
  ),
  design: (
    <svg viewBox="0 0 40 40" fill="none" {...A11Y}>
      <rect x="5" y="9" width="30" height="22" rx="3" {...WHITE} />
      <path d="M17 15.5v9l8-4.5z" fill="#be1e28" stroke="#be1e28" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 35h22" {...RED} />
    </svg>
  ),
  build: (
    <svg viewBox="0 0 40 40" fill="none" {...A11Y}>
      <path d="M15 12L6 20l9 8M25 12l9 8-9 8" {...WHITE} />
      <path d="M22 8l-4 24" {...RED} />
    </svg>
  ),
};

export function TeamIcon({ name }: { name: string }) {
  return ICONS[name] ?? null;
}
