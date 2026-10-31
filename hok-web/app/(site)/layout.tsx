import type { Metadata } from "next";
import { SiteDocument } from "@/modules/site/components/SiteDocument";

export const metadata: Metadata = {
  title: { default: "HOK · House of Khalak", template: "%s · HOK" },
  description: "House of Khalak -- a marketing agency that grows brands.",
};

/**
 * Root layout #1 of 2 (see docs/ARCHITECTURE.md §11): the public portfolio,
 * the HOK HTML template ported as-is (README "Portfolio"). SiteDocument loads
 * the template's own stylesheets (Bootstrap + main.css) and jQuery plugins
 * from public/site. It deliberately does NOT import globals.css: the
 * template's CSS and Tailwind never load on the same page. Moving between this
 * layout and app/(main) is a full page load.
 */
export default function SiteRootLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument>{children}</SiteDocument>;
}
