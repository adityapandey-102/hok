import { SiteIcon } from "./SiteIcon";

/** Back-to-top button; main.js shows it after 250 px of scrolling. */
export function ScrollTop() {
  return (
    <div id="progress">
      <span id="valiu">
        <SiteIcon name="arrow-up" />
      </span>
    </div>
  );
}
