import Script from "next/script";
import { SiteScripts } from "./SiteScripts";

const ASSETS = "/site/assets";

/** The template's stylesheets, in its own order, plus HOK's additions last. */
const STYLESHEETS = [
  `${ASSETS}/css/bootstrap.min.css`,
  `${ASSETS}/css/magnific-popup.css`,
  `${ASSETS}/css/nice-select.css`,
  `${ASSETS}/css/swiper.min.css`,
  `${ASSETS}/css/aos.css`,
  `${ASSETS}/css/main.css`,
  "/site/hok-site.css",
];

/** jQuery and its plugins, in the template's order. main.js runs later (SiteScripts). */
const LIBRARIES = [
  "jquery.js",
  "bootstrap.bundle.min.js",
  "jquery.waypoints.js",
  "magnific-popup.js",
  "jquery.nice-select.min.js",
  "swiper.js",
  "jquery.counterup.min.js",
  "aos.js",
  "vanilla-tilt.min.js",
];

/**
 * The portfolio's whole HTML document: the template's <head> stylesheets, its
 * body class and its scripts. Used by the (site) root layout and by
 * app/global-not-found.tsx, so the 404 page looks like the rest of the site.
 * It never imports globals.css: Bootstrap and Tailwind never share a page.
 */
export function SiteDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {STYLESHEETS.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body className="position-relative bg2-clr">
        {children}
        {LIBRARIES.map((file) => (
          // The lint rule predates the App Router: here, beforeInteractive belongs in a root layout, which is where SiteDocument renders.
          // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
          <Script key={file} src={`${ASSETS}/js/${file}`} strategy="beforeInteractive" />
        ))}
        <SiteScripts />
      </body>
    </html>
  );
}
