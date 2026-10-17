import type { Metadata } from "next";
import { PortalApp } from "../../../../modules/client-portal/components/PortalApp";

/**
 * The client portal (M8): public, no login. The link token is the only
 * credential, so the page is never indexed or cached and never sends its URL
 * to other sites (see next.config.ts headers for /p/*). Data is fetched from
 * the visitor's browser straight to hok-api (modules/client-portal/api).
 */
export const metadata: Metadata = {
  title: "Your dashboard · HOK",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PortalApp token={token} />;
}
