/** One gentle fade-up for a whole section block (never per card); AOS plays it once. */
export const REVEAL = { "data-aos": "fade-up", "data-aos-duration": "600" } as const;

/**
 * A section's heading: a short red rule, a big bold heading with one red italic
 * phrase (`em`), then one muted intro sentence, all left-aligned. An optional
 * secondary button sits on the right (below the text on phones).
 * Heading text is Title Case through the template's `h2` rule.
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
    <div className={`hok-head ${className}`.trim()} {...REVEAL}>
      <div className="hok-head__main">
        <h2 className="hok-title">
          {title} <em>{em}</em>
          {after ? ` ${after}` : ""}
        </h2>
        {text && <p className="hok-lead">{text}</p>}
      </div>
      {action && (
        <a href={action.href} className="hok-btn hok-btn--ghost">
          {action.label}
        </a>
      )}
    </div>
  );
}
