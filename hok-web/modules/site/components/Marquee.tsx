import { Fragment } from "react";

/**
 * The template's text slider: a big word alternating between italic and
 * outlined, a separator `icon` between each, scrolling slowly (main.css).
 * SiteMotion speeds it up while the page scrolls and slows it on hover.
 * Two identical copies make the loop; the second is hidden from screen readers.
 */
export function Marquee({
  text,
  icon = <Dot />,
  count = 4,
  className = "testi-italic",
  hoverRate = 0,
}: {
  text: string;
  icon?: React.ReactNode;
  count?: number;
  className?: string;
  /** Speed while hovered, as a fraction of normal (0 = pause, the template's own behaviour). */
  hoverRate?: number;
}) {
  return (
    <div className={`digital-solution ${className}`} data-marquee="" data-marquee-hover={hoverRate}>
      <div className="mycustom-marque">
        <div className="scrolling-wrap">
          {[0, 1].map((copy) => (
            <div className="comm" key={copy} aria-hidden={copy === 1 ? true : undefined}>
              {Array.from({ length: count }, (_, i) => (
                <Fragment key={i}>
                  <div className={`cmn-textslide ${i % 2 === 0 ? "textitalick" : "text-custom-storke"}`}>{text}</div>
                  <div>{icon}</div>
                </Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The small red dot between the words. */
export function Dot() {
  return <i className="hok-dot" aria-hidden="true" />;
}
