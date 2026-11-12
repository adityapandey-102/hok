import { FOUNDER, FOUNDER_QUOTE } from "../content";
import { MaskText } from "./SectionHead";

/**
 * The founder block on the About page: the founder's photo (4:5, rounded,
 * `object-position: 50% 8%` so the head is fully in frame, capped so the whole
 * block fits one 800 px screen) with a quote card overlapping its bottom-right
 * corner, beside the heading, two short paragraphs and a button (`children`),
 * vertically centred. The photo reveals with a clip (SiteMotion); it does not
 * drift, so the head is never cut.
 */
export function FounderBlock({ paragraphs, children }: { paragraphs: readonly string[]; children: React.ReactNode }) {
  return (
    <div className="hok-founder">
      <div className="hok-founder__photo">
        <div className="hok-founder__media" data-reveal="clip">
          <img
            src={FOUNDER.photo}
            alt={`${FOUNDER.name}, ${FOUNDER.role} of HOK`}
            width={800}
            height={1207}
          />
        </div>
        <figure className="hok-founder__quote" data-reveal="up" style={{ "--d": "300ms" } as React.CSSProperties}>
          <blockquote>{FOUNDER_QUOTE}</blockquote>
          <figcaption>
            {FOUNDER.name}, {FOUNDER.role}
          </figcaption>
        </figure>
      </div>
      <div className="hok-founder__text">
        <h2 className="hok-title" data-reveal="mask">
          <MaskText text="Built On Creativity," em="Powered By AI" />
        </h2>
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className={i === 0 ? "hok-founder__p1" : "hok-founder__p2"}
            data-reveal="up"
            style={{ "--i": i + 3 } as React.CSSProperties}
          >
            {p}
          </p>
        ))}
        {children}
      </div>
    </div>
  );
}
