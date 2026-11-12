import { SITE_LOGO } from "../brand";
import { NavLinks } from "./NavLinks";

/**
 * The header, the same on every page: the logo on the left, the text menu, and
 * "Get In Touch" as the primary button on the right. Main.js makes it sticky
 * with the template's dark background once the page moves. No search, no cart.
 * The `variant` prop is kept so every page can pass what it always passed.
 */
export function SiteHeader({ variant }: { variant: "home" | "inner" }) {
  void variant;
  return (
    <header className="header-section cmn-fixed py-lg-0 py-6">
      <div className="container">
        <div className="main-navbar">
          <nav className="navbar-custom">
            <div className="d-lg-flex flex-xl-nowrap flex-wrap align-items-center justify-content-lg-between">
              <div className="d-flex align-items-center justify-content-between">
                <a href="/" className="brand-logo">
                  <img className="w-100" src={SITE_LOGO} alt="HOK" />
                </a>{" "}
                <button className="navbar-toggle-btn d-block d-lg-none" type="button" aria-label="Menu">
                  <span /> <span /> <span /> <span />
                </button>
              </div>
              <div className="navbar-toggle-item">
                <NavLinks />
              </div>
              <div className="d-lg-flex d-none justify-content-center ph-clickwrap align-items-center">
                <a href="/contact" className="hok-btn hok-btn--primary">
                  Get In Touch
                </a>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
