import { SITE_LOGO } from "../brand";
import { PreloaderControl } from "./PreloaderControl";

/** Runs while the HTML is parsed, before the first paint: skip the overlay on every visit after the first in this session; on the first, mark <html> so the hero reveal waits for the overlay to lift. */
const FIRST_LOAD_ONLY = `try{var p=document.getElementById("preloader");if(sessionStorage.getItem("hok-preloaded")){if(p)p.style.display="none"}else{sessionStorage.setItem("hok-preloaded","1");document.documentElement.classList.add("hok-first")}}catch(e){}`;

/**
 * The page-load overlay: the HOK logo fades in on the site's dark background
 * with a thin red line filling under it. Shown only on the first load of a
 * session and never for more than about 1.2 s (the CSS in /site/hok-site.css
 * fades it out by itself at 1.2 s; PreloaderControl lifts it earlier once the
 * page has loaded). Reduced-motion visitors never see it.
 *
 * The template's own `.preloader` curtain (spinner, "Loading", four panels,
 * lifted by main.js) is no longer used, so this element has no `preloader`
 * class and main.js leaves it alone.
 */
export function Preloader() {
  return (
    <>
      <div id="preloader" className="hok-preloader" aria-hidden="true" suppressHydrationWarning>
        <div className="hok-preloader__inner">
          <img src={SITE_LOGO} alt="" className="hok-preloader__logo" />
          <div className="hok-preloader__bar">
            <span />
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: FIRST_LOAD_ONLY }} />
      <PreloaderControl />
    </>
  );
}
