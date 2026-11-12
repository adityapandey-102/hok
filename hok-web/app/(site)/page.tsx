import { Btn } from "@/modules/site/components/Btn";
import { HeroCubes } from "@/modules/site/components/HeroCubes";
import { HeroProof } from "@/modules/site/components/HeroProof";
import { LetsTalk } from "@/modules/site/components/LetsTalk";
import { LogoMarquee } from "@/modules/site/components/LogoMarquee";
import { Marquee } from "@/modules/site/components/Marquee";
import { MarketsBand } from "@/modules/site/components/MarketsBand";
import { ProcessTimeline } from "@/modules/site/components/ProcessTimeline";
import { MaskText, SectionHead } from "@/modules/site/components/SectionHead";
import { ServiceGroups } from "@/modules/site/components/ServiceGroups";
import { SitePage } from "@/modules/site/components/SitePage";
import { Testimonials } from "@/modules/site/components/Testimonials";
import { TrustSection } from "@/modules/site/components/TrustSection";
import { WorkCard } from "@/modules/site/components/WorkCard";
import { HERO, SECTION_INTROS, STOCK, WORK } from "@/modules/site/content";

const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as React.CSSProperties;
const step = (i: number) => ({ "--i": i }) as React.CSSProperties;

/**
 * The home page of the HOK portfolio: hero (the full name, the headline and a
 * still service graphic), client logo strip, what we do (one row of compact
 * cards), the reels, how we work, the "behind the work" photo band, testimonials
 * and the closing "Let's talk". Motion-rich but quiet: reveals, parallax, a red-dot
 * cursor (modules/site/components/motion). No founder block here (it is on About).
 * No decorative arrows. All text comes from modules/site/content.ts.
 */
export default function HomePage() {
  return (
    <SitePage variant="home">
      <main className="main position-relative overflow-hidden" id="mains">
        {/* Hero: the template's static background, a red cursor spotlight, the headline with the outlined word */}
        <section className="hero-section-version1 hok-hero position-relative" data-hero="">
          <div className="hok-hero__bg" aria-hidden="true" />
          <div className="hok-hero__spot" data-hero-spot="" aria-hidden="true" />
          <div className="container hok-hero__main">
            <div className="hero-v1-content position-relative">
              <p className="hok-hero__name hok-fade" style={delay(0.05)}>
                <span className="hok-hero__mark" aria-hidden="true" />
                <strong>{HERO.name}</strong>
                <span className="hok-hero__est">
                  <span className="hok-hero__sep" aria-hidden="true" />
                  {HERO.est}
                </span>
              </p>
              <h1 className="white-clr text-uppercase">
                <span className="d-block hok-mask">
                  <span className="d-block hok-rise" style={delay(0.25)}>
                    {HERO.line1}
                  </span>
                </span>{" "}
                <span className="d-block hok-mask">
                  <span className="d-block hok-rise" style={delay(0.45)}>
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
                <Btn href="/contact" contact>
                  Start a Project
                </Btn>
                <Btn href="#work" variant="ghost">
                  See Our Work
                </Btn>
              </div>
              <p className="hok-hero__markets hok-fade" style={delay(0.95)}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9s1.3-6.4 3.9-9z" />
                </svg>
                {HERO.markets}
              </p>
              <HeroProof />
            </div>
            <div className="hok-hero__art" data-hero-art="">
              <HeroCubes />
            </div>
          </div>
        </section>

        <LogoMarquee />

        {/* Where we work: India, the GCC and international markets */}
        <MarketsBand />

        {/* What we do: four compact cards in one row, one screen at most */}
        <section className="hok-section hok-section--compact" id="what-we-do">
          <div className="container">
            <SectionHead
              className="hok-head--compact"
              title="What We"
              em="Do"
              text={SECTION_INTROS.services}
              action={{ href: "/services", label: "All Services" }}
            />
            <ServiceGroups />
          </div>
        </section>

        {/* Why brands trust HOK: six capabilities */}
        <TrustSection />

        {/* Work: the text slider, then the four reels */}
        <section className="hok-section" id="work">
          <Marquee text="SOCIAL MEDIA MARKETING" className="testi-italic hok-work-marquee" count={4} />
          <div className="container hok-work-wrap">
            <SectionHead title="Reels That" em="Get Noticed" text={SECTION_INTROS.work} />
            <div className="hok-reels">
              {WORK.map((item, i) => (
                <div className="hok-reels__item" key={item.reelId} data-parallax={["0.04", "0.10", "0.06", "0.12"][i]}>
                  <WorkCard item={item} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How we work */}
        <section className="hok-section">
          <div className="container">
            <SectionHead title="How We" em="Work" text={SECTION_INTROS.process} />
            <ProcessTimeline />
          </div>
        </section>

        {/* Behind the work: a full-width photo band */}
        <section className="hok-section">
          <div className="hok-band" data-reveal="clip-up">
            <img
              className="hok-band__img"
              src={STOCK.studio}
              alt=""
              width={1920}
              height={1280}
              sizes="100vw"
              loading="lazy"
              decoding="async"
              data-parallax="0.15"
            />
            <div className="hok-band__shade" aria-hidden="true" />
            <div className="container hok-band__content">
              <h2 className="hok-title" data-reveal="mask">
                <MaskText text="From Brief To Post," em="Made In-House" />
              </h2>
              <p className="hok-lead" data-reveal="up" style={step(4)}>
                Strategy, shoots, editing and ads, under one roof.
              </p>
              <Btn href="#work" variant="ghost" reveal>
                See Our Work
              </Btn>
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
