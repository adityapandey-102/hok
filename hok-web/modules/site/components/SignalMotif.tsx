/**
 * The brand motif: thin concentric rings plus a dot grid, suggesting reach and
 * growth. Decorative only (aria-hidden); the dashed red ring turns slowly (CSS;
 * static under reduced motion). `id` keeps the dot-pattern id unique when two
 * motifs share a page. Positioned by the parent (.hok-motif).
 */
export function SignalMotif({ id, className = "" }: { id: string; className?: string }) {
  return (
    <div className={`hok-motif ${className}`.trim()} aria-hidden="true" data-motif="">
      <svg viewBox="0 0 520 360" preserveAspectRatio="xMaxYMid slice" fill="none" focusable="false">
        <defs>
          <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="#fff" fillOpacity=".18" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="300" height="220" fill={`url(#${id})`} />
        <g stroke="#fff" strokeOpacity=".1">
          <circle cx="380" cy="230" r="60" />
          <circle cx="380" cy="230" r="110" />
          <circle cx="380" cy="230" r="160" />
          <circle cx="380" cy="230" r="210" />
        </g>
        <circle
          className="hk-ring"
          cx="380"
          cy="230"
          r="160"
          stroke="#be1e28"
          strokeOpacity=".75"
          strokeWidth="1.5"
          strokeDasharray="6 14"
        />
        <circle cx="380" cy="230" r="8" fill="#be1e28" />
        <circle cx="270" cy="148" r="4" fill="#fff" fillOpacity=".7" />
        <circle cx="486" cy="120" r="4" fill="#fff" fillOpacity=".7" />
      </svg>
    </div>
  );
}
