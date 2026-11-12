import { CLIENT_LOGOS, logoSrc } from "../content";

/** Two loops' worth of logos per half, so one half is always wider than the screen. */
const HALF = [...CLIENT_LOGOS, ...CLIENT_LOGOS];

/** One logo on its uniform tile (168x96, white, contain-fit). */
export function LogoTile({ name, file, hidden = false }: { name: string; file: string; hidden?: boolean }) {
  return (
    <div className="hok-logo" aria-hidden={hidden ? true : undefined}>
      <img src={logoSrc(file)} alt={hidden ? "" : name} width={168} height={96} decoding="async" />
    </div>
  );
}

/**
 * The client logo strip: uniform tiles scrolling slowly and continuously,
 * paused on hover and faster while the page scrolls (SiteMotion). The track moves by exactly one half (each tile carries its
 * own right margin), so the loop is seamless; the second half is hidden from
 * screen readers.
 */
export function LogoMarquee() {
  return (
    <section className="hok-logos" aria-label="Brands we have worked with">
      <div className="container">
        <p className="hok-logos__caption">Brands we’ve worked with</p>
      </div>
      <div className="hok-logos__viewport" data-marquee="" data-marquee-hover="0">
        <div className="hok-logos__track">
          {[0, 1].map((half) =>
            HALF.map((logo, i) => <LogoTile key={`${half}-${i}`} name={logo.name} file={logo.file} hidden={half === 1} />),
          )}
        </div>
      </div>
    </section>
  );
}
