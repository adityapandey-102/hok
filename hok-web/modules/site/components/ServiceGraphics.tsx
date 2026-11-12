import type { ReactElement } from "react";

const A11Y = { "aria-hidden": true, focusable: "false" } as const;

/**
 * The four line graphics on the service cards, keyed by group title. Elements with
 * `hk-draw` have their strokes drawn once when the card enters view (SiteMotion).
 */
const GRAPHICS: Record<string, ReactElement> = {
  "Digital Marketing & Growth": (
    <svg viewBox="0 0 240 160" fill="none" {...A11Y}>
      <g stroke="#fff" strokeOpacity=".14">
        <path d="M20 140H220" />
        <path d="M20 110H220" />
        <path d="M20 80H220" />
        <path d="M20 50H220" />
      </g>
      <g fill="#fff" fillOpacity=".08">
        <rect x="34" y="104" width="18" height="36" rx="3" />
        <rect x="74" y="86" width="18" height="54" rx="3" />
        <rect x="114" y="92" width="18" height="48" rx="3" />
        <rect x="154" y="62" width="18" height="78" rx="3" />
        <rect x="194" y="40" width="18" height="100" rx="3" />
      </g>
      <path
        className="hk-draw"
        d="M43 100 L83 80 L123 88 L163 54 L203 30"
        stroke="#be1e28"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill="#be1e28">
        <circle cx="43" cy="100" r="4" />
        <circle cx="83" cy="80" r="4" />
        <circle cx="123" cy="88" r="4" />
        <circle cx="163" cy="54" r="4" />
        <circle cx="203" cy="30" r="5" />
      </g>
    </svg>
  ),
  "App Development & Agentic Platform": (
    <svg viewBox="0 0 240 160" fill="none" {...A11Y}>
      <circle cx="120" cy="80" r="62" stroke="#fff" strokeOpacity=".1" />
      <circle cx="120" cy="80" r="38" stroke="#fff" strokeOpacity=".18" strokeDasharray="3 5" />
      <g stroke="#be1e28" strokeWidth="1.6">
        <path className="hk-draw" d="M120 80 L62 48" />
        <path className="hk-draw" d="M120 80 L180 44" />
        <path className="hk-draw" d="M120 80 L66 122" />
        <path className="hk-draw" d="M120 80 L184 114" />
      </g>
      <g fill="#161616" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5">
        <circle cx="62" cy="48" r="9" />
        <circle cx="180" cy="44" r="9" />
        <circle cx="66" cy="122" r="9" />
        <circle cx="184" cy="114" r="9" />
      </g>
      <rect x="102" y="62" width="36" height="36" rx="9" fill="#be1e28" />
      <path d="M113 80h14M120 73v14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  "Startup Acceleration & Consulting": (
    <svg viewBox="0 0 240 160" fill="none" {...A11Y}>
      <path d="M20 140H220" stroke="#fff" strokeOpacity=".14" />
      <path d="M30 136 C 90 132, 140 100, 196 36" stroke="#fff" strokeOpacity=".22" strokeDasharray="2 6" strokeLinecap="round" />
      <path className="hk-draw" d="M30 136 C 90 132, 140 100, 196 36" stroke="#be1e28" strokeWidth="2.5" strokeLinecap="round" />
      <g fill="#fff" fillOpacity=".85">
        <circle cx="72" cy="131" r="3.5" />
        <circle cx="122" cy="110" r="3.5" />
        <circle cx="162" cy="78" r="3.5" />
      </g>
      <circle cx="196" cy="36" r="15" stroke="#be1e28" strokeWidth="2" />
      <circle cx="196" cy="36" r="6" fill="#be1e28" />
    </svg>
  ),
  "Creative & Visual Design": (
    <svg viewBox="0 0 240 160" fill="none" {...A11Y}>
      <g stroke="#fff" strokeOpacity=".08">
        <path d="M60 16V144M120 16V144M180 16V144M20 48H220M20 112H220" />
      </g>
      <circle cx="94" cy="86" r="40" fill="#be1e28" fillOpacity=".92" />
      <rect className="hk-draw" x="110" y="44" width="70" height="70" rx="6" stroke="#fff" strokeWidth="2" />
      <path d="M150 130 L182 74 L214 130 Z" fill="#fff" fillOpacity=".12" stroke="#fff" strokeOpacity=".5" />
    </svg>
  ),
};

export function ServiceGraphic({ group }: { group: string }) {
  return GRAPHICS[group] ?? null;
}
