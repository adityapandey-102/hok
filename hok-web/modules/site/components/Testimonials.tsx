import { TESTIMONIALS, logoSrc } from "../content";
import { REVEAL } from "./SectionHead";
import { SiteSwiper } from "./SiteSwiper";

const OPTIONS = {
  slidesPerView: 1,
  speed: 700,
  effect: "fade",
  fadeEffect: { crossFade: true },
  rewind: true,
  autoplay: { delay: 7000, disableOnInteraction: false, pauseOnMouseEnter: true },
  pagination: { el: ".hok-testi-dots", clickable: true },
};

/** "Team Kirpa Properties" -> "KP": a monogram for clients without a logo file. */
function initials(name: string) {
  return name
    .replace(/^Team /, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Testimonials: a centred layout. The heading, then one large light quote
 * (fading from one to the next every 7 s, paused on hover), the client's round
 * logo chip, name and brand, and slider dots.
 */
export function Testimonials() {
  return (
    <section className="hok-section hok-testi">
      <div className="container">
        <div {...REVEAL}>
          <h2 className="hok-title hok-title--center">
            What Our <em>Clients Say</em>
          </h2>
          <SiteSwiper className="hok-testi-swiper" options={OPTIONS}>
            {TESTIMONIALS.map((t) => (
              <div className="swiper-slide" key={t.name}>
                <figure className="hok-quote">
                  <blockquote>{t.quote}</blockquote>
                  <figcaption>
                    <div className={`hok-chip${t.logo ? "" : " hok-chip--mono"}`}>
                      {t.logo ? <img src={logoSrc(t.logo)} alt={`${t.brand} logo`} loading="lazy" /> : <b aria-hidden="true">{initials(t.name)}</b>}
                    </div>
                    <div className="hok-quote__name">{t.name}</div>
                    <div className="hok-quote__brand">{t.role ?? t.brand}</div>
                  </figcaption>
                </figure>
              </div>
            ))}
          </SiteSwiper>
          <div className="hok-testi-dots" />
        </div>
      </div>
    </section>
  );
}
