import type { Metadata } from "next";
import { NotFoundMain } from "@/modules/site/components/NotFoundMain";
import { SiteDocument } from "@/modules/site/components/SiteDocument";
import { SitePage } from "@/modules/site/components/SitePage";

export const metadata: Metadata = {
  title: "Page not found · HOK",
};

/**
 * The 404 for any URL that matches no route (Next's `globalNotFound`, needed
 * because the app has two root layouts and so no single one to wrap a 404).
 * It is the template's oops.html, in the portfolio's own document, so a
 * mistyped link on the public site lands on a page that looks like the site.
 */
export default function GlobalNotFound() {
  return (
    <SiteDocument>
      <SitePage variant="inner">
        <NotFoundMain />
      </SitePage>
    </SiteDocument>
  );
}
