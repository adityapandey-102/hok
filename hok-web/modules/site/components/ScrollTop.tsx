import { SiteIcon } from "./SiteIcon";

/** The one back-to-top button (fixed, bottom right); main.js shows it after 250 px of scrolling. */
export function ScrollTop() {
  return (
    <button id="progress" type="button" aria-label="Back to top">
      <span id="valiu">
        <SiteIcon name="arrow-up" />
      </span>
    </button>
  );
}
