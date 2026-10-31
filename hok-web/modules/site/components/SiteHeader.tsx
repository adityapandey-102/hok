import { SITE_LOGO } from "../brand";
import { SiteIcon } from "./SiteIcon";

type NavGroup = { label: string; href?: string; items?: { href: string; label: string }[] };

/**
 * The template's menu, with its *.html links rewritten to HOK's routes.
 * Dropped: "Home Version-2/3/4" (index2-4.html never existed in the template).
 * "Oops 404" points at a path that doesn't exist, so it shows the 404 page.
 */
const NAV: NavGroup[] = [
  { label: "Home", items: [{ href: "/", label: "Home" }] },
  {
    label: "Pages",
    items: [
      { href: "/about", label: "About" },
      { href: "/pricing", label: "Pricing Plan" },
      { href: "/team", label: "Team Grid" },
      { href: "/team/details", label: "Team Details" },
      { href: "/faq", label: "Faqs" },
      { href: "/contact", label: "Contact" },
      { href: "/oops", label: "Oops 404" },
    ],
  },
  {
    label: "Protfolio",
    items: [
      { href: "/case-studies", label: "Case Study" },
      { href: "/case-studies/details", label: "Case Study Details" },
    ],
  },
  {
    label: "Blog",
    items: [
      { href: "/blog", label: "Blog Grid" },
      { href: "/blog/list", label: "Blog List" },
      { href: "/blog/details", label: "Blog Details" },
    ],
  },
  {
    label: "Services",
    items: [
      { href: "/services", label: "Service" },
      { href: "/services/details", label: "Service Details" },
    ],
  },
  { label: "Contact Us", href: "/contact" },
];

/**
 * The site header. `home` is the template's index.html header (search, cart
 * and "Get In Touch"); `inner` is the one every other page used (phone number
 * and the side-menu button).
 */
export function SiteHeader({ variant }: { variant: "home" | "inner" }) {
  const home = variant === "home";
  const toggle = (
    <button className="navbar-toggle-btn d-block d-lg-none" type="button" aria-label="Menu">
      <span /> <span /> <span /> <span />
    </button>
  );
  return (
    <header className={`header-section cmn-fixed ${home ? "" : "hb-border "}py-lg-0 py-6`}>
      <div className="container">
        <div className="main-navbar">
          <nav className="navbar-custom">
            <div className="d-lg-flex flex-xl-nowrap flex-wrap align-items-center justify-content-lg-between">
              <div className="d-flex align-items-center justify-content-between">
                <a href="/" className="brand-logo">
                  <img className="w-100" src={SITE_LOGO} alt="logo" />
                </a>{" "}
                {home ? (
                  <div className="d-flex align-items-center gap-xxl-5 gap-5">
                    <a href="#" role="button" className="search-trigger search-icon d-lg-none d-block" aria-label="Search">
                      <SiteIcon name="search" light />
                    </a>{" "}
                    {toggle}
                  </div>
                ) : (
                  toggle
                )}
              </div>
              <div className="navbar-toggle-item">
                <ul className="custom-nav d-lg-flex d-grid gap-xxl-10 gap-xl-8 gap-lg-5 gap-md-2 gap-2 pt-lg-0 pt-5">
                  {NAV.map((group) =>
                    group.items ? (
                      <li key={group.label} className="menu-item position-relative">
                        <button className="position-relative ps-5 fw_500 white-clr cus-z1">{group.label}</button>
                        <ul className="sub-menu px-lg-4 py-xxl-3 py-2">
                          {group.items.map((item) => (
                            <li key={item.label} className="menu-link py-1">
                              <a href={item.href} className="fw_500 white-clr">
                                {item.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ) : (
                      <li key={group.label} className="menu-item position-relative">
                        <a href={group.href} className="fw_500">
                          {group.label}
                        </a>
                      </li>
                    ),
                  )}
                </ul>
              </div>
              {home ? <HomeActions /> : <InnerActions />}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}

function HomeActions() {
  return (
    <div className="d-lg-flex d-none d-grid justify-content-center ph-clickwrap align-items-center gap-xxl-7 gap-xl-6 gap-lg-5 gap-3">
      <div className="search-shopcart d-flex gap-xxl-9 gap-xl-5 gap-3">
        <a href="#" role="button" className="search-trigger search-icon" aria-label="Search">
          <SiteIcon name="search" light />
        </a>{" "}
        <a href="/contact" className="shop-cart" aria-label="Contact">
          <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_6205_2234)">
              <path d="M13.6814 12.6667H7.60217C6.72549 12.6667 5.94818 12.0993 5.71093 11.2867L3.65611 4.41932C3.58311 4.17066 3.34045 3.99999 3.06333 3.99999H1.45327C1.07948 3.99999 0.777344 3.70132 0.777344 3.33332C0.777344 2.96532 1.07948 2.66666 1.45327 2.66666H3.06333C3.94 2.66666 4.71664 3.23399 4.95389 4.04666L5.33849 5.33332H15.6768C16.0986 5.33332 16.4987 5.53132 16.7468 5.86332C16.9928 6.19266 17.0638 6.60466 16.9414 6.99399L15.547 11.3593C15.2739 12.1473 14.5257 12.6667 13.6814 12.6667Z" fill="white" />
              <path d="M8.2122 16C7.46666 16 6.86035 15.402 6.86035 14.6667C6.86035 13.9313 7.46666 13.3333 8.2122 13.3333C8.95775 13.3333 9.56406 13.9313 9.56406 14.6667C9.56406 15.402 8.95775 16 8.2122 16Z" fill="white" />
              <path d="M12.9436 16C12.1981 16 11.5918 15.402 11.5918 14.6667C11.5918 13.9313 12.1981 13.3333 12.9436 13.3333C13.6892 13.3333 14.2955 13.9313 14.2955 14.6667C14.2955 15.402 13.6892 16 12.9436 16Z" fill="white" />
            </g>
            <defs>
              <clipPath id="clip0_6205_2234">
                <rect width="16.2222" height="16" fill="white" transform="translate(0.777344)" />
              </clipPath>
            </defs>
          </svg>
        </a>
      </div>
      <a href="/contact" className="d-flex align-items-center gap-sm-3 gap-2 touch-btn cmn-btn">
        <span className="rot60">
          <SiteIcon name="arrow-up" />
        </span>{" "}
        Get In Touch
      </a>
    </div>
  );
}

function InnerActions() {
  return (
    <div className="d-lg-flex d-grid justify-content-center ph-clickwrap align-items-center gap-xxl-7 gap-xl-6 gap-lg-5 gap-3">
      <a href="#" className="d-flex align-items-center header-ph gap-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clipPath="url(#clip0_6577_1298)">
            <path d="M21.2438 18.1073L17.7431 14.6066C17.0144 13.8779 15.8329 13.8771 15.1034 14.6066L14.0839 15.6261C11.7543 14.2035 9.79723 12.2464 8.37459 9.91682L9.49247 8.79899C10.2202 8.07121 10.2202 6.88701 9.49242 6.15923L5.9917 2.65851C5.26504 1.93194 4.08525 1.92519 3.34978 2.66071L1.14994 4.87766C0.0974045 5.76145 -0.272814 7.21251 0.207186 8.58777C2.67028 15.6461 8.35472 21.3305 15.413 23.7936C16.7409 24.2569 18.1046 23.9104 18.9717 23.0171C18.9842 23.006 18.9964 22.9946 19.0084 22.9826L21.2438 20.7471C21.9716 20.0193 21.9716 18.8352 21.2438 18.1073ZM20.1287 19.6319L17.9437 21.8168C17.9171 21.839 17.8919 21.863 17.8681 21.8888C17.4082 22.3887 16.6684 22.5613 15.9327 22.3044C9.32433 19.9984 4.00237 14.6764 1.69631 8.06802C1.43226 7.31141 1.62276 6.52752 2.18165 6.07091C2.20289 6.05357 2.22323 6.0351 2.24255 6.01565L4.46719 3.77366C4.49403 3.74672 4.52593 3.72536 4.56106 3.71081C4.5962 3.69626 4.63386 3.6888 4.67189 3.68887C4.7167 3.68887 4.80281 3.69984 4.87659 3.77366L8.37722 7.27438C8.43142 7.32871 8.46186 7.40231 8.46187 7.47905C8.46188 7.55579 8.43145 7.6294 8.37726 7.68374L6.82837 9.23263C6.70656 9.35442 6.62798 9.51274 6.60464 9.68339C6.58129 9.85405 6.61447 10.0277 6.69909 10.1777C8.37983 13.1574 10.8433 15.6209 13.8231 17.3016C13.9731 17.3862 14.1467 17.4194 14.3173 17.3961C14.488 17.3727 14.6463 17.2942 14.7681 17.1724L16.2187 15.7218C16.273 15.6676 16.3466 15.6371 16.4233 15.6371C16.5001 15.6371 16.5737 15.6676 16.628 15.7218L20.1287 19.2225C20.1829 19.2769 20.2133 19.3505 20.2133 19.4272C20.2133 19.504 20.1829 19.5776 20.1287 19.6319ZM12.6048 6.15604C12.1693 6.15604 11.8162 6.5091 11.8162 6.94462C11.8162 7.38013 12.1692 7.73319 12.6048 7.73319C14.6244 7.73319 16.2675 9.37631 16.2675 11.396C16.2675 11.8315 16.6206 12.1845 17.0561 12.1845C17.4916 12.1845 17.8447 11.8315 17.8447 11.396C17.8447 8.50668 15.4941 6.15604 12.6048 6.15604Z" fill="white" />
            <path d="M12.7779 3C12.3483 3 12 3.34828 12 3.7779C12 4.20752 12.3482 4.5558 12.7779 4.5558C16.4537 4.5558 19.4442 7.54629 19.4442 11.2221C19.4442 11.6517 19.7925 12 20.2221 12C20.6517 12 21 11.6517 21 11.2221C21 6.68844 17.3116 3 12.7779 3Z" fill="white" />
            <path d="M20.7128 3.28719C18.593 1.1674 15.7745 0 12.7767 0C12.3477 0 12 0.347735 12 0.776679C12 1.20562 12.3477 1.55336 12.7767 1.55336C18.1087 1.55336 22.4466 5.89127 22.4466 11.2233C22.4466 11.6523 22.7944 12 23.2233 12C23.6523 12 24 11.6523 24 11.2233C24 8.22542 22.8326 5.40702 20.7128 3.28719Z" fill="white" />
          </g>
          <defs>
            <clipPath id="clip0_6577_1298">
              <rect width="24" height="24" fill="white" />
            </clipPath>
          </defs>
        </svg>
        <span className="stext">+208-555-0112</span>
      </a>
      <div className="remove-click remove-clickbg-adding d-center m-auto" role="button" aria-label="Open side menu">
        <SiteIcon name="menu" />
      </div>
    </div>
  );
}
