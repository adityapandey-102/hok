import { Fragment } from "react";
import { Btn } from "./Btn";

/** One reveal for a whole block (never per card): SiteMotion fades it up once as it scrolls into view. */
export const REVEAL = { "data-reveal": "up" } as const;

/**
 * Heading words, each inside a mask (`.hok-m`), so SiteMotion's reveal can slide
 * them up one after another (`--i` staggers). Done in the markup, not by a
 * script, so React's DOM is never changed behind its back. `em` is the red
 * italic phrase. Spaces stay real text between the words, so screen readers and
 * tests read the heading as one sentence.
 */
export function MaskText({ text, em, after }: { text: string; em?: string; after?: string }) {
  let n = 0;
  const words = (value: string) =>
    value.split(" ").map((word) => (
      <Fragment key={n}>
        {n > 0 && " "}
        <span className="hok-m">
          <span style={{ "--i": n++ } as React.CSSProperties}>{word}</span>
        </span>
      </Fragment>
    ));
  return (
    <>
      {words(text)}
      {em ? (
        <>
          {" "}
          <em>{words(em)}</em>
        </>
      ) : null}
      {after ? <> {words(after)}</> : null}
    </>
  );
}

/**
 * A section's heading: a short red rule, a big bold heading with one red italic
 * phrase (`em`) that slides up word by word, then one muted intro sentence, all
 * left-aligned. An optional ghost button sits on the right (below the text on phones).
 */
export function SectionHead({
  title,
  em,
  after,
  text,
  action,
  className = "",
}: {
  /** Text before the red italic phrase. */
  title: string;
  /** The red italic phrase. */
  em: string;
  /** Text after the red italic phrase. */
  after?: string;
  /** The one intro sentence. */
  text?: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={`hok-head ${className}`.trim()}>
      <div className="hok-head__main">
        <h2 className="hok-title" data-reveal="mask">
          <MaskText text={title} em={em} after={after} />
        </h2>
        {text && (
          <p className="hok-lead" data-reveal="up" style={{ "--i": 3 } as React.CSSProperties}>
            {text}
          </p>
        )}
      </div>
      {action && (
        <Btn href={action.href} variant="ghost" reveal>
          {action.label}
        </Btn>
      )}
    </div>
  );
}
