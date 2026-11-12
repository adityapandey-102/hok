import { FOUNDER } from "../content";
import { REVEAL } from "./SectionHead";

/**
 * The "About HOK" block on Home and About: the founder's photo (4:5, sharp
 * corners, capped so the whole block fits one 800 px screen) beside the heading,
 * two short paragraphs and a button (`children`), vertically centred.
 */
export function FounderBlock({ paragraphs, children }: { paragraphs: readonly string[]; children: React.ReactNode }) {
  return (
    <div className="hok-founder" {...REVEAL}>
      <div className="hok-founder__photo">
        <img src={FOUNDER.photo} alt={`${FOUNDER.name}, ${FOUNDER.role} of HOK`} width={800} height={1207} />
      </div>
      <div className="hok-founder__text">
        <h2 className="hok-title">
          Built On Creativity, <em>Powered By AI</em>
        </h2>
        {paragraphs.map((p, i) => (
          <p key={i} className={i === 0 ? "hok-founder__p1" : "hok-founder__p2"}>
            {p}
          </p>
        ))}
        {children}
      </div>
    </div>
  );
}
