import type { PageIntro } from "../content";

/**
 * The editorial header at the top of an inner page, on the plain dark
 * background: the big heading (one red italic phrase) on the left, one muted
 * sentence on the right sitting on the heading's last line, a hairline below.
 * Stacked on phones. Text comes from PAGE_INTROS in modules/site/content.ts.
 */
export function PageBanner({ intro }: { intro: PageIntro }) {
  return (
    <header className="hok-intro">
      <div className="container">
        <div className="hok-intro__grid">
          <h1 className="hok-title hok-title--page">
            {intro.title} <em>{intro.em}</em>
          </h1>
          <p className="hok-lead hok-intro__text">{intro.text}</p>
        </div>
      </div>
    </header>
  );
}
