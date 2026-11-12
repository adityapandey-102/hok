import type { Metadata } from "next";
import { FounderBlock } from "@/modules/site/components/FounderBlock";
import { LetsTalk } from "@/modules/site/components/LetsTalk";
import { LogoTile } from "@/modules/site/components/LogoMarquee";
import { PageBanner } from "@/modules/site/components/PageBanner";
import { ProcessTimeline } from "@/modules/site/components/ProcessTimeline";
import { REVEAL, SectionHead } from "@/modules/site/components/SectionHead";
import { ServiceGroups } from "@/modules/site/components/ServiceGroups";
import { SitePage } from "@/modules/site/components/SitePage";
import { CLIENTS, CLIENT_LOGOS, COMPANY, FOUNDER, PAGE_INTROS, SECTION_INTROS } from "@/modules/site/content";

export const metadata: Metadata = { title: "About" };

/** About HOK: the founder, how we work, what we do and the clients. All text comes from modules/site/content.ts. */
export default function AboutPage() {
  return (
    <SitePage variant="inner">
      <main className="main" id="mains">
        <PageBanner intro={PAGE_INTROS.about} />

        {/* Founder */}
        <section className="hok-section hok-section--page">
          <div className="container">
            <FounderBlock paragraphs={[COMPANY.intro, COMPANY.intro2]}>
              <p className="hok-founder__by">
                Founded by{" "}
                <a href={FOUNDER.instagram} target="_blank" rel="noopener noreferrer">
                  {FOUNDER.name}
                </a>
              </p>
              <div className="hok-founder__action">
                <a href="/contact" className="hok-btn hok-btn--ghost">
                  Work With Us
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

        {/* What we do */}
        <section className="hok-section">
          <div className="container">
            <SectionHead title="What We" em="Do" text={SECTION_INTROS.services} />
            <ServiceGroups layout="grid" />
          </div>
        </section>

        {/* Clients */}
        <section className="hok-section">
          <div className="container">
            <SectionHead title="Brands We" em="Grow" text={SECTION_INTROS.clients} />
            <div {...REVEAL}>
              <ul className="hok-logo-grid">
                {CLIENT_LOGOS.map((logo) => (
                  <li key={logo.file}>
                    <LogoTile name={logo.name} file={logo.file} />
                  </li>
                ))}
              </ul>
              <ul className="hok-clients">
                {CLIENTS.map((client) => (
                  <li key={client.name}>
                    <a href={client.href} className="hok-client-link" target="_blank" rel="noopener noreferrer">
                      {client.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <LetsTalk />
      </main>
    </SitePage>
  );
}
