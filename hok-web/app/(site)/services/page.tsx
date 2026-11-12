import type { Metadata } from "next";
import { PageBanner } from "@/modules/site/components/PageBanner";
import { REVEAL } from "@/modules/site/components/SectionHead";
import { ServiceGroups } from "@/modules/site/components/ServiceGroups";
import { SitePage } from "@/modules/site/components/SitePage";
import { PAGE_INTROS } from "@/modules/site/content";

export const metadata: Metadata = { title: "Services" };

/** Services: the four groups as open rows (group on the left, its services on the right), then a closing call to action. */
export default function ServicesPage() {
  return (
    <SitePage variant="inner">
      <main className="main" id="mains">
        <PageBanner intro={PAGE_INTROS.services} />
        <section className="hok-section hok-section--page">
          <div className="container">
            <ServiceGroups layout="rows" />
          </div>
        </section>
        <section className="hok-section hok-section--page hok-section--end">
          <div className="container">
            <div className="hok-cta" {...REVEAL}>
              <h2 className="hok-title">
                Have A Project <em>In Mind?</em>
              </h2>
              <a href="/contact" className="hok-btn hok-btn--primary">
                Start a Project
              </a>
            </div>
          </div>
        </section>
      </main>
    </SitePage>
  );
}
