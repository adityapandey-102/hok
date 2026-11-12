import { ContactModal } from "./ContactModal";
import { SiteMotion } from "./motion/SiteMotion";
import { Preloader } from "./Preloader";
import { ScrollTop } from "./ScrollTop";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/**
 * The chrome every portfolio page shares: preloader, header, the page's own
 * <main> (children), footer, back-to-top, the motion kit (SiteMotion) and the
 * scroll-triggered contact modal. The header and footer are the same on every
 * page; `variant` is kept so pages can keep passing what they always passed.
 */
export function SitePage({ variant, children }: { variant: "home" | "inner"; children: React.ReactNode }) {
  return (
    <>
      <Preloader />
      <SiteHeader variant={variant} />
      {children}
      <SiteFooter variant={variant} />
      <ScrollTop />
      <SiteMotion />
      <ContactModal />
    </>
  );
}
