import { FounderBlock } from "@/modules/site/components/FounderBlock";
import { LetsTalk } from "@/modules/site/components/LetsTalk";
import { LogoMarquee } from "@/modules/site/components/LogoMarquee";
import { Marquee } from "@/modules/site/components/Marquee";
import { ProcessTimeline } from "@/modules/site/components/ProcessTimeline";
import { REVEAL, SectionHead } from "@/modules/site/components/SectionHead";
import { ServiceGroups } from "@/modules/site/components/ServiceGroups";
import { SiteIcon } from "@/modules/site/components/SiteIcon";
import { SitePage } from "@/modules/site/components/SitePage";
import { SiteSwiper } from "@/modules/site/components/SiteSwiper";
import { Testimonials } from "@/modules/site/components/Testimonials";
import { WorkCard } from "@/modules/site/components/WorkCard";
import { ABOUT_SHORT, HERO, SECTION_INTROS, WORK } from "@/modules/site/content";

/** A phone swipes 1.2 reels; from tablet width all four sit in a row. */
const WORK_OPTIONS = {
  slidesPerView: 1.2,
  spaceBetween: 16,
  grabCursor: true,
  watchOverflow: true,
  navigation: { nextEl: ".hok-work-next", prevEl: ".hok-work-prev" },
  breakpoints: {
    576: { slidesPerView: 2.2, spaceBetween: 20 },
    992: { slidesPerView: 4, spaceBetween: 24 },
  },
};

const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as React.CSSProperties;

/**
 * The home page of the HOK portfolio: hero, client logo strip, About HOK, how
 * we work, what we do, the reels, testimonials and the closing "Let's talk".
 * Quiet and confident: hairlines, space and type, no decorative arrows or
 * pills. All text comes from modules/site/content.ts.
 */
export default function HomePage() {
  return (
    <SitePage variant="home">
      <main className="main position-relative overflow-hidden" id="mains">
        {/* Hero: the template's background and headline, one masked reveal on load */}
        <section className="hero-section-version1 hok-hero position-relative">
          <div className="container hok-hero__main">
            <div className="hero-v1-content position-relative">
              <h1 className="white-clr text-uppercase">
                <span className="d-block hok-mask">
                  <span className="d-block hok-rise" style={delay(0.15)}>
                    {HERO.line1}
                  </span>
                </span>{" "}
                <span className="d-block hok-mask">
                  <span className="d-block hok-rise" style={delay(0.35)}>
                    <span className="text-italic">{HERO.line2Italic}</span>{" "}
                    <span className="designers" data-text={HERO.line2Outline}>
                      {HERO.line2Outline}
                    </span>
                  </span>
                </span>
              </h1>
              <p className="hero-intro white-clr hok-fade" style={delay(0.75)}>
                {HERO.intro}
              </p>
              <div className="hok-actions hok-fade" style={delay(0.9)}>
                <a href="/contact" className="hok-btn hok-btn--primary">
                  Start a Project
                </a>
                <a href="#work" className="hok-btn hok-btn--ghost">
                  See Our Work
                </a>
              </div>
            </div>
          </div>
          <div className="container">
            <p className="hok-trust hok-fade" style={delay(1.1)}>
              {HERO.trust}
            </p>
          </div>
        </section>

        <LogoMarquee />

        {/* About HOK: the founder */}
        <section className="hok-section">
          <div className="container">
            <FounderBlock paragraphs={ABOUT_SHORT}>
              <div className="hok-founder__action">
                <a href="/about" className="hok-btn hok-btn--ghost">
                  About HOK
                </a>
              </div>
            </FounderBlock>
          </div>
        </section>

        {/* How we work */}
        <section className="hok-section">
          <div className="container">
            <SectionHead title="How We" em="Work" text={SECTION_INTROS.process} />
            <ProcessTimeline />
          </div>
        </section>

        {/* What we do: four open panels */}
        <section className="hok-section">
          <div className="container">
            <SectionHead title="What We" em="Do" text={SECTION_INTROS.services} action={{ href: "/services", label: "All Services" }} />
            <ServiceGroups layout="grid" />
          </div>
        </section>

        {/* Work: the text slider, then the four reels */}
        <section className="hok-section" id="work">
          <Marquee text="SOCIAL MEDIA MARKETING" className="testi-italic hok-work-marquee" count={4} />
          <div className="container hok-work-wrap">
            <SectionHead title="Reels That" em="Get Noticed" text={SECTION_INTROS.work} />
            <div {...REVEAL}>
              <SiteSwiper className="hok-work-swiper" options={WORK_OPTIONS}>
                {WORK.map((item) => (
                  <div className="swiper-slide" key={item.reelId}>
                    <WorkCard item={item} />
                  </div>
                ))}
              </SiteSwiper>
              <div className="hok-arrows d-lg-none">
                <button className="hok-work-prev" type="button" aria-label="Previous reel">
                  <SiteIcon name="chevron-left" />
                </button>{" "}
                <button className="hok-work-next" type="button" aria-label="Next reel">
                  <SiteIcon name="chevron-right" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <Testimonials />

        {/* Closing call to action */}
        <LetsTalk />
      </main>
    </SitePage>
  );
}
