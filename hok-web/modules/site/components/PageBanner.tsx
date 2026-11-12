import type { PageIntro } from "../content";
import { MaskText } from "./SectionHead";
import { SignalMotif } from "./SignalMotif";

/**
 * The editorial header at the top of an inner page, on the plain dark
 * background: the big heading (one red italic phrase, sliding up word by word)
 * on the left, one muted sentence on the right sitting on the heading's last
 * line, and a hairline below. The signal motif (rings and dots) sits behind the
 * right half (on phones and tablets it sits under the text, inside the intro,
 * above the hairline). Text comes from PAGE_INTROS in
 * modules/site/content.ts.
 */
export function PageBanner({ intro }: { intro: PageIntro }) {
  return (
    <header className="hok-intro">
      <SignalMotif id="hk-dots-intro" className="hok-motif--intro" />
      <div className="container">
        <div className="hok-intro__grid">
          <h1 className="hok-title hok-title--page" data-reveal="mask">
            <MaskText text={intro.title} em={intro.em} />
          </h1>
          <p className="hok-lead hok-intro__text" data-reveal="up" style={{ "--i": 4 } as React.CSSProperties}>
            {intro.text}
          </p>
        </div>
      </div>
    </header>
  );
}
