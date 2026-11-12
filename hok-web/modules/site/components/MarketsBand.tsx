import { MARKETS_BAND } from "../content";

const ICON = { fill: "none", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" } as const;

/** A thin red-outline round icon per badge. */
const ICONS: Record<string, React.ReactNode> = {
  India: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  ),
  GCC: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <path d="M4 20h16M6 20V10l6-5 6 5v10M10 20v-5h4v5" />
    </svg>
  ),
  International: (
    <svg viewBox="0 0 24 24" {...ICON}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c-3 3-3 13 0 16M12 4c3 3 3 13 0 16" />
    </svg>
  ),
};

/**
 * The slim markets band on Home, right after the logo strip: one sentence on
 * the left (India, the GCC and international markets, remote-first) and three
 * small static badges on the right. No motion. On a phone the two stack.
 */
export function MarketsBand() {
  return (
    <section className="hok-markets" aria-label="Where we work">
      <div className="container hok-markets__in">
        <p className="hok-markets__text">
          We work with brands across <strong>India, the GCC</strong> ({MARKETS_BAND.gcc}) <strong>and international markets</strong>,
          remote-first, on your time zone.
        </p>
        <ul className="hok-markets__badges">
          {MARKETS_BAND.badges.map((badge) => (
            <li key={badge} className="hok-markets__badge">
              <span className="hok-markets__icon">{ICONS[badge]}</span>
              {badge}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
