import type { Metadata } from "next";
import { LetsTalk } from "@/modules/site/components/LetsTalk";
import { PageBanner } from "@/modules/site/components/PageBanner";
import { ServicePanels } from "@/modules/site/components/ServicePanels";
import { SitePage } from "@/modules/site/components/SitePage";
import { PAGE_INTROS } from "@/modules/site/content";

export const metadata: Metadata = { title: "Services" };

/** Services: a sticky index of the four groups beside four content panels (photo, services, a "Discuss This Service" button), then the closing "Let's talk" band. */
export default function ServicesPage() {
  return (
    <SitePage variant="inner">
      <main className="main" id="mains">
        <PageBanner intro={PAGE_INTROS.services} />
        <section className="hok-section hok-section--page">
          <div className="container">
            <ServicePanels />
          </div>
        </section>
        <LetsTalk />
      </main>
    </SitePage>
  );
}
