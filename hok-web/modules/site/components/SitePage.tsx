import { Preloader } from "./Preloader";
import { ScrollTop } from "./ScrollTop";
import { SearchPopup } from "./SearchPopup";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { SubSidebar } from "./SubSidebar";

/**
 * The chrome every portfolio page shares, in the template's order: preloader,
 * header, search overlay, the page's own <main> (children), footer, side menu
 * and back-to-top. `home` = index.html's header and footer; `inner` = the
 * version every other template page uses.
 */
export function SitePage({ variant, children }: { variant: "home" | "inner"; children: React.ReactNode }) {
  return (
    <>
      <Preloader />
      <SiteHeader variant={variant} />
      <SearchPopup />
      {children}
      <SiteFooter variant={variant} />
      <SubSidebar />
      <ScrollTop />
    </>
  );
}
