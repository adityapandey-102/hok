/**
 * One cube: a group (`.hc-cube`) that moves only up and down. SiteMotion writes its
 * `transform: translateY(y)` every frame from one global clock, a wave offset by the
 * cube's x so the crest travels left to right (y = A sin(2 pi t / CUBE_PERIOD_S -
 * 2 pi x / 560), A is 14 px, 12 px for the big red cube). Nothing else moves a cube: no pointer
 * parallax, no sideways sway, no hover lift, no click hop. Extra props (stroke ...)
 * go on the group and are inherited by the paths.
 */
function Cube({ i, children, ...rest }: { i: number; children: React.ReactNode } & React.SVGProps<SVGGElement>) {
  return (
    <g className="hc-cube" data-amp={i === 0 ? 12 : 14} {...rest}>
      {children}
    </g>
  );
}

/**
 * The graphic in the home hero (right column on desktop, on top on phones and
 * tablets): nine 3D cubes in HOK red, dark grey and wire-frame, on a red glow,
 * echoing the cubes in the hero background. The only motion is the vertical
 * wave written by SiteMotion's animation loop (never stopped by hover,
 * paused only while the hero is off screen, resumed from the same clock). Under
 * reduced motion nothing moves. A plain server component: no script of its own.
 */
export function HeroCubes() {
  return (
    <div className="hok-cubes-wrap">
      <svg className="hok-cubes" viewBox="0 0 560 520" preserveAspectRatio="xMidYMid meet" fill="none" role="img" aria-label="Abstract 3D cubes in HOK red">
        <defs>
          <radialGradient id="hc-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#be1e28" stopOpacity=".45" />
            <stop offset="1" stopColor="#be1e28" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hc-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#000" stopOpacity=".6" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hc-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ef3a45" />
            <stop offset="1" stopColor="#c8202b" />
          </linearGradient>
        </defs>
        <circle cx="290" cy="250" r="230" fill="url(#hc-glow)" />
        <ellipse className="hc-shadow" cx="290" cy="380" rx="150" ry="26" fill="url(#hc-shadow)" />
        {/* large red cube */}
        <Cube i={0}>
          <path d="M290 140 L380 192 L290 244 L200 192 Z" fill="url(#hc-top)" />
          <path d="M200 192 L290 244 L290 348 L200 296 Z" fill="#be1e28" />
          <path d="M290 244 L380 192 L380 296 L290 348 Z" fill="#7d1118" />
          <path d="M200 192 L290 140 L380 192 M290 244 L290 348" stroke="#fff" strokeOpacity=".28" />
        </Cube>
        {/* dark cube left */}
        <Cube i={1}>
          <path d="M120 330 L164 355.4 L120 380.8 L76 355.4 Z" fill="#2c2c2c" />
          <path d="M76 355.4 L120 380.8 L120 431.6 L76 406.2 Z" fill="#1b1b1b" />
          <path d="M120 380.8 L164 355.4 L164 406.2 L120 431.6 Z" fill="#111" />
          <path d="M76 355.4 L120 330 L164 355.4" stroke="#fff" strokeOpacity=".18" />
        </Cube>
        {/* dark cube right */}
        <Cube i={2}>
          <path d="M450 360 L506 392.3 L450 424.6 L394 392.3 Z" fill="#2c2c2c" />
          <path d="M394 392.3 L450 424.6 L450 489.2 L394 456.9 Z" fill="#1b1b1b" />
          <path d="M450 424.6 L506 392.3 L506 456.9 L450 489.2 Z" fill="#111" />
          <path d="M394 392.3 L450 360 L506 392.3" stroke="#fff" strokeOpacity=".18" />
        </Cube>
        {/* wireframe cubes */}
        <Cube i={3} stroke="#fff" strokeOpacity=".35" strokeWidth="1.2">
          <path d="M440 60 L476 80.8 L440 101.6 L404 80.8 Z M404 80.8 L404 122.4 L440 143.2 L476 122.4 L476 80.8 M440 101.6 L440 143.2" />
        </Cube>
        <Cube i={4} stroke="#fff" strokeOpacity=".35" strokeWidth="1.2">
          <path d="M150 110 L180 127.3 L150 144.6 L120 127.3 Z M120 127.3 L120 161.9 L150 179.2 L180 161.9 L180 127.3 M150 144.6 L150 179.2" />
        </Cube>
        <Cube i={5} stroke="#be1e28" strokeOpacity=".7" strokeWidth="1.2">
          <path d="M500 210 L520 221.5 L500 233 L480 221.5 Z M480 221.5 L480 244.5 L500 256 L520 244.5 L520 221.5 M500 233 L500 256" />
        </Cube>
        {/* small solid red cube (top) */}
        <Cube i={6}>
          <path d="M200 40 L222 52.7 L200 65.4 L178 52.7 Z" fill="url(#hc-top)" />
          <path d="M178 52.7 L200 65.4 L200 90.8 L178 78.1 Z" fill="#be1e28" />
          <path d="M200 65.4 L222 52.7 L222 78.1 L200 90.8 Z" fill="#7d1118" />
        </Cube>
        {/* dark cube far left */}
        <Cube i={7}>
          <path d="M60 200 L90 217.3 L60 234.6 L30 217.3 Z" fill="#2c2c2c" />
          <path d="M30 217.3 L60 234.6 L60 269.2 L30 251.9 Z" fill="#1b1b1b" />
          <path d="M60 234.6 L90 217.3 L90 251.9 L60 269.2 Z" fill="#111" />
          <path d="M30 217.3 L60 200 L90 217.3" stroke="#fff" strokeOpacity=".18" />
        </Cube>
        {/* red wireframe cube bottom */}
        <Cube i={8} stroke="#be1e28" strokeOpacity=".75" strokeWidth="1.2">
          <path d="M330 450 L354 463.9 L330 477.8 L306 463.9 Z M306 463.9 L306 491.6 L330 505.5 L354 491.6 L354 463.9 M330 477.8 L330 505.5" />
        </Cube>
        <g fill="#fff" fillOpacity=".6">
          <circle cx="96" cy="236" r="2.5" />
          <circle cx="520" cy="320" r="2.5" />
          <circle cx="360" cy="70" r="2" />
        </g>
      </svg>
    </div>
  );
}
