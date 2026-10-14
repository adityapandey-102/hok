import { SiteIcon } from "./SiteIcon";

/** The template's full-screen search overlay (opened by `.search-trigger`, main.js). */
export function SearchPopup() {
  return (
    <div className="search-wrap">
      <div className="search-inner">
        <SiteIcon name="x" className="search-close" id="search-close" />
        <div className="search-cell">
          <form method="get">
            <div className="search-field-holder">
              <input type="search" className="main-search-input" placeholder="Search..." />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
